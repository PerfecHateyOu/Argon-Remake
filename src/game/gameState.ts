import {
  BRAKING_DURATION_SEC,
  DEFAULT_CRUISE_DURATION_SEC,
  DEPARTURE_ACCEL_DURATION_SEC,
  DOOR_CHIME_DURATION_SEC,
  EARLY_DOOR_OPEN_DELAY_SEC,
  EVP_FREQ_DEFAULT_MHZ,
  EVP_FREQ_STEP_MHZ,
  EVP_RECORD_DURATION_SEC,
  GOVERNOR_FRAME_TIME_THRESHOLD_MS,
  GOVERNOR_PIXEL_RATIO_STEP,
  GOVERNOR_SAMPLE_FRAMES,
  MAX_PIXEL_RATIO_DESKTOP,
  MAX_PIXEL_RATIO_TOUCH,
  MIN_PIXEL_RATIO,
  PA_NEXT_STOP_ANNOUNCE_SEC,
  PLAYER_SEAT_X,
  PLAYER_SEAT_Z,
  POLAROID_FLASH_DECAY_PER_SEC,
  POLAROID_MAX_SHOTS,
  RESTRAINT_CEILING_RAISE,
  RESTRAINT_DURATION_SEC,
  RESTRAINT_GRACE_SECONDS,
  RESTRAINT_START_WINDOW_SEC,
  ROLLSIGN_DISPLAY_SEC,
  SANITY_BANDS_BY_STOP,
  SANITY_DELTAS,
  SANITY_TIER_THRESHOLDS,
  SEGMENT_TABLE,
  SHUTTER_COOLDOWN,
  STARTING_FILM,
  STOP_DWELL_DURATION_SEC,
  SUSPICION_DELTAS,
  SUSPICION_INTERVENTION_THRESHOLD,
  TRAIN_CRUISE_SPEED_MPS,
  TRAIN_NIGHTMARE_SPEED_MULT,
} from '../constants';
import { isNearGangwayDoor, playerController, resolveConsistLocation } from '../input/keyLook';
import { pointerLock } from '../input/pointerLock';
import { settingsStore } from '../settings';
import type {
  ActiveAnomalyInstance,
  ActiveRestraintState,
  AnomalyId,
  ChapterStartOption,
  DoorTellType,
  EngineSnapshot,
  EvpSignalId,
  ExitChoiceId,
  FalseStopTrialRecord,
  GamePhase,
  RideAnomalyRecord,
  RideSubPhase,
  RollsignBanner,
  RouteLineId,
  SanityTier,
  SegmentRule,
  StopDecisionRecord,
  SubtitleItem,
  TrialState,
} from '../types';
import {
  buildActiveAnomalyInstance,
  isLookingAtAnomaly,
  selectAnomalyIdForStretch,
  shouldAnomalyManifest,
  stepFlagHoldProgress,
} from './anomalyManager';
import { evaluateUnlockedAchievements } from './achievements';
import {
  computeAnomalyAccuracyPercent,
  computeSanityRetainedPercent,
  evaluateRideEnding,
} from './endings';
import {
  buildEvpTapeRecord,
  clampEvpFrequency,
  evaluateEvpTuning,
  reshuffleEvpFrequencies,
} from './evpManager';
import {
  buildPolaroidPhotoRecord,
  captureSquarePolaroidDataUrl,
  isAnomalyFramedInViewfinder,
} from './polaroidManager';
import {
  buildActiveMaskCheck,
  DAD_UNASKED_ANSWERS,
  EXTRA_CALM_SMALL_TALK,
  type MaskCheckDefinition,
  PARANOID_UI_WORDS,
  PARENT_RIDE_CHATS,
  selectMaskCheckPool,
} from './carLife';
import {
  evaluateHeadWhipReaction,
  evaluateSuspicionIntervention,
} from './passengerBehavior';
import { getChapterRollsign, getStopName, isElevatedOpenAirStop } from './routeManager';
import {
  formatRouteText,
  getArrivalPaText,
  getBoardingPaText,
  getDeparturePaText,
  getNextStopPaText,
} from './routeText';
import {
  buildTutorialMaskCheck,
  buildTutorialStepState,
  TUTORIAL_STRINGS,
} from './tutorial';

type EngineListener = (snapshot: EngineSnapshot) => void;

export type TrialChoiceId =
  | 'terminus_sign'
  | 'opposite_sign'
  | 'left_stairs'
  | 'middle_stairs'
  | 'right_stairs'
  | 'left_train'
  | 'right_train';

export const RESTRAINT_HOLD_DURATION_SEC = RESTRAINT_DURATION_SEC;

export function computeSanityTier(sanity: number): SanityTier {
  if (sanity >= SANITY_TIER_THRESHOLDS.HIGH) return 'High';
  if (sanity >= SANITY_TIER_THRESHOLDS.MEDIUM) return 'Medium';
  if (sanity >= SANITY_TIER_THRESHOLDS.LOW) return 'Low';
  return 'Critical';
}

export function clampSanityForStop(
  sanity: number,
  stopNumber: number,
  restraintHeldBonus = 0
): number {
  const band = SANITY_BANDS_BY_STOP[stopNumber] ?? [0, 100];
  const min = band[0];
  const max = Math.min(100, band[1] + restraintHeldBonus);
  return Math.max(min, Math.min(max, Math.round(sanity)));
}

export function computeInitialPixelRatio(devicePixelRatio: number, isTouch: boolean): number {
  const cap = isTouch ? MAX_PIXEL_RATIO_TOUCH : MAX_PIXEL_RATIO_DESKTOP;
  const clamped = Math.max(MIN_PIXEL_RATIO, Math.min(cap, devicePixelRatio || 1));
  return Math.round(clamped * 4) / 4;
}

export function stepGovernorPixelRatio(
  currentPixelRatio: number,
  averageFrameMs: number
): number {
  if (averageFrameMs > GOVERNOR_FRAME_TIME_THRESHOLD_MS && currentPixelRatio > MIN_PIXEL_RATIO) {
    return Math.max(
      MIN_PIXEL_RATIO,
      Number((currentPixelRatio - GOVERNOR_PIXEL_RATIO_STEP).toFixed(2))
    );
  }
  return currentPixelRatio;
}

export function computeStopDoorState(
  stopElapsedSec: number,
  doorTell: DoorTellType
): {
  chimePlaying: boolean;
  doorOpenProgress: number;
  subPhase: 'chime' | 'doors_open';
} {
  const chimePlaying = stopElapsedSec < DOOR_CHIME_DURATION_SEC;
  const openStartSec =
    doorTell === 'doors_open_early' ? EARLY_DOOR_OPEN_DELAY_SEC : DOOR_CHIME_DURATION_SEC;
  const openDurationSec = 0.85;
  const rawOpen = (stopElapsedSec - openStartSec) / openDurationSec;
  const doorOpenProgress = Math.max(0, Math.min(1, Number(rawOpen.toFixed(3))));
  const subPhase: 'chime' | 'doors_open' =
    !chimePlaying && doorOpenProgress >= 0.4 ? 'doors_open' : 'chime';

  return {
    chimePlaying,
    doorOpenProgress,
    subPhase,
  };
}

export function computeArrivalFlickerIntensity(
  timeRemainingSec: number,
  doorTell: DoorTellType
): number {
  if (doorTell !== 'lights_flicker' || timeRemainingSec > 0.9 || timeRemainingSec <= 0) {
    return 1.0;
  }
  if (timeRemainingSec > 0.55 && timeRemainingSec < 0.82) {
    return 0.05;
  }
  if (timeRemainingSec > 0.22 && timeRemainingSec < 0.42) {
    return 0.08;
  }
  return 0.92;
}

class GameEngine {
  private snapshot: EngineSnapshot;
  private listeners = new Set<EngineListener>();
  private frameTimeAccumMs = 0;
  private frameSampleCount = 0;

  private stopElapsedSec = 0;
  private havenElapsedSec = 0;
  private subtitleRemainingSec = 0;
  private rollsignRemainingSec = 0;
  private paranoidFlashRemainingSec = 0;
  private headWhipCooldownSec = 0;

  private nextStopPaAnnounced = false;
  private passingTrainTriggered = false;
  private clockSanityTickApplied = false;
  private chatPart1Played = false;
  private chatPart2Played = false;
  private restraintTriggeredInSegment = false;
  private maskChecksTriggeredInSegment = 0;
  private usedMaskCheckIds = new Set<string>();
  private usedAnomalyIds = new Set<AnomalyId>();
  private staringAtAnomalySec = 0;
  private stareReactionCooldownSec = 0;
  private falseFlagCooldownSec = 0;
  private shutterCooldownSec = 0;
  private photographedAnomalyInStretch = false;
  private evpListenElapsedSec = 0;
  private evpLastLockedId: EvpSignalId | null = null;
  private forcedWatcherLabel: 'Mom' | 'Dad' | null = null;
  private forcedWatcherRemainingSec = 0;
  private restraintBeat15Played = false;
  private restraintBeat40Played = false;
  private restraintBeat70Played = false;
  private restraintBeat105Played = false;

  private passingTrainListeners = new Set<() => void>();
  private tier3TearListeners = new Set<() => void>();
  private restraintWhisperListeners = new Set<() => void>();

  constructor() {
    const settings = settingsStore.get();
    const isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.snapshot = {
      phase: 'menu',
      rideSubPhase: 'cruising',
      paused: false,
      muted: settings.startMuted,
      nightmareMode: false,
      startChapter: 1,
      activeRoute: 'G',
      segmentTableIndex: 0,
      stopIndex: 0,
      segmentId: '2',
      currentStationName: getStopName('G', 0),
      nextStationName: getStopName('G', 1),
      isOpenAirStation: false,
      isOnTrestle: false,
      trestleProgress: 0,
      trestleWitnessed: false,
      trainSpeedMps: 0,
      segmentElapsedSec: 0,
      segmentDurationSec: DEFAULT_CRUISE_DURATION_SEC,
      stationDistanceM: 220,
      doorOpenProgress: 0,
      chimePlaying: false,
      activeDoorTell: 'none',
      lightFlickerIntensity: 1.0,
      rollsign: null,
      subtitle: null,
      selectedExit: null,
      resolvedEnding: null,
      sanityRetainedPercent: 100,
      anomalyAccuracyPercent: 100,
      tutorialState: null,
      watchingParentLabel: null,
      activeMaskCheck: null,
      paranoidFlashText: null,
      interventionsCount: 0,
      lastReactionReason: null,
      activeAnomaly: null,
      flagHoldProgress: 0,
      isFlagHolding: false,
      rideAnomalies: [],
      anomaliesSpawnedCount: 0,
      anomaliesCaughtCount: 0,
      falseFlagsCount: 0,
      cameraOpen: false,
      polaroidShotsRemaining: STARTING_FILM,
      polaroidFlashIntensity: 0,
      photos: [],
      albumOpen: false,
      hasRecorder: false,
      evpOpen: false,
      evpFrequencyMhz: EVP_FREQ_DEFAULT_MHZ,
      evpSignalStrength: 0,
      evpLockedSignalId: null,
      evpLockedTitle: null,
      evpTranscriptLive: null,
      evpIsRecording: false,
      evpRecordProgress: 0,
      evpLastSavedTitle: null,
      tapes: [],
      playingTapeId: null,
      hasConductorEvp: false,
      hasSecretBroadcasterEvp: false,
      safeHavenVisited: false,
      trialState: null,
      falseStopTrials: [],
      activeRestraint: null,
      restraintHeld: false,
      restraintCompleted: false,
      restraintCeilingBonus: 0,
      steppedOffAtBait: false,
      stopDecisions: [],
      sanity: 100,
      sanityTier: 'High',
      suspicion: 0,
      peakSuspicion: 0,
      fps: 60,
      pixelRatio: computeInitialPixelRatio(dpr, isTouch),
      isPracticeRun: false,
      isDebugRun: settings.debugOverlay,
      carLocation: 'CAR B (MID)',
      nearGangwayDoor: false,
      playerX: PLAYER_SEAT_X,
      playerZ: PLAYER_SEAT_Z,
      playerYaw: 0,
      playerPitch: -0.03,
    };

    this.syncBodyDataset();

    settingsStore.subscribe((nextSettings) => {
      if (nextSettings.debugOverlay && this.snapshot.phase !== 'menu') {
        this.update({ isDebugRun: true });
      }
    });

    pointerLock.onUnexpectedUnlock(() => {
      if (this.snapshot.phase !== 'menu' && this.snapshot.phase !== 'end' && !this.snapshot.paused) {
        this.togglePause(true);
      }
    });

    if (typeof window !== 'undefined') {
      (window as unknown as { __lastLocalEngine?: GameEngine }).__lastLocalEngine = this;
    }
  }

  private syncBodyDataset(): void {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.dataset.phase = this.snapshot.phase;
    document.body.dataset.subphase = this.snapshot.rideSubPhase;
    document.body.dataset.car = this.snapshot.carLocation;
    document.body.dataset.segment = this.snapshot.segmentId;
    if (this.snapshot.phase === 'menu') {
      document.body.dataset.state = 'title';
    } else if (this.snapshot.phase === 'end') {
      document.body.dataset.state = 'gameover';
    } else if (this.snapshot.paused) {
      document.body.dataset.state = 'paused';
    } else {
      document.body.dataset.state = 'playing';
    }
  }

  private emit(): void {
    this.syncBodyDataset();
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  public getSnapshot(): EngineSnapshot {
    return this.snapshot;
  }

  public getCurrentSegmentRule(): SegmentRule {
    return (
      SEGMENT_TABLE[this.snapshot.segmentTableIndex] ??
      SEGMENT_TABLE[SEGMENT_TABLE.length - 1]!
    );
  }

  public subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onPassingTrainTrigger(cb: () => void): () => void {
    this.passingTrainListeners.add(cb);
    return () => {
      this.passingTrainListeners.delete(cb);
    };
  }

  public onTier3Tear(cb: () => void): () => void {
    this.tier3TearListeners.add(cb);
    return () => {
      this.tier3TearListeners.delete(cb);
    };
  }

  public onRestraintWhisper(cb: () => void): () => void {
    this.restraintWhisperListeners.add(cb);
    return () => {
      this.restraintWhisperListeners.delete(cb);
    };
  }

  private forceParentLook(): 'Mom' | 'Dad' {
    const chosen: 'Mom' | 'Dad' = Math.random() < 0.5 ? 'Mom' : 'Dad';
    this.forcedWatcherLabel = chosen;
    this.forcedWatcherRemainingSec = 3.0;
    return chosen;
  }

  public showSubtitle(item: Omit<SubtitleItem, 'id'>, durationSec = 4.2): void {
    this.subtitleRemainingSec = durationSec;
    this.update({
      subtitle: {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    });
  }

  public showRollsign(banner: RollsignBanner, durationSec = ROLLSIGN_DISPLAY_SEC): void {
    this.rollsignRemainingSec = durationSec;
    this.update({ rollsign: banner });
  }

  public triggerParanoidFlash(customWord?: string): void {
    const word =
      customWord ??
      PARANOID_UI_WORDS[Math.floor(Math.random() * PARANOID_UI_WORDS.length)] ??
      'SAY NOTHING';
    this.paranoidFlashRemainingSec = 0.7;
    this.update({ paranoidFlashText: word });
  }

  public update(patch: Partial<EngineSnapshot>): EngineSnapshot {
    const segRule =
      SEGMENT_TABLE[patch.segmentTableIndex ?? this.snapshot.segmentTableIndex] ??
      SEGMENT_TABLE[0]!;
    const stopNum = segRule.stopNumber;
    const restraintBonus =
      patch.restraintCeilingBonus ?? this.snapshot.restraintCeilingBonus;

    const nextSanity =
      typeof patch.sanity === 'number'
        ? clampSanityForStop(patch.sanity, stopNum, restraintBonus)
        : this.snapshot.sanity;

    const rawSuspicion =
      typeof patch.suspicion === 'number'
        ? Math.max(0, Math.round(patch.suspicion))
        : this.snapshot.suspicion;

    const nextPeakSuspicion = Math.max(
      patch.peakSuspicion ?? this.snapshot.peakSuspicion,
      Math.min(SUSPICION_INTERVENTION_THRESHOLD, rawSuspicion)
    );

    // Check if suspicion hit 60 -> Concerned Intervention (resets to 40, sanity -5)
    const intervention = evaluateSuspicionIntervention(rawSuspicion);
    const finalSuspicion = intervention.nextSuspicion;
    const finalSanity = intervention.intervened
      ? clampSanityForStop(nextSanity + intervention.sanityDelta, stopNum, restraintBonus)
      : nextSanity;
    const finalInterventionsCount =
      (patch.interventionsCount ?? this.snapshot.interventionsCount) +
      (intervention.intervened ? 1 : 0);

    this.snapshot = {
      ...this.snapshot,
      ...patch,
      sanity: finalSanity,
      sanityTier: computeSanityTier(finalSanity),
      suspicion: finalSuspicion,
      peakSuspicion: nextPeakSuspicion,
      interventionsCount: finalInterventionsCount,
      lastReactionReason: intervention.intervened
        ? intervention.eventLabel
        : (patch.lastReactionReason ?? this.snapshot.lastReactionReason),
    };

    const nextSanityRetained =
      patch.sanityRetainedPercent ??
      computeSanityRetainedPercent({
        stopDecisions: this.snapshot.stopDecisions,
        finalSanity: this.snapshot.sanity,
        restraintHeld: this.snapshot.restraintHeld,
      });
    const nextAnomalyAccuracy =
      patch.anomalyAccuracyPercent ??
      computeAnomalyAccuracyPercent(
        this.snapshot.anomaliesCaughtCount,
        this.snapshot.anomaliesSpawnedCount
      );
    this.snapshot.sanityRetainedPercent = nextSanityRetained;
    this.snapshot.anomalyAccuracyPercent = nextAnomalyAccuracy;

    if (!this.snapshot.isPracticeRun && !this.snapshot.isDebugRun) {
      const archive = settingsStore.getArchive();
      const nextAchievements = evaluateUnlockedAchievements({
        existingUnlockedIds: archive.unlockedAchievements,
        documentedAnomaliesCount: archive.documentedAnomalies.length,
        anomaliesCaughtCount: this.snapshot.anomaliesCaughtCount,
        rideAnomalies: this.snapshot.rideAnomalies,
        photos: this.snapshot.photos,
        tapes: this.snapshot.tapes,
        hasSecretBroadcasterEvp: this.snapshot.hasSecretBroadcasterEvp,
        trestleWitnessed: this.snapshot.trestleWitnessed,
        rideCompleted: this.snapshot.phase === 'end',
        steppedOffAtBait: this.snapshot.steppedOffAtBait,
        peakSuspicion: this.snapshot.peakSuspicion,
        resolvedEnding: this.snapshot.resolvedEnding,
      });
      if (nextAchievements.length !== archive.unlockedAchievements.length) {
        settingsStore.updateArchive({
          unlockedAchievements: nextAchievements,
        });
      }
    }

    if (intervention.intervened) {
      this.subtitleRemainingSec = 4.6;
      this.snapshot.subtitle = {
        id: `intervention-${Date.now()}`,
        speaker: 'Dad',
        text: 'Hey. Look at me. Both of us, right now. Talk to us. What is going on with you?',
      };
    }

    this.emit();
    return this.snapshot;
  }

  /**
   * Records a visible reaction while a parent is watching (+10 Suspicion).
   */
  public recordVisibleReaction(reason: string): void {
    this.update({
      suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.VISIBLE_REACTION,
      lastReactionReason: reason,
    });
  }

  /**
   * Starts a parent mask check question (1 / 2 / 3 options).
   */
  public triggerMaskCheck(overrideDef?: MaskCheckDefinition): void {
    const pool = selectMaskCheckPool(this.snapshot.sanityTier, this.snapshot.suspicion);
    const unused = pool.filter((d) => !this.usedMaskCheckIds.has(d.id));
    const candidates = unused.length > 0 ? unused : pool;
    const chosen =
      overrideDef ??
      candidates[Math.floor(Math.random() * candidates.length)] ??
      pool[0]!;

    this.usedMaskCheckIds.add(chosen.id);
    const activeCheck = buildActiveMaskCheck(chosen);

    if (this.snapshot.sanityTier === 'Low' || this.snapshot.sanityTier === 'Critical') {
      this.triggerParanoidFlash();
    }

    this.update({
      activeMaskCheck: activeCheck,
      watchingParentLabel: activeCheck.speakerLabel,
      subtitle: {
        id: activeCheck.id,
        speaker: activeCheck.speakerLabel,
        text: activeCheck.question,
      },
    });
    this.subtitleRemainingSec = activeCheck.totalSec;
  }

  /**
   * Player answers an active parent mask check (index 0, 1, or 2).
   */
  public answerMaskCheck(optionIndex: 0 | 1 | 2): void {
    const check = this.snapshot.activeMaskCheck;
    if (!check) {
      if (this.snapshot.phase === 'ride' && !this.snapshot.paused) {
        const reply =
          DAD_UNASKED_ANSWERS[optionIndex % DAD_UNASKED_ANSWERS.length] ??
          DAD_UNASKED_ANSWERS[0];
        this.showSubtitle(
          {
            speaker: 'Dad',
            text: reply,
          },
          3.2
        );
      }
      return;
    }
    const option = check.options[optionIndex];
    if (!option) return;

    if (this.snapshot.phase === 'intro' && this.snapshot.tutorialState) {
      if (option.isCalm) {
        this.update({
          activeMaskCheck: null,
          watchingParentLabel: null,
          tutorialState: {
            ...this.snapshot.tutorialState,
            feedbackText: TUTORIAL_STRINGS.STEP_2_CALM_FEEDBACK,
          },
        });
        this.showSubtitle(
          {
            speaker: 'You',
            text: option.text,
            stageDirection: '(Mom nods.)',
          },
          3.2
        );
      } else {
        this.update({
          tutorialState: {
            ...this.snapshot.tutorialState,
            feedbackText: TUTORIAL_STRINGS.STEP_2_ODD_FEEDBACK,
          },
        });
        this.showSubtitle(
          {
            stageDirection: 'Mom keeps looking at you.',
            text: TUTORIAL_STRINGS.STEP_2_ODD_FEEDBACK,
          },
          3.8
        );
      }
      return;
    }

    if (option.isCalm) {
      this.update({
        activeMaskCheck: null,
      });
      this.showSubtitle(
        {
          speaker: 'You',
          text: option.text,
        },
        2.8
      );
    } else {
      const reason = `Gave an odd answer to ${check.speakerLabel}`;
      this.update({
        activeMaskCheck: null,
        suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.MASK_FAIL,
        sanity: this.snapshot.sanity + SANITY_DELTAS.MASK_FAIL,
        lastReactionReason: reason,
      });
      if (this.snapshot.suspicion !== 40) {
        // Only show mask fail subtitle if intervention didn't override it
        this.showSubtitle(
          {
            stageDirection: `${check.speakerLabel} keeps looking at you.`,
            text: '',
          },
          3.5
        );
      }
    }
  }

  private handleMaskCheckTimeout(): void {
    const check = this.snapshot.activeMaskCheck;
    if (!check) return;
    const reason = `Hesitated when ${check.speakerLabel} asked a question`;
    this.update({
      activeMaskCheck: null,
      suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.ANSWER_TIMEOUT,
      sanity: this.snapshot.sanity + SANITY_DELTAS.TIMEOUT,
      lastReactionReason: reason,
    });
    if (this.snapshot.suspicion !== 40) {
      this.showSubtitle(
        {
          stageDirection: 'You don’t answer fast enough.',
          speaker: check.speakerLabel,
          text: 'Hon?',
        },
        3.6
      );
    }
  }

  public syncPlayerPose(x: number, z: number, yaw: number, pitch: number): void {
    const nextLoc = resolveConsistLocation(x);
    const nextNearDoor = isNearGangwayDoor(x);
    const settings = settingsStore.get();

    // Evaluate head-whip reaction while a parent is watching
    const kinState = playerController.getState();
    const whipResult = evaluateHeadWhipReaction({
      angularSpeedRadS: kinState.angularSpeedRadS,
      cumulativeTouchTurnRad: kinState.touchTurnAccumRad,
      isTouchDrag: kinState.lastInputSource === 'touch',
      watchingParentLabel: this.snapshot.watchingParentLabel,
      cooldownRemainingSec: this.headWhipCooldownSec,
    });

    if (whipResult.triggered && whipResult.reason) {
      this.headWhipCooldownSec = whipResult.nextCooldownSec;
      this.recordVisibleReaction(whipResult.reason);
    }

    const locChanged =
      nextLoc !== this.snapshot.carLocation || nextNearDoor !== this.snapshot.nearGangwayDoor;
    const debugNeedsCoords =
      settings.debugOverlay &&
      (Math.abs(x - this.snapshot.playerX) > 0.05 ||
        Math.abs(z - this.snapshot.playerZ) > 0.05 ||
        Math.abs(yaw - this.snapshot.playerYaw) > 0.05);

    this.snapshot.playerX = Number(x.toFixed(2));
    this.snapshot.playerZ = Number(z.toFixed(2));
    this.snapshot.playerYaw = Number(yaw.toFixed(2));
    this.snapshot.playerPitch = Number(pitch.toFixed(2));

    if (locChanged || debugNeedsCoords) {
      this.snapshot = {
        ...this.snapshot,
        carLocation: nextLoc,
        nearGangwayDoor: nextNearDoor,
      };
      this.emit();
    }
  }

  public setPhase(phase: GamePhase): void {
    this.update({ phase, paused: false });
  }

  /**
   * Spawns an unmanifested (or force-manifested) anomaly for the current stretch.
   */
  public spawnStretchAnomaly(
    overrideId?: AnomalyId,
    forceManifest = false
  ): ActiveAnomalyInstance | null {
    const seg = this.getCurrentSegmentRule();
    const chosenId =
      overrideId ??
      selectAnomalyIdForStretch({
        segmentRule: seg,
        sanityTier: this.snapshot.sanityTier,
        alreadyUsedIds: Array.from(this.usedAnomalyIds),
      });

    if (!chosenId) {
      this.update({ activeAnomaly: null });
      return null;
    }

    this.usedAnomalyIds.add(chosenId);
    const instance = buildActiveAnomalyInstance(chosenId);
    this.staringAtAnomalySec = 0;
    this.photographedAnomalyInStretch = false;

    if (forceManifest) {
      this.update({ activeAnomaly: instance });
      return this.manifestActiveAnomaly();
    }

    this.update({ activeAnomaly: instance });
    return instance;
  }

  /**
   * Manifests the currently scheduled anomaly in the 3D scene and records it as witnessed.
   */
  public manifestActiveAnomaly(): ActiveAnomalyInstance | null {
    const current = this.snapshot.activeAnomaly;
    if (!current || current.manifested) return current;

    const seg = this.getCurrentSegmentRule();
    const manifested: ActiveAnomalyInstance = {
      ...current,
      manifested: true,
    };

    const nextRecord: RideAnomalyRecord = {
      id: manifested.id,
      title: manifested.title,
      psychClass: manifested.psychClass,
      stopNumber: seg.stopNumber,
      segmentId: seg.id,
      reportDescription: manifested.reportDescription,
      caught: false,
    };

    const nextRideAnomalies = [...this.snapshot.rideAnomalies, nextRecord];

    if (!this.snapshot.isPracticeRun && !this.snapshot.isDebugRun) {
      const archive = settingsStore.getArchive();
      if (
        !archive.documentedAnomalies.includes(manifested.id) &&
        !archive.unconfirmedAnomalies.includes(manifested.id)
      ) {
        settingsStore.updateArchive({
          unconfirmedAnomalies: [...archive.unconfirmedAnomalies, manifested.id],
        });
      }
    }

    this.update({
      activeAnomaly: manifested,
      anomaliesSpawnedCount: this.snapshot.anomaliesSpawnedCount + 1,
      rideAnomalies: nextRideAnomalies,
    });

    if (manifested.id === 'dad_answering' && manifested.dadLine) {
      this.showSubtitle(
        {
          speaker: 'Dad',
          text: manifested.dadLine,
        },
        3.8
      );
    }

    if (manifested.tierIndex === 3) {
      for (const cb of this.tier3TearListeners) cb();
      this.triggerParanoidFlash('LOOK AWAY');
    }

    return manifested;
  }

  /**
   * Catches the currently manifested anomaly (via 0.7 s Flag hold or Polaroid photo).
   * Flagging is private and NEVER raises parent suspicion.
   */
  public catchActiveAnomaly(caughtByPhoto = false): boolean {
    const current = this.snapshot.activeAnomaly;
    if (!current || !current.manifested || current.caught) return false;

    const caughtInstance: ActiveAnomalyInstance = {
      ...current,
      caught: true,
    };

    const updatedRideAnomalies = this.snapshot.rideAnomalies.map((rec, idx, arr) =>
      idx === arr.length - 1 && rec.id === current.id
        ? { ...rec, caught: true, caughtByPhoto }
        : rec
    );

    if (!this.snapshot.isPracticeRun && !this.snapshot.isDebugRun) {
      const archive = settingsStore.getArchive();
      const nextDoc = archive.documentedAnomalies.includes(current.id)
        ? archive.documentedAnomalies
        : [...archive.documentedAnomalies, current.id];
      const nextUnconf = archive.unconfirmedAnomalies.filter((id) => id !== current.id);
      settingsStore.updateArchive({
        documentedAnomalies: nextDoc,
        unconfirmedAnomalies: nextUnconf,
      });
    }

    this.update({
      activeAnomaly: caughtInstance,
      anomaliesCaughtCount: this.snapshot.anomaliesCaughtCount + 1,
      rideAnomalies: updatedRideAnomalies,
      flagHoldProgress: 0,
      isFlagHolding: false,
      sanity: this.snapshot.sanity + SANITY_DELTAS.CATCH,
    });

    return true;
  }

  /**
   * Sets whether the player is holding the Flag key (F) or on-screen FLAG button.
   */
  public setFlagHolding(holding: boolean): void {
    if (this.snapshot.isFlagHolding === holding) return;
    this.update({
      isFlagHolding: holding,
      flagHoldProgress: holding ? this.snapshot.flagHoldProgress : 0,
    });
  }

  /**
   * Raises or lowers the Polaroid 600 camera (C key or Camera HUD button).
   */
  public toggleCamera(force?: boolean): void {
    if (this.snapshot.phase === 'menu' || this.snapshot.phase === 'end') return;
    if (this.snapshot.activeMaskCheck) {
      this.showSubtitle({ text: 'Answer first.' }, 2.0);
      return;
    }
    if (this.snapshot.activeRestraint) {
      this.showSubtitle({ text: 'Not now. Keep holding.' }, 2.0);
      return;
    }

    const nextOpen = typeof force === 'boolean' ? force : !this.snapshot.cameraOpen;
    this.update({
      cameraOpen: nextOpen,
      evpOpen: nextOpen ? false : this.snapshot.evpOpen,
      albumOpen: nextOpen ? false : this.snapshot.albumOpen,
      evpIsRecording: nextOpen ? false : this.snapshot.evpIsRecording,
    });
  }

  /**
   * Snaps a Polaroid 600 square photo.
   * - Consumes 1 of the 8 starting shots (max 10) with a 0.9 s shutter cooldown.
   * - Triggers white flash overlay.
   * - Records framed anomalies silently and scores them at the next stop.
   * - If a parent is watching, adds +10 Suspicion ("Took a flash photo while ${watcher} was watching").
   *   If no parent is watching, 50% chance one turns to look.
   */
  public snapPolaroidPhoto(sourceCanvas?: HTMLCanvasElement | null): boolean {
    if (this.shutterCooldownSec > 0) {
      return false;
    }
    if (
      this.snapshot.polaroidShotsRemaining <= 0 ||
      this.snapshot.photos.length >= POLAROID_MAX_SHOTS
    ) {
      this.showSubtitle({ text: 'Out of film.' }, 2.2);
      return false;
    }

    this.shutterCooldownSec = SHUTTER_COOLDOWN;

    const seg = this.getCurrentSegmentRule();
    const camY = playerController.getState().y || 1.24;
    const framedAnomaly = isAnomalyFramedInViewfinder({
      activeAnomaly: this.snapshot.activeAnomaly,
      playerX: this.snapshot.playerX,
      playerEyeY: camY,
      playerZ: this.snapshot.playerZ,
      playerYaw: this.snapshot.playerYaw,
      playerPitch: this.snapshot.playerPitch,
    })
      ? this.snapshot.activeAnomaly
      : null;

    if (framedAnomaly) {
      this.photographedAnomalyInStretch = true;
    }

    const dataUrl = captureSquarePolaroidDataUrl({
      sourceCanvas,
      stopNumber: seg.stopNumber,
      stationName: this.snapshot.nextStationName,
      anomalyTitle: framedAnomaly ? framedAnomaly.title : null,
    });

    const newPhoto = buildPolaroidPhotoRecord({
      photoIndex: this.snapshot.photos.length + 1,
      stopNumber: seg.stopNumber,
      stationName: this.snapshot.nextStationName,
      carLocation: this.snapshot.carLocation,
      routeId: this.snapshot.activeRoute,
      capturedAnomaly: framedAnomaly,
      dataUrl,
      capturedAtSec: this.snapshot.segmentElapsedSec,
      developed: false,
    });

    const watcher = this.snapshot.watchingParentLabel;
    let nextWatcher = watcher;
    if (!watcher && Math.random() < 0.5) {
      nextWatcher = this.forceParentLook();
    }
    const nextSuspicion = watcher
      ? this.snapshot.suspicion + SUSPICION_DELTAS.CAMERA_FLASH_WATCHED
      : this.snapshot.suspicion;
    const nextReason = watcher
      ? `Took a flash photo while ${watcher} was watching`
      : this.snapshot.lastReactionReason;

    this.update({
      polaroidShotsRemaining: this.snapshot.polaroidShotsRemaining - 1,
      polaroidFlashIntensity: 1.0,
      photos: [...this.snapshot.photos, newPhoto],
      watchingParentLabel: nextWatcher,
      suspicion: nextSuspicion,
      lastReactionReason: nextReason,
    });

    return Boolean(framedAnomaly);
  }

  /**
   * Opens or closes the Evidence Log album modal (Tab key or Evidence log HUD button).
   */
  public toggleAlbum(force?: boolean): void {
    if (this.snapshot.phase === 'menu') return;
    const nextOpen = typeof force === 'boolean' ? force : !this.snapshot.albumOpen;
    if (nextOpen) {
      pointerLock.unlock({ quiet: true });
    }
    this.update({
      albumOpen: nextOpen,
      cameraOpen: nextOpen ? false : this.snapshot.cameraOpen,
      evpOpen: nextOpen ? false : this.snapshot.evpOpen,
    });
  }

  /**
   * Raises or lowers Dad's EVP microcassette recorder (R key or Tape recorder HUD button).
   */
  public toggleEvpRecorder(force?: boolean): void {
    if (this.snapshot.phase === 'menu' || this.snapshot.phase === 'end') return;
    if (!this.snapshot.hasRecorder) {
      this.showSubtitle({ text: 'You don’t have anything to record with.' }, 2.4);
      return;
    }
    if (this.snapshot.activeMaskCheck) {
      this.showSubtitle({ text: 'Answer first.' }, 2.0);
      return;
    }
    if (this.snapshot.activeRestraint) {
      this.showSubtitle({ text: 'Not now. Keep holding.' }, 2.0);
      return;
    }

    const nextOpen = typeof force === 'boolean' ? force : !this.snapshot.evpOpen;
    const raising = nextOpen && !this.snapshot.evpOpen;
    if (raising || !nextOpen) {
      this.evpListenElapsedSec = 0;
      this.evpLastLockedId = null;
    }

    const seg = this.getCurrentSegmentRule();
    const evalRes = evaluateEvpTuning({
      frequencyMhz: this.snapshot.evpFrequencyMhz,
      trainSpeedMps: this.snapshot.trainSpeedMps,
      route: this.snapshot.activeRoute,
      isAboveGround: this.snapshot.isOnTrestle || this.snapshot.isOpenAirStation,
      stopNumber: seg.stopNumber,
      listenElapsedSec: this.evpListenElapsedSec,
    });
    this.evpLastLockedId = evalRes.lockedSpec ? evalRes.lockedSpec.id : null;

    const watcher = this.snapshot.watchingParentLabel;
    const raisedWhileWatched = Boolean(raising && watcher);

    this.update({
      evpOpen: nextOpen,
      cameraOpen: nextOpen ? false : this.snapshot.cameraOpen,
      albumOpen: nextOpen ? false : this.snapshot.albumOpen,
      evpIsRecording: nextOpen ? this.snapshot.evpIsRecording : false,
      evpRecordProgress: nextOpen ? this.snapshot.evpRecordProgress : 0,
      evpSignalStrength: evalRes.signalStrength,
      evpLockedSignalId: evalRes.lockedSpec ? evalRes.lockedSpec.id : null,
      evpLockedTitle: evalRes.lockedTitle,
      evpTranscriptLive: evalRes.liveTranscript,
      suspicion: raisedWhileWatched
        ? this.snapshot.suspicion + SUSPICION_DELTAS.RECORDER_RAISED_WATCHED
        : this.snapshot.suspicion,
      lastReactionReason: raisedWhileWatched
        ? `Held up a tape recorder while ${watcher} was watching`
        : this.snapshot.lastReactionReason,
    });
  }

  /**
   * Steps the EVP dial frequency by `deltaSteps * 1 kHz`.
   */
  public stepEvpFrequency(deltaSteps: number): void {
    const nextFreq = clampEvpFrequency(
      this.snapshot.evpFrequencyMhz + deltaSteps * EVP_FREQ_STEP_MHZ
    );
    this.setEvpFrequency(nextFreq);
  }

  /**
   * Sets the EVP dial frequency directly and updates signal lock state.
   */
  public setEvpFrequency(freqMhz: number): void {
    const clamped = clampEvpFrequency(freqMhz);
    const seg = this.getCurrentSegmentRule();
    const prelimRes = evaluateEvpTuning({
      frequencyMhz: clamped,
      trainSpeedMps: this.snapshot.trainSpeedMps,
      route: this.snapshot.activeRoute,
      isAboveGround: this.snapshot.isOnTrestle || this.snapshot.isOpenAirStation,
      stopNumber: seg.stopNumber,
      listenElapsedSec: 0,
    });
    const nextLockedId = prelimRes.lockedSpec ? prelimRes.lockedSpec.id : null;
    if (nextLockedId !== this.evpLastLockedId) {
      this.evpListenElapsedSec = 0;
      this.evpLastLockedId = nextLockedId;
    }
    const evalRes = evaluateEvpTuning({
      frequencyMhz: clamped,
      trainSpeedMps: this.snapshot.trainSpeedMps,
      route: this.snapshot.activeRoute,
      isAboveGround: this.snapshot.isOnTrestle || this.snapshot.isOpenAirStation,
      stopNumber: seg.stopNumber,
      listenElapsedSec: this.evpListenElapsedSec,
    });

    this.update({
      evpFrequencyMhz: clamped,
      evpSignalStrength: evalRes.signalStrength,
      evpLockedSignalId: evalRes.lockedSpec ? evalRes.lockedSpec.id : null,
      evpLockedTitle: evalRes.lockedTitle,
      evpTranscriptLive: evalRes.liveTranscript,
      evpRecordProgress: 0,
    });
  }

  /**
   * Starts or stops holding Record on the EVP microcassette recorder.
   */
  public setEvpRecording(recording: boolean): void {
    if (!this.snapshot.evpOpen && recording) return;
    if (this.snapshot.evpIsRecording === recording) return;
    this.update({
      evpIsRecording: recording,
      evpRecordProgress: recording ? this.snapshot.evpRecordProgress : 0,
    });
  }

  /**
   * Plays or stops a recorded EVP tape in the Evidence Log or HUD.
   * Playing a tape out loud adds +10 Suspicion only if a parent is already watching when the tape starts;
   * if no parent is watching, there is a 50% chance one turns to look.
   */
  public toggleTapePlayback(tapeId: EvpSignalId): void {
    const isAlreadyPlaying = this.snapshot.playingTapeId === tapeId;
    const nextPlaying = isAlreadyPlaying ? null : tapeId;

    const watcher = this.snapshot.watchingParentLabel;
    const playedWhileWatched = Boolean(nextPlaying && watcher);
    let nextWatcher = watcher;
    if (nextPlaying && !watcher && Math.random() < 0.5) {
      nextWatcher = this.forceParentLook();
    }

    this.update({
      playingTapeId: nextPlaying,
      watchingParentLabel: nextWatcher,
      suspicion: playedWhileWatched
        ? this.snapshot.suspicion + SUSPICION_DELTAS.TAPE_PLAYED_WATCHED
        : this.snapshot.suspicion,
      lastReactionReason: playedWhileWatched
        ? `Played a tape out loud while ${watcher} was watching`
        : this.snapshot.lastReactionReason,
    });
  }

  /**
   * Starts the Stop 11 Greenpoint Av Restraint moment (5.0 s start window, 15.0 s hold).
   */
  public triggerRestraintMoment(): void {
    const isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const promptText = isTouch
      ? 'Hold the button. Don’t let go. Don’t react.'
      : 'Hold Space. Don’t let go. Don’t react.';

    const restraintState: ActiveRestraintState = {
      active: true,
      isHolding: false,
      hasStartedHolding: false,
      elapsedSec: 0,
      graceRemainingSec: 0,
      holdProgress: 0,
      dimOpacity: 0,
      momFrozen: false,
      strangersVanished: false,
    };

    this.restraintTriggeredInSegment = true;
    this.restraintBeat15Played = false;
    this.restraintBeat40Played = false;
    this.restraintBeat70Played = false;
    this.restraintBeat105Played = false;

    this.update({
      activeRestraint: restraintState,
      activeMaskCheck: null,
      watchingParentLabel: 'Mom',
      lightFlickerIntensity: 0.08,
      isFlagHolding: false,
      flagHoldProgress: 0,
    });
    this.showSubtitle(
      {
        speaker: 'Mom',
        stageDirection: '(her mouth doesn’t move)',
        text: promptText,
      },
      3.5
    );
  }

  /**
   * Grants the 2.5 s grace window ONLY after pause, alt-tab, or focus loss.
   */
  public notifyFocusLoss(): void {
    const cur = this.snapshot.activeRestraint;
    if (!cur || !cur.active) return;
    this.update({
      activeRestraint: {
        ...cur,
        isHolding: false,
        graceRemainingSec: RESTRAINT_GRACE_SECONDS,
      },
    });
  }

  private failRestraint(reasonText: 'You let go' | 'You couldn’t keep it together'): void {
    this.update({
      activeRestraint: null,
      restraintHeld: false,
      restraintCompleted: true,
      sanity: this.snapshot.sanity + SANITY_DELTAS.RESTRAINT_FAIL,
      suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.MASK_FAIL,
      lastReactionReason: 'Lost your composure during the restraint moment',
      watchingParentLabel: null,
      lightFlickerIntensity: 1.0,
      isFlagHolding: false,
      flagHoldProgress: 0,
    });
    if (this.snapshot.suspicion !== 40) {
      this.showSubtitle(
        {
          stageDirection: 'You flinch. Dad sees it.',
          text: reasonText,
        },
        3.8
      );
    }
  }

  /**
   * Sets whether the player is holding Space / the Hold steady button during Stop 11 Restraint.
   */
  public setRestraintHolding(holding: boolean): void {
    const cur = this.snapshot.activeRestraint;
    if (!cur || !cur.active || cur.isHolding === holding) return;

    if (holding) {
      this.update({
        activeRestraint: {
          ...cur,
          isHolding: true,
          hasStartedHolding: true,
          graceRemainingSec: 0,
        },
      });
      return;
    }

    if (cur.graceRemainingSec > 0) {
      this.update({
        activeRestraint: {
          ...cur,
          isHolding: false,
        },
      });
      return;
    }

    if (cur.hasStartedHolding) {
      this.failRestraint('You let go');
      return;
    }

    this.update({
      activeRestraint: {
        ...cur,
        isHolding: false,
      },
    });
  }

  /**
   * Completes the Stop 6 Safe Haven platform pause and returns to the train for segment 6b.
   */
  public completeSafeHaven(): void {
    if (this.snapshot.phase !== 'haven') return;
    const route = this.snapshot.activeRoute;
    const nextIdx = Math.min(
      SEGMENT_TABLE.length - 1,
      this.snapshot.segmentTableIndex + 1
    );
    this.enterSegment(nextIdx);
    this.showSubtitle(
      {
        speaker: 'Dad',
        text: formatRouteText(
          'Feels good to stand up, right? Couple more stops after this. Then {terminus}.',
          route
        ),
        stageDirection: 'You get back on with them.',
      },
      4.5
    );
  }

  /**
   * Enters the False Stop Trial room at Stage 1 ("Find the way back. The signs lie. Watch the lights when the chime plays.").
   */
  public enterTrialRoom(stopNumber?: number): void {
    const seg = this.getCurrentSegmentRule();
    const trial: TrialState = {
      stage: 1,
      stopNumber: stopNumber ?? seg.stopNumber,
      depth: 1,
      steadyStairIndex: 1,
      steadyTrainSide: 'right',
      feedbackText:
        'Find the way back. The signs lie. Watch the lights when the chime plays.',
    };

    pointerLock.unlock({ quiet: true });
    playerController.resetToSeat();

    this.update({
      phase: 'trial',
      trialState: trial,
      trainSpeedMps: 0,
      activeMaskCheck: null,
      watchingParentLabel: null,
      subtitle: {
        id: `trial-start-${Date.now()}`,
        text: trial.feedbackText ?? '',
      },
    });
    this.subtitleRemainingSec = 6.0;
  }

  /**
   * Resolves a player choice inside the 3-stage False Stop Trial room:
   * - Stage 1 (Signs): 'opposite_sign' ("To {opposite} trains") is correct because the signs lie.
   * - Stage 2 (Stairs): 'middle_stairs' (steadyStairIndex === 1) has steady light and leads to the platform edge.
   * - Stage 3 (Trains): 'right_train' (steadyTrainSide === 'right') has steady light when the chime plays and returns you to the car.
   */
  public chooseTrialOption(choice: TrialChoiceId): void {
    const trial = this.snapshot.trialState;
    if (this.snapshot.phase !== 'trial' || !trial) return;

    if (trial.stage === 1) {
      if (choice === 'opposite_sign') {
        const nextTrial: TrialState = {
          ...trial,
          stage: 2,
          feedbackText: 'The stairs go down to another platform.',
        };
        this.update({ trialState: nextTrial });
        this.showSubtitle(
          {
            stageDirection: 'The stairs go down to another platform.',
            text: '',
          },
          3.8
        );
      } else {
        const nextTrial: TrialState = {
          ...trial,
          stage: 1,
          depth: trial.depth + 1,
          feedbackText:
            'The stairs bring you back up onto the same platform. It’s quieter now.',
        };
        this.update({ trialState: nextTrial });
        this.showSubtitle(
          {
            stageDirection:
              'The stairs bring you back up onto the same platform. It’s quieter now.',
            text: '',
          },
          3.8
        );
      }
      return;
    }

    if (trial.stage === 2) {
      const stairIdx =
        choice === 'left_stairs' ? 0 : choice === 'middle_stairs' ? 1 : 2;
      if (stairIdx === trial.steadyStairIndex) {
        const nextTrial: TrialState = {
          ...trial,
          stage: 3,
          feedbackText: 'You come out at the platform edge. Two trains are coming.',
        };
        this.update({ trialState: nextTrial });
        this.showSubtitle(
          {
            stageDirection:
              'You come out at the platform edge. Two trains are coming.',
            text: '',
          },
          4.0
        );
      } else {
        const nextTrial: TrialState = {
          ...trial,
          stage: 1,
          depth: trial.depth + 1,
          feedbackText:
            'The stairs bring you back up onto the same platform. It’s quieter now.',
        };
        this.update({ trialState: nextTrial });
        this.showSubtitle(
          {
            stageDirection:
              'The stairs bring you back up onto the same platform. It’s quieter now.',
            text: '',
          },
          3.8
        );
      }
      return;
    }

    if (trial.stage === 3) {
      const chosenSide = choice === 'left_train' ? 'left' : 'right';
      if (chosenSide === trial.steadyTrainSide) {
        const record: FalseStopTrialRecord = {
          stop: trial.stopNumber,
          depth: trial.depth,
        };
        const nextTrials = [...this.snapshot.falseStopTrials, record];
        const nextIdx = Math.min(
          SEGMENT_TABLE.length - 1,
          this.snapshot.segmentTableIndex + 1
        );

        this.update({
          trialState: null,
          falseStopTrials: nextTrials,
          sanity: this.snapshot.sanity + SANITY_DELTAS.TRIAL,
          lastReactionReason: 'Returned from a False Stop Trial',
        });

        this.enterSegment(nextIdx);

        if (trial.depth > 1) {
          this.showSubtitle(
            {
              stageDirection: 'You don’t remember getting back on.',
              speaker: 'Mom',
              text: 'Oh my god. Where were you? Sit. Stay where we can see you.',
            },
            4.6
          );
        } else {
          this.showSubtitle(
            {
              speaker: 'Mom',
              text: 'Where did you go?! You can’t just walk off like that!',
            },
            4.4
          );
        }
      } else {
        const nextTrial: TrialState = {
          ...trial,
          stage: 2,
          depth: trial.depth + 1,
          feedbackText: 'The doors close on nothing. You’re back on the stairs.',
        };
        this.update({ trialState: nextTrial });
        this.showSubtitle(
          {
            stageDirection:
              'The doors close on nothing. You’re back on the stairs.',
            text: '',
          },
          3.8
        );
      }
    }
  }

  private recordStopDecision(seg: SegmentRule, steppedOff: boolean): void {
    const route = this.snapshot.activeRoute;
    const stationName = getStopName(route, seg.stationIndex);
    const band = SANITY_BANDS_BY_STOP[seg.stopNumber] ?? [0, 100];
    const maxBand = Math.min(100, band[1] + this.snapshot.restraintCeilingBonus);

    const record: StopDecisionRecord = {
      segmentId: seg.id,
      stopNumber: seg.stopNumber,
      stationName,
      stopType: seg.stopType,
      doorTell: seg.doorTell,
      steppedOff,
      sanityAfter: this.snapshot.sanity,
      sanityBandMin: band[0],
      sanityBandMax: maxBand,
    };

    this.snapshot = {
      ...this.snapshot,
      stopDecisions: [...this.snapshot.stopDecisions, record],
    };
  }

  /**
   * Starts the interactive 4-step Practice Stretch tutorial (`intro` phase).
   * "That’s the practice stretch. Nothing in it counted. Your ride to Court Square starts now."
   */
  public startPracticeStretch(): void {
    const isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const stickerAnomaly = buildActiveAnomalyInstance('window_residue', () => 0.1);
    playerController.resetToSeat();
    pointerLock.clearErrorHint();

    this.update({
      phase: 'intro',
      rideSubPhase: 'cruising',
      paused: false,
      trainSpeedMps: 12.0,
      tutorialState: buildTutorialStepState('look_around', isTouch),
      activeAnomaly: {
        ...stickerAnomaly,
        manifested: true,
      },
      activeMaskCheck: null,
      watchingParentLabel: null,
      isPracticeRun: true,
      subtitle: {
        id: 'tutorial-step-1',
        text: TUTORIAL_STRINGS.STEP_1_BODY,
      },
    });
    this.subtitleRemainingSec = 6.0;
  }

  /**
   * Advances to the next step of the interactive Practice Stretch (`look_around` -> `dont_show_it` -> `read_the_doors` -> `ready`).
   */
  public advanceTutorialStep(): void {
    if (this.snapshot.phase !== 'intro' || !this.snapshot.tutorialState) return;
    const isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const cur = this.snapshot.tutorialState.stepId;

    if (cur === 'look_around') {
      const nextStep = buildTutorialStepState('dont_show_it', isTouch);
      const maskCheck = buildTutorialMaskCheck();
      this.update({
        tutorialState: nextStep,
        activeAnomaly: null,
        activeMaskCheck: maskCheck,
        watchingParentLabel: 'Mom',
        subtitle: {
          id: 'tutorial-mom-question',
          speaker: 'Mom',
          text: maskCheck.question,
        },
      });
      this.subtitleRemainingSec = 10.0;
    } else if (cur === 'dont_show_it') {
      const nextStep = buildTutorialStepState('read_the_doors', isTouch);
      this.update({
        tutorialState: nextStep,
        activeMaskCheck: null,
        watchingParentLabel: null,
        subtitle: {
          id: 'tutorial-doors',
          text: TUTORIAL_STRINGS.STEP_3_SUMMARY_BODY,
        },
      });
      this.subtitleRemainingSec = 8.0;
    } else if (cur === 'read_the_doors') {
      const nextStep = buildTutorialStepState('ready', isTouch);
      this.update({
        tutorialState: nextStep,
        subtitle: {
          id: 'tutorial-ready',
          text: TUTORIAL_STRINGS.STEP_4_BODY,
        },
      });
      this.subtitleRemainingSec = 8.0;
    } else {
      this.finishPracticeStretch();
    }
  }

  /**
   * Finishes the Practice Stretch and starts a fresh canonical ride to Court Square.
   */
  public finishPracticeStretch(): void {
    this.startRide({ chapter: 1, practice: false });
  }

  public startRide(options?: {
    chapter?: ChapterStartOption;
    nightmare?: boolean;
    practice?: boolean;
  }): void {
    const settings = settingsStore.get();
    const chapter = options?.chapter ?? this.snapshot.startChapter;
    const isPractice = Boolean(options?.practice || chapter > 1);
    const initialSegmentTableIndex = chapter === 1 ? 0 : chapter === 2 ? 4 : 10;
    const seg = SEGMENT_TABLE[initialSegmentTableIndex] ?? SEGMENT_TABLE[0]!;
    const originStationIdx = Math.max(0, seg.stationIndex - 1);
    const initialSanity = clampSanityForStop(100, seg.stopNumber);
    const initialTier = computeSanityTier(initialSanity);

    this.frameTimeAccumMs = 0;
    this.frameSampleCount = 0;
    this.stopElapsedSec = 0;
    this.havenElapsedSec = 0;
    this.headWhipCooldownSec = 0;
    this.paranoidFlashRemainingSec = 0;
    this.nextStopPaAnnounced = false;
    this.passingTrainTriggered = false;
    this.clockSanityTickApplied = false;
    this.chatPart1Played = false;
    this.chatPart2Played = false;
    this.restraintTriggeredInSegment = false;
    this.maskChecksTriggeredInSegment = 0;
    this.usedMaskCheckIds.clear();
    this.usedAnomalyIds.clear();
    this.staringAtAnomalySec = 0;
    this.stareReactionCooldownSec = 0;
    this.falseFlagCooldownSec = 0;
    this.shutterCooldownSec = 0;
    this.photographedAnomalyInStretch = false;
    this.evpListenElapsedSec = 0;
    this.evpLastLockedId = null;
    this.forcedWatcherLabel = null;
    this.forcedWatcherRemainingSec = 0;
    this.restraintBeat15Played = false;
    this.restraintBeat40Played = false;
    this.restraintBeat70Played = false;
    this.restraintBeat105Played = false;

    reshuffleEvpFrequencies();

    playerController.resetToSeat();
    pointerLock.clearErrorHint();

    const nightmare = options?.nightmare ?? this.snapshot.nightmareMode;
    const baseDuration = seg.cruiseDurationSec ?? DEFAULT_CRUISE_DURATION_SEC;
    const durationSec = nightmare ? baseDuration / TRAIN_NIGHTMARE_SPEED_MULT : baseDuration;

    const rollsign = getChapterRollsign(chapter, 'G');
    this.rollsignRemainingSec = ROLLSIGN_DISPLAY_SEC;
    this.subtitleRemainingSec = 4.5;

    const firstAnomalyId = selectAnomalyIdForStretch({
      segmentRule: seg,
      sanityTier: initialTier,
    });
    if (firstAnomalyId) {
      this.usedAnomalyIds.add(firstAnomalyId);
    }

    this.snapshot = {
      ...this.snapshot,
      phase: 'ride',
      rideSubPhase: 'departing',
      paused: false,
      muted: settings.startMuted ? true : this.snapshot.muted,
      nightmareMode: nightmare,
      startChapter: chapter,
      activeRoute: 'G',
      segmentTableIndex: initialSegmentTableIndex,
      stopIndex: originStationIdx,
      segmentId: seg.id,
      currentStationName: getStopName('G', originStationIdx),
      nextStationName: getStopName('G', seg.stationIndex),
      isOpenAirStation: isElevatedOpenAirStop('G', seg.stationIndex),
      isOnTrestle: false,
      trestleProgress: 0,
      trestleWitnessed: false,
      trainSpeedMps: 2.0,
      segmentElapsedSec: 0,
      segmentDurationSec: durationSec,
      stationDistanceM: durationSec * TRAIN_CRUISE_SPEED_MPS,
      doorOpenProgress: 0,
      chimePlaying: false,
      activeDoorTell: seg.doorTell,
      lightFlickerIntensity: 1.0,
      rollsign,
      subtitle: {
        id: 'boarding-pa',
        speaker: 'PA',
        text: getBoardingPaText('G'),
        isPa: true,
      },
      selectedExit: null,
      resolvedEnding: null,
      sanityRetainedPercent: 100,
      anomalyAccuracyPercent: 100,
      tutorialState: null,
      watchingParentLabel: null,
      activeMaskCheck: null,
      paranoidFlashText: null,
      interventionsCount: 0,
      lastReactionReason: null,
      activeAnomaly: firstAnomalyId ? buildActiveAnomalyInstance(firstAnomalyId) : null,
      flagHoldProgress: 0,
      isFlagHolding: false,
      rideAnomalies: [],
      anomaliesSpawnedCount: 0,
      anomaliesCaughtCount: 0,
      falseFlagsCount: 0,
      cameraOpen: false,
      polaroidShotsRemaining: STARTING_FILM,
      polaroidFlashIntensity: 0,
      photos: [],
      albumOpen: false,
      hasRecorder: chapter >= 2,
      evpOpen: false,
      evpFrequencyMhz: EVP_FREQ_DEFAULT_MHZ,
      evpSignalStrength: 0,
      evpLockedSignalId: null,
      evpLockedTitle: null,
      evpTranscriptLive: null,
      evpIsRecording: false,
      evpRecordProgress: 0,
      evpLastSavedTitle: null,
      tapes: [],
      playingTapeId: null,
      hasConductorEvp: false,
      hasSecretBroadcasterEvp: false,
      safeHavenVisited: false,
      trialState: null,
      falseStopTrials: [],
      activeRestraint: null,
      restraintHeld: false,
      restraintCompleted: false,
      restraintCeilingBonus: 0,
      steppedOffAtBait: false,
      stopDecisions: [],
      sanity: initialSanity,
      sanityTier: initialTier,
      suspicion: 0,
      peakSuspicion: 0,
      isPracticeRun: isPractice,
      isDebugRun: settings.debugOverlay,
      carLocation: 'CAR B (MID)',
      nearGangwayDoor: false,
      playerX: PLAYER_SEAT_X,
      playerZ: PLAYER_SEAT_Z,
      playerYaw: 0,
      playerPitch: -0.03,
    };

    if (
      settings.fullscreenOnBoard &&
      typeof document !== 'undefined' &&
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      document.documentElement.requestFullscreen().catch(() => {
        // Ignore fullscreen rejection in non-gesture or iframe contexts
      });
    }

    this.emit();
  }

  public enterSegment(tableIndex: number): void {
    const clampedIdx = Math.max(0, Math.min(SEGMENT_TABLE.length - 1, tableIndex));
    const seg = SEGMENT_TABLE[clampedIdx]!;
    const route = this.snapshot.activeRoute;
    const prevStationIndex = Math.max(0, seg.stationIndex - 1);

    const baseDuration = seg.cruiseDurationSec ?? DEFAULT_CRUISE_DURATION_SEC;
    const durationSec = this.snapshot.nightmareMode
      ? baseDuration / TRAIN_NIGHTMARE_SPEED_MULT
      : baseDuration;

    this.stopElapsedSec = 0;
    this.havenElapsedSec = 0;
    this.nextStopPaAnnounced = false;
    this.passingTrainTriggered = false;
    this.clockSanityTickApplied = false;
    this.chatPart1Played = false;
    this.chatPart2Played = false;
    this.restraintTriggeredInSegment = false;
    this.maskChecksTriggeredInSegment = 0;
    this.staringAtAnomalySec = 0;
    this.photographedAnomalyInStretch = false;
    this.evpListenElapsedSec = 0;
    this.evpLastLockedId = null;
    this.forcedWatcherLabel = null;
    this.forcedWatcherRemainingSec = 0;

    let nextRollsign = this.snapshot.rollsign;
    if (seg.id === '6') {
      nextRollsign = getChapterRollsign(2, route);
      this.rollsignRemainingSec = ROLLSIGN_DISPLAY_SEC;
    } else if (seg.id === '11') {
      nextRollsign = getChapterRollsign(3, route);
      this.rollsignRemainingSec = ROLLSIGN_DISPLAY_SEC;
    }

    // Apply DRIFT_ON_CEILING_DROP (-5) if stop band ceiling drops
    const band = SANITY_BANDS_BY_STOP[seg.stopNumber] ?? [0, 100];
    const maxBand = Math.min(100, band[1] + this.snapshot.restraintCeilingBonus);
    const driftedSanity =
      this.snapshot.sanity > maxBand
        ? this.snapshot.sanity + SANITY_DELTAS.DRIFT_ON_CEILING_DROP
        : this.snapshot.sanity;
    const nextSanity = clampSanityForStop(
      driftedSanity,
      seg.stopNumber,
      this.snapshot.restraintCeilingBonus
    );
    const nextTier = computeSanityTier(nextSanity);

    const nextAnomalyId = selectAnomalyIdForStretch({
      segmentRule: seg,
      sanityTier: nextTier,
      alreadyUsedIds: Array.from(this.usedAnomalyIds),
    });
    if (nextAnomalyId) {
      this.usedAnomalyIds.add(nextAnomalyId);
    }

    const onTrestle = route === 'G' && seg.id === '12';
    const nextTrestleWitnessed = this.snapshot.trestleWitnessed || onTrestle;

    this.update({
      phase: 'ride',
      rideSubPhase: 'departing',
      segmentTableIndex: clampedIdx,
      stopIndex: prevStationIndex,
      segmentId: seg.id,
      currentStationName: getStopName(route, prevStationIndex),
      nextStationName: getStopName(route, seg.stationIndex),
      isOpenAirStation: isElevatedOpenAirStop(route, seg.stationIndex),
      isOnTrestle: onTrestle,
      trestleProgress: 0,
      trestleWitnessed: nextTrestleWitnessed,
      trainSpeedMps: 1.5,
      segmentElapsedSec: 0,
      segmentDurationSec: durationSec,
      stationDistanceM: durationSec * TRAIN_CRUISE_SPEED_MPS,
      doorOpenProgress: 0,
      chimePlaying: false,
      activeDoorTell: seg.doorTell,
      lightFlickerIntensity: 1.0,
      rollsign: nextRollsign,
      watchingParentLabel: null,
      activeMaskCheck: null,
      activeRestraint: null,
      activeAnomaly: nextAnomalyId ? buildActiveAnomalyInstance(nextAnomalyId) : null,
      flagHoldProgress: 0,
      isFlagHolding: false,
      sanity: nextSanity,
    });

    if (!seg.silent) {
      this.showSubtitle(
        {
          speaker: 'PA',
          text: getDeparturePaText(),
          isPa: true,
        },
        3.2
      );
    }
  }

  public arriveAtCurrentStop(): void {
    const seg = this.getCurrentSegmentRule();
    const route = this.snapshot.activeRoute;
    const stationName = getStopName(route, seg.stationIndex);
    const openAir = isElevatedOpenAirStop(route, seg.stationIndex);

    this.stopElapsedSec = 0;

    // Score framed Polaroid photos together with flags at the stop
    if (
      this.photographedAnomalyInStretch &&
      this.snapshot.activeAnomaly?.manifested &&
      !this.snapshot.activeAnomaly.caught
    ) {
      this.catchActiveAnomaly(true);
    }
    this.photographedAnomalyInStretch = false;

    // If an anomaly manifested on this stretch and was NOT caught, apply SANITY_DELTAS.MISS (-5)
    const missedActiveAnomaly =
      this.snapshot.activeAnomaly?.manifested && !this.snapshot.activeAnomaly.caught;
    const caughtActiveAnomaly = Boolean(
      this.snapshot.activeAnomaly?.manifested && this.snapshot.activeAnomaly.caught
    );
    const nextSanity = missedActiveAnomaly
      ? this.snapshot.sanity + SANITY_DELTAS.MISS
      : this.snapshot.sanity;

    if (
      caughtActiveAnomaly &&
      settingsStore.get().vibrateOnCatch &&
      !settingsStore.isReducedEffectsActive() &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        navigator.vibrate(35);
      } catch {
        // Ignore vibrate errors in restricted contexts
      }
    }

    this.update({
      phase: 'stop',
      rideSubPhase: 'chime',
      stopIndex: seg.stationIndex,
      currentStationName: stationName,
      nextStationName: getStopName(route, Math.min(12, seg.stationIndex + 1)),
      isOpenAirStation: openAir,
      isOnTrestle: openAir,
      trestleProgress: openAir ? 1 : 0,
      trestleWitnessed: this.snapshot.trestleWitnessed || openAir,
      trainSpeedMps: 0,
      segmentElapsedSec: this.snapshot.segmentDurationSec,
      stationDistanceM: 0,
      doorOpenProgress: 0,
      chimePlaying: true,
      activeDoorTell: seg.doorTell,
      lightFlickerIntensity: 1.0,
      activeMaskCheck: null,
      activeRestraint: null,
      watchingParentLabel: null,
      activeAnomaly: null,
      flagHoldProgress: 0,
      isFlagHolding: false,
      sanity: nextSanity,
    });

    if (seg.id === '6b') {
      // Stop 6b is silent PA, Mom says hesitantly:
      this.showSubtitle(
        {
          speaker: 'Mom',
          text: 'I think this is our… let’s… stretch our legs.',
        },
        4.5
      );
    } else if (seg.stopType === 'haven') {
      this.showSubtitle(
        {
          speaker: 'Mom',
          text: 'I think this is our transfer. Let’s stretch our legs.',
          stageDirection: getArrivalPaText(route, seg),
        },
        4.5
      );
    } else if (seg.stopType === 'bait') {
      this.showSubtitle(
        {
          speaker: 'Mom',
          text: 'This is us. Come on, get up.',
          stageDirection: getArrivalPaText(route, seg),
        },
        4.5
      );
    } else if (seg.stopType === 'final') {
      this.showSubtitle(
        {
          speaker: 'Mom',
          text: formatRouteText('Here we are. {terminus}.', route),
          stageDirection: getArrivalPaText(route, seg),
        },
        5.0
      );
    } else if (!seg.silent) {
      this.showSubtitle(
        {
          speaker: 'PA',
          text: getArrivalPaText(route, seg),
          isPa: true,
        },
        4.5
      );
    }
  }

  private getSegmentChatPair(seg: SegmentRule) {
    if (typeof seg.chatIndex !== 'number') return null;
    const archive = settingsStore.getArchive();
    // Swap in extra calm small talk on rides into stops 2, 4, and 6 after first ride
    if (archive.finishedRides > 0 && seg.chatIndex <= 2) {
      return EXTRA_CALM_SMALL_TALK[seg.chatIndex] ?? PARENT_RIDE_CHATS[seg.chatIndex] ?? null;
    }
    return PARENT_RIDE_CHATS[seg.chatIndex] ?? null;
  }

  public stepRide(dtSec: number): void {
    if (this.snapshot.paused || this.snapshot.phase === 'menu' || this.snapshot.phase === 'end') {
      return;
    }

    if (this.headWhipCooldownSec > 0) {
      this.headWhipCooldownSec = Math.max(0, this.headWhipCooldownSec - dtSec);
    }
    if (this.stareReactionCooldownSec > 0) {
      this.stareReactionCooldownSec = Math.max(0, this.stareReactionCooldownSec - dtSec);
    }
    if (this.falseFlagCooldownSec > 0) {
      this.falseFlagCooldownSec = Math.max(0, this.falseFlagCooldownSec - dtSec);
    }
    if (this.shutterCooldownSec > 0) {
      this.shutterCooldownSec = Math.max(0, this.shutterCooldownSec - dtSec);
    }
    if (this.forcedWatcherRemainingSec > 0) {
      this.forcedWatcherRemainingSec = Math.max(0, this.forcedWatcherRemainingSec - dtSec);
      if (this.forcedWatcherRemainingSec <= 0) {
        this.forcedWatcherLabel = null;
      }
    }

    // 1. Decay active rollsign, subtitle & paranoid flash timers
    let bannerChanged = false;
    if (this.snapshot.rollsign && this.rollsignRemainingSec > 0) {
      this.rollsignRemainingSec -= dtSec;
      if (this.rollsignRemainingSec <= 0) {
        this.snapshot.rollsign = null;
        bannerChanged = true;
      }
    }

    if (this.snapshot.subtitle && this.subtitleRemainingSec > 0) {
      this.subtitleRemainingSec -= dtSec;
      if (this.subtitleRemainingSec <= 0) {
        this.snapshot.subtitle = null;
        bannerChanged = true;
      }
    }

    if (this.snapshot.paranoidFlashText && this.paranoidFlashRemainingSec > 0) {
      this.paranoidFlashRemainingSec -= dtSec;
      if (this.paranoidFlashRemainingSec <= 0) {
        this.snapshot.paranoidFlashText = null;
        bannerChanged = true;
      }
    }

    if (this.snapshot.polaroidFlashIntensity > 0) {
      const nextFlash = Math.max(
        0,
        this.snapshot.polaroidFlashIntensity - POLAROID_FLASH_DECAY_PER_SEC * dtSec
      );
      this.snapshot.polaroidFlashIntensity = Number(nextFlash.toFixed(2));
      bannerChanged = true;
    }

    // Safe Haven platform dwell (Stop 6)
    if (this.snapshot.phase === 'haven') {
      this.havenElapsedSec += dtSec;
      if (this.havenElapsedSec >= 4.2) {
        this.completeSafeHaven();
        return;
      }
      if (bannerChanged) this.emit();
      return;
    }

    // False Stop Trial room phase
    if (this.snapshot.phase === 'trial') {
      if (bannerChanged) this.emit();
      return;
    }

    // Practice Stretch tutorial phase ('intro')
    if (this.snapshot.phase === 'intro') {
      if (this.snapshot.isFlagHolding || this.snapshot.flagHoldProgress > 0) {
        const camY = playerController.getState().y || 1.24;
        const lookingAtActive = isLookingAtAnomaly(
          this.snapshot.activeAnomaly,
          this.snapshot.playerX,
          camY,
          this.snapshot.playerZ,
          this.snapshot.playerYaw,
          this.snapshot.playerPitch
        );
        const flagStep = stepFlagHoldProgress({
          isHolding: this.snapshot.isFlagHolding,
          currentProgress: this.snapshot.flagHoldProgress,
          dtSec,
          lookingAtActiveAnomaly: lookingAtActive,
        });
        this.snapshot.flagHoldProgress = Number(flagStep.nextProgress.toFixed(2));
        bannerChanged = true;

        if (flagStep.completedCatch) {
          this.catchActiveAnomaly(false);
          if (this.snapshot.tutorialState) {
            this.update({
              tutorialState: {
                ...this.snapshot.tutorialState,
                feedbackText: TUTORIAL_STRINGS.STEP_1_CAUGHT_FEEDBACK,
              },
            });
          }
        } else if (flagStep.completedFalseFlag && this.snapshot.tutorialState) {
          this.update({
            isFlagHolding: false,
            flagHoldProgress: 0,
            tutorialState: {
              ...this.snapshot.tutorialState,
              feedbackText: TUTORIAL_STRINGS.STEP_1_MISS_FEEDBACK,
            },
          });
        }
      }
      if (bannerChanged) this.emit();
      return;
    }

    // 2. Step active mask check countdown
    if (this.snapshot.activeMaskCheck) {
      const nextRem = this.snapshot.activeMaskCheck.remainingSec - dtSec;
      if (nextRem <= 0) {
        this.handleMaskCheckTimeout();
        return;
      }
      const prevSecInt = Math.ceil(this.snapshot.activeMaskCheck.remainingSec);
      const nextSecInt = Math.ceil(nextRem);
      this.snapshot.activeMaskCheck = {
        ...this.snapshot.activeMaskCheck,
        remainingSec: Number(nextRem.toFixed(2)),
      };
      if (prevSecInt !== nextSecInt) {
        bannerChanged = true;
      }
    }

    // 2b. Step active Stop 11 Restraint moment (15 s total, 5 s start window, timed beats)
    if (this.snapshot.activeRestraint && this.snapshot.activeRestraint.active) {
      const cur = this.snapshot.activeRestraint;
      const nextRestraintElapsed = cur.elapsedSec + dtSec;
      const nextDim = Number(Math.min(0.4, (nextRestraintElapsed / 6.0) * 0.4).toFixed(3));
      let nextMomFrozen = cur.momFrozen;
      let nextStrangersVanished = cur.strangersVanished;

      if (!this.restraintBeat15Played && nextRestraintElapsed >= 1.5) {
        this.restraintBeat15Played = true;
        nextMomFrozen = true;
        bannerChanged = true;
      }
      if (!this.restraintBeat40Played && nextRestraintElapsed >= 4.0) {
        this.restraintBeat40Played = true;
        this.showSubtitle(
          {
            speaker: 'Dad',
            text: 'No. We’re not getting off. You know that.',
          },
          3.8
        );
      }
      if (!this.restraintBeat70Played && nextRestraintElapsed >= 7.0) {
        this.restraintBeat70Played = true;
        nextStrangersVanished = true;
        for (const cb of this.restraintWhisperListeners) cb();
        bannerChanged = true;
      }
      if (!this.restraintBeat105Played && nextRestraintElapsed >= 10.5) {
        this.restraintBeat105Played = true;
        this.showSubtitle(
          {
            speaker: 'Mom',
            stageDirection: '(her mouth doesn’t move)',
            text: 'You can stop pretending.',
          },
          4.0
        );
      }

      if (cur.isHolding) {
        const nextHold = Math.min(1, cur.holdProgress + dtSec / RESTRAINT_HOLD_DURATION_SEC);
        if (nextHold >= 1) {
          const nextCeilingBonus = RESTRAINT_CEILING_RAISE;
          this.update({
            activeRestraint: null,
            restraintHeld: true,
            restraintCompleted: true,
            restraintCeilingBonus: nextCeilingBonus,
            sanity: this.snapshot.sanity + SANITY_DELTAS.RESTRAINT_OK,
            watchingParentLabel: null,
            lightFlickerIntensity: 1.0,
            isFlagHolding: false,
            flagHoldProgress: 0,
          });
          this.showSubtitle(
            {
              stageDirection: 'The lights come back. Everyone is where they were.',
              text: '',
            },
            3.8
          );
          return;
        }
        const prevBucket = Math.round(cur.holdProgress * 20);
        const nextBucket = Math.round(nextHold * 20);
        this.snapshot.activeRestraint = {
          ...cur,
          elapsedSec: Number(nextRestraintElapsed.toFixed(2)),
          holdProgress: Number(nextHold.toFixed(3)),
          dimOpacity: nextDim,
          momFrozen: nextMomFrozen,
          strangersVanished: nextStrangersVanished,
        };
        if (prevBucket !== nextBucket || nextDim !== cur.dimOpacity) bannerChanged = true;
      } else if (cur.graceRemainingSec > 0) {
        const nextGrace = cur.graceRemainingSec - dtSec;
        if (nextGrace <= 0) {
          this.failRestraint(
            cur.hasStartedHolding ? 'You let go' : 'You couldn’t keep it together'
          );
          return;
        }
        const prevTenths = Math.ceil(cur.graceRemainingSec * 10);
        const nextTenths = Math.ceil(nextGrace * 10);
        this.snapshot.activeRestraint = {
          ...cur,
          elapsedSec: Number(nextRestraintElapsed.toFixed(2)),
          graceRemainingSec: Number(nextGrace.toFixed(2)),
          dimOpacity: nextDim,
          momFrozen: nextMomFrozen,
          strangersVanished: nextStrangersVanished,
        };
        if (prevTenths !== nextTenths || nextDim !== cur.dimOpacity) bannerChanged = true;
      } else if (!cur.hasStartedHolding) {
        if (nextRestraintElapsed >= RESTRAINT_START_WINDOW_SEC) {
          this.failRestraint('You couldn’t keep it together');
          return;
        }
        this.snapshot.activeRestraint = {
          ...cur,
          elapsedSec: Number(nextRestraintElapsed.toFixed(2)),
          dimOpacity: nextDim,
          momFrozen: nextMomFrozen,
          strangersVanished: nextStrangersVanished,
        };
        if (nextDim !== cur.dimOpacity) bannerChanged = true;
      } else {
        this.failRestraint('You let go');
        return;
      }

      if (bannerChanged) this.emit();
      return;
    }

    const seg = this.getCurrentSegmentRule();
    const maxCruiseSpeed =
      TRAIN_CRUISE_SPEED_MPS *
      (this.snapshot.nightmareMode ? TRAIN_NIGHTMARE_SPEED_MULT : 1.0);

    // 3. In-transit ride motion & parent watching / chats / mask checks / anomalies
    if (this.snapshot.phase === 'ride') {
      const nextElapsed = this.snapshot.segmentElapsedSec + dtSec;
      const totalDur = this.snapshot.segmentDurationSec;
      const timeRemaining = Math.max(0, totalDur - nextElapsed);

      if (nextElapsed >= totalDur) {
        this.arriveAtCurrentStop();
        return;
      }

      let nextSubPhase: RideSubPhase = 'cruising';
      let nextSpeed = maxCruiseSpeed;

      if (nextElapsed < DEPARTURE_ACCEL_DURATION_SEC) {
        nextSubPhase = 'departing';
        const accelT = nextElapsed / DEPARTURE_ACCEL_DURATION_SEC;
        nextSpeed = maxCruiseSpeed * (0.12 + 0.88 * accelT * accelT);
      } else if (timeRemaining <= BRAKING_DURATION_SEC) {
        nextSubPhase = 'braking';
        const brakeT = timeRemaining / BRAKING_DURATION_SEC;
        nextSpeed = maxCruiseSpeed * Math.max(0.04, brakeT * brakeT);
      } else if (timeRemaining <= BRAKING_DURATION_SEC + 3.0) {
        nextSubPhase = 'approaching';
      }

      let stationDistanceM = 200;
      if (nextElapsed < DEPARTURE_ACCEL_DURATION_SEC) {
        stationDistanceM = -0.5 * maxCruiseSpeed * nextElapsed;
      } else if (timeRemaining <= BRAKING_DURATION_SEC + 2.5) {
        const approachWindow = BRAKING_DURATION_SEC + 2.5;
        const norm = timeRemaining / approachWindow;
        stationDistanceM = 68 * norm * norm;
      }

      // Parent chats (at ~3.6s and ~5.8s)
      const chatPair = this.getSegmentChatPair(seg);
      if (chatPair && !this.chatPart1Played && nextElapsed >= 3.6) {
        this.chatPart1Played = true;
        this.showSubtitle(
          {
            speaker: chatPair.first.speakerLabel,
            text: chatPair.first.text,
          },
          2.1
        );
      }
      if (chatPair && !this.chatPart2Played && nextElapsed >= 5.8) {
        this.chatPart2Played = true;
        this.showSubtitle(
          {
            speaker: chatPair.second.speakerLabel,
            text: chatPair.second.text,
          },
          2.4
        );
      }

      // 7s into each stretch: "The next stop is ${stop}."
      if (
        !this.nextStopPaAnnounced &&
        nextElapsed >= PA_NEXT_STOP_ANNOUNCE_SEC &&
        !seg.silent
      ) {
        this.nextStopPaAnnounced = true;
        this.showSubtitle(
          {
            speaker: 'PA',
            text: getNextStopPaText(this.snapshot.activeRoute, seg.stationIndex),
            isPa: true,
          },
          3.2
        );
      }

      // Trigger Stop 11 Greenpoint Av Restraint moment at ~8.2s into stretch 11
      if (
        seg.restraint &&
        !this.restraintTriggeredInSegment &&
        nextElapsed >= 8.2 &&
        !this.snapshot.activeRestraint
      ) {
        this.triggerRestraintMoment();
        return;
      }

      // Scheduled parent mask checks (1st at ~9.5s, 2nd at ~14.2s if maskChecksCount === 2)
      if (
        seg.maskChecksCount >= 1 &&
        this.maskChecksTriggeredInSegment === 0 &&
        nextElapsed >= 9.5 &&
        !this.snapshot.activeMaskCheck &&
        !this.snapshot.activeRestraint
      ) {
        this.maskChecksTriggeredInSegment = 1;
        this.triggerMaskCheck();
      } else if (
        seg.maskChecksCount >= 2 &&
        this.maskChecksTriggeredInSegment === 1 &&
        nextElapsed >= 14.2 &&
        !this.snapshot.activeMaskCheck &&
        !this.snapshot.activeRestraint
      ) {
        this.maskChecksTriggeredInSegment = 2;
        this.triggerMaskCheck();
      }

      // Periodic CLOCK sanity tick (-2, or -4 in Nightmare mode) at mid-stretch
      if (!this.clockSanityTickApplied && nextElapsed >= totalDur * 0.6) {
        this.clockSanityTickApplied = true;
        const clockDelta = this.snapshot.nightmareMode
          ? SANITY_DELTAS.CLOCK * 2
          : SANITY_DELTAS.CLOCK;
        this.update({
          sanity: this.snapshot.sanity + clockDelta,
        });
      }

      // Trigger opposite-track passing train mid-stretch
      if (!this.passingTrainTriggered && nextElapsed >= totalDur * 0.45 && !seg.thin) {
        this.passingTrainTriggered = true;
        for (const cb of this.passingTrainListeners) cb();
      }

      // Parent watching cycle (when not already locked by an active mask check or restraint)
      let nextWatcher: 'Mom' | 'Dad' | null = this.snapshot.watchingParentLabel;
      if (this.snapshot.activeMaskCheck) {
        nextWatcher = this.snapshot.activeMaskCheck.speakerLabel;
      } else if (this.snapshot.activeRestraint) {
        nextWatcher = 'Mom';
      } else if (this.forcedWatcherRemainingSec > 0 && this.forcedWatcherLabel) {
        nextWatcher = this.forcedWatcherLabel;
      } else if (!seg.silent) {
        const cyclePeriod = this.snapshot.nightmareMode ? 6.2 : 8.4;
        const watchDuration = this.snapshot.nightmareMode ? 3.2 : 2.6;
        const phaseInCycle = nextElapsed % cyclePeriod;
        if (phaseInCycle >= 2.2 && phaseInCycle <= 2.2 + watchDuration) {
          const cycleIndex = Math.floor(nextElapsed / cyclePeriod);
          nextWatcher = (cycleIndex + seg.stopNumber) % 2 === 0 ? 'Mom' : 'Dad';
        } else {
          nextWatcher = null;
        }
      } else {
        nextWatcher = null;
      }

      // Step Anomaly Manifestation, Staring-while-watched, and 0.7s Flag Hold
      const camY = playerController.getState().y || 1.24;
      const currentAnomaly = this.snapshot.activeAnomaly;

      if (currentAnomaly && !currentAnomaly.manifested && nextElapsed >= 1.5) {
        const canManifest = shouldAnomalyManifest({
          anomaly: currentAnomaly,
          cameraX: this.snapshot.playerX,
          cameraY: camY,
          cameraZ: this.snapshot.playerZ,
          yaw: this.snapshot.playerYaw,
          pitch: this.snapshot.playerPitch,
          stretchElapsedSec: nextElapsed,
          stretchDurationSec: totalDur,
        });
        if (canManifest) {
          this.manifestActiveAnomaly();
          bannerChanged = true;
        }
      }

      const lookingAtActive = isLookingAtAnomaly(
        this.snapshot.activeAnomaly,
        this.snapshot.playerX,
        camY,
        this.snapshot.playerZ,
        this.snapshot.playerYaw,
        this.snapshot.playerPitch
      );

      // Staring at something wrong while a parent is watching raises suspicion
      if (lookingAtActive && nextWatcher !== null) {
        this.staringAtAnomalySec += dtSec;
        if (this.staringAtAnomalySec >= 1.35 && this.stareReactionCooldownSec <= 0) {
          this.staringAtAnomalySec = 0;
          this.stareReactionCooldownSec = 3.5;
          this.recordVisibleReaction(
            `Stared at something wrong while ${nextWatcher} was watching`
          );
          bannerChanged = true;
        }
      } else {
        this.staringAtAnomalySec = Math.max(0, this.staringAtAnomalySec - dtSec * 2.0);
      }

      // Step 0.7 s Flag hold
      if (this.snapshot.isFlagHolding || this.snapshot.flagHoldProgress > 0) {
        const flagStep = stepFlagHoldProgress({
          isHolding: this.snapshot.isFlagHolding,
          currentProgress: this.snapshot.flagHoldProgress,
          dtSec,
          lookingAtActiveAnomaly: lookingAtActive,
        });

        const prevBucket = Math.round(this.snapshot.flagHoldProgress * 20);
        const nextBucket = Math.round(flagStep.nextProgress * 20);
        this.snapshot.flagHoldProgress = Number(flagStep.nextProgress.toFixed(2));
        if (prevBucket !== nextBucket) {
          bannerChanged = true;
        }

        if (flagStep.completedCatch) {
          this.catchActiveAnomaly(false);
          bannerChanged = true;
        } else if (flagStep.completedFalseFlag && this.falseFlagCooldownSec <= 0) {
          this.falseFlagCooldownSec = 2.5;
          this.update({
            isFlagHolding: false,
            flagHoldProgress: 0,
            falseFlagsCount: this.snapshot.falseFlagsCount + 1,
            sanity: this.snapshot.sanity + SANITY_DELTAS.FALSE_FLAG,
          });
          bannerChanged = true;
        }
      }

      // Step EVP Microcassette Recorder tuning & recording
      if (this.snapshot.evpOpen) {
        const isAboveGround =
          (this.snapshot.activeRoute === 'G' && seg.id === '12') ||
          this.snapshot.isOpenAirStation;
        const prelimRes = evaluateEvpTuning({
          frequencyMhz: this.snapshot.evpFrequencyMhz,
          trainSpeedMps: nextSpeed,
          route: this.snapshot.activeRoute,
          isAboveGround,
          stopNumber: seg.stopNumber,
          listenElapsedSec: 0,
        });
        if (prelimRes.lockedSpec) {
          if (this.evpLastLockedId === prelimRes.lockedSpec.id) {
            this.evpListenElapsedSec += dtSec;
          } else {
            this.evpLastLockedId = prelimRes.lockedSpec.id;
            this.evpListenElapsedSec = dtSec;
          }
        } else {
          this.evpLastLockedId = null;
          this.evpListenElapsedSec = 0;
        }

        const evalRes = evaluateEvpTuning({
          frequencyMhz: this.snapshot.evpFrequencyMhz,
          trainSpeedMps: nextSpeed,
          route: this.snapshot.activeRoute,
          isAboveGround,
          stopNumber: seg.stopNumber,
          listenElapsedSec: this.evpListenElapsedSec,
        });

        if (this.snapshot.evpTranscriptLive !== evalRes.liveTranscript) {
          bannerChanged = true;
        }
        this.snapshot.evpSignalStrength = evalRes.signalStrength;
        this.snapshot.evpLockedSignalId = evalRes.lockedSpec ? evalRes.lockedSpec.id : null;
        this.snapshot.evpLockedTitle = evalRes.lockedTitle;
        this.snapshot.evpTranscriptLive = evalRes.liveTranscript;

        if (this.snapshot.evpIsRecording && evalRes.lockedSpec) {
          const nextRecProg = Math.min(
            1,
            this.snapshot.evpRecordProgress + dtSec / EVP_RECORD_DURATION_SEC
          );
          if (nextRecProg >= 1) {
            const spec = evalRes.lockedSpec;
            const newTape = buildEvpTapeRecord({
              spec,
              route: this.snapshot.activeRoute,
              isAboveGround:
                (this.snapshot.activeRoute === 'G' && seg.id === '12') ||
                this.snapshot.isOpenAirStation,
              stopNumber: seg.stopNumber,
            });
            const alreadyRecorded = this.snapshot.tapes.some((t) => t.id === newTape.id);
            const nextTapes = alreadyRecorded
              ? this.snapshot.tapes.map((t) => (t.id === newTape.id ? newTape : t))
              : [...this.snapshot.tapes, newTape];

            this.update({
              tapes: nextTapes,
              evpIsRecording: false,
              evpRecordProgress: 0,
              evpLastSavedTitle: newTape.title,
              hasConductorEvp: this.snapshot.hasConductorEvp || spec.isConductor,
              hasSecretBroadcasterEvp:
                this.snapshot.hasSecretBroadcasterEvp || spec.isSecretBroadcaster,
            });
            bannerChanged = true;
          } else {
            this.snapshot.evpRecordProgress = Number(nextRecProg.toFixed(2));
            bannerChanged = true;
          }
        } else if (!this.snapshot.evpIsRecording && this.snapshot.evpRecordProgress > 0) {
          this.snapshot.evpRecordProgress = 0;
          bannerChanged = true;
        }
      }

      const nextFlicker = this.snapshot.activeRestraint
        ? 0.08
        : computeArrivalFlickerIntensity(timeRemaining, seg.doorTell);
      const subPhaseChanged = nextSubPhase !== this.snapshot.rideSubPhase;
      const flickerChanged =
        Math.abs(nextFlicker - this.snapshot.lightFlickerIntensity) > 0.02;
      const watcherChanged = nextWatcher !== this.snapshot.watchingParentLabel;

      const onTrestle = this.snapshot.activeRoute === 'G' && seg.id === '12';
      this.snapshot.isOnTrestle = onTrestle;
      this.snapshot.trestleProgress = onTrestle
        ? Number((nextElapsed / Math.max(1, totalDur)).toFixed(2))
        : 0;
      if (onTrestle && !this.snapshot.trestleWitnessed) {
        this.snapshot.trestleWitnessed = true;
      }

      this.snapshot.segmentElapsedSec = Number(nextElapsed.toFixed(2));
      this.snapshot.trainSpeedMps = Number(nextSpeed.toFixed(2));
      this.snapshot.stationDistanceM = Number(stationDistanceM.toFixed(2));
      this.snapshot.lightFlickerIntensity = nextFlicker;
      this.snapshot.rideSubPhase = nextSubPhase;
      this.snapshot.watchingParentLabel = nextWatcher;

      if (subPhaseChanged || flickerChanged || watcherChanged || bannerChanged) {
        this.emit();
      }
      return;
    }

    // 4. Station stop phase (chime -> doors_open -> dwell -> depart)
    if (this.snapshot.phase === 'stop') {
      this.stopElapsedSec += dtSec;
      const doorState = computeStopDoorState(this.stopElapsedSec, seg.doorTell);

      const prevDoorBucket = Math.round(this.snapshot.doorOpenProgress * 10);
      const nextDoorBucket = Math.round(doorState.doorOpenProgress * 10);
      const stateChanged =
        doorState.chimePlaying !== this.snapshot.chimePlaying ||
        doorState.subPhase !== this.snapshot.rideSubPhase ||
        prevDoorBucket !== nextDoorBucket ||
        bannerChanged;

      this.snapshot.chimePlaying = doorState.chimePlaying;
      this.snapshot.doorOpenProgress = doorState.doorOpenProgress;
      this.snapshot.rideSubPhase = doorState.subPhase;

      const totalStopTime = DOOR_CHIME_DURATION_SEC + STOP_DWELL_DURATION_SEC;
      if (seg.stopType !== 'final' && this.stopElapsedSec >= totalStopTime) {
        this.stayOnTrain();
        return;
      }

      if (stateChanged) {
        this.emit();
      }
    }
  }

  public stayOnTrain(): void {
    if (this.snapshot.phase !== 'stop') return;
    const seg = this.getCurrentSegmentRule();
    if (seg.stopType === 'final') return;

    if (seg.stopType === 'haven') {
      const isTouch =
        typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      this.update({
        hasRecorder: true,
        suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.REFUSE_SAFE_HAVEN,
        lastReactionReason: 'Refused to step off when your parents asked',
      });
      this.recordStopDecision(seg, false);
      const nextIdx = this.snapshot.segmentTableIndex + 1;
      if (nextIdx < SEGMENT_TABLE.length) {
        this.enterSegment(nextIdx);
      }
      this.showSubtitle(
        {
          speaker: 'Dad',
          text: 'Here. Your grandfather’s. He used it on the night shift. Never could get it to stop picking up the radio.',
          stageDirection: isTouch
            ? 'Dad gave you a tape recorder. Tap Recorder to raise it.'
            : 'Dad gave you a tape recorder. Press R to raise it.',
        },
        4.2
      );
      return;
    }

    this.update({
      suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.CLEAN_STOP,
    });
    this.recordStopDecision(seg, false);

    const nextIdx = this.snapshot.segmentTableIndex + 1;
    if (nextIdx < SEGMENT_TABLE.length) {
      this.enterSegment(nextIdx);
    }
  }

  public stepOffTrain(): void {
    if (this.snapshot.phase !== 'stop') return;
    const seg = this.getCurrentSegmentRule();
    const route = this.snapshot.activeRoute;

    if (seg.stopType === 'final') {
      this.chooseCourtSqExit('escalators');
      return;
    }

    const nextIdx = Math.min(
      SEGMENT_TABLE.length - 1,
      this.snapshot.segmentTableIndex + 1
    );

    // Stop 6 Safe Haven: restores +15 sanity, hands over grandfather's tape recorder, enters 'haven' phase
    if (seg.stopType === 'haven') {
      const isTouch =
        typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      this.havenElapsedSec = 0;
      this.update({
        phase: 'haven',
        safeHavenVisited: true,
        hasRecorder: true,
        sanity: this.snapshot.sanity + SANITY_DELTAS.SAFE_HAVEN,
      });
      this.recordStopDecision(seg, true);
      this.showSubtitle(
        {
          speaker: 'Dad',
          text: 'Here. Your grandfather’s. He used it on the night shift. Never could get it to stop picking up the radio.',
          stageDirection: isTouch
            ? 'Dad gave you a tape recorder. Tap Recorder to raise it.'
            : 'Dad gave you a tape recorder. Press R to raise it.',
        },
        4.2
      );
      return;
    }

    // Stop 4 Forgiving False Stop: Mom grabs your sleeve
    if (seg.stopType === 'false' && seg.forgivingFalseStop) {
      this.recordStopDecision(seg, true);
      this.enterSegment(nextIdx);
      this.showSubtitle(
        {
          speaker: 'Mom',
          text: 'Not this one, hon. The doors opened funny.',
          stageDirection: 'Mom grabs your sleeve.',
        },
        4.2
      );
      return;
    }

    // Stop 12 (21 St) False Stop Bait: stepping off ends the ride with Ending #2: The Eternal Commute
    if (seg.stopType === 'bait') {
      this.recordStopDecision(seg, true);
      pointerLock.unlock({ quiet: true });

      const sanityRetainedPercent = computeSanityRetainedPercent({
        stopDecisions: this.snapshot.stopDecisions,
        finalSanity: this.snapshot.sanity,
        restraintHeld: this.snapshot.restraintHeld,
      });
      const anomalyAccuracyPercent = computeAnomalyAccuracyPercent(
        this.snapshot.anomaliesCaughtCount,
        this.snapshot.anomaliesSpawnedCount
      );
      const resolvedEnding = evaluateRideEnding({
        route,
        selectedExit: null,
        peakSuspicion: this.snapshot.peakSuspicion,
        sanityRetainedPercent,
        anomalyAccuracyPercent,
        tapesCount: this.snapshot.tapes.length,
        hasConductorOnTape: this.snapshot.hasConductorEvp,
        restraintHeld: this.snapshot.restraintHeld,
        falseStopTrialsCount: this.snapshot.falseStopTrials.length,
        interventionsCount: this.snapshot.interventionsCount,
        steppedOffAtBait: true,
      });

      if (!this.snapshot.isPracticeRun && !this.snapshot.isDebugRun) {
        const archive = settingsStore.getArchive();
        const nextDocEndings = archive.documentedEndings.includes(resolvedEnding.id)
          ? archive.documentedEndings
          : [...archive.documentedEndings, resolvedEnding.id];
        settingsStore.updateArchive({
          finishedRides: archive.finishedRides + 1,
          documentedEndings: nextDocEndings,
        });
      }

      this.update({
        phase: 'end',
        paused: false,
        trainSpeedMps: 0,
        steppedOffAtBait: true,
        resolvedEnding,
        sanityRetainedPercent,
        anomalyAccuracyPercent,
        cameraOpen: false,
        evpOpen: false,
        evpIsRecording: false,
        photos: this.snapshot.photos.map((p) => ({ ...p, developed: true })),
        activeMaskCheck: null,
        watchingParentLabel: null,
        lastReactionReason: 'Stepped off at a False Stop',
        subtitle: {
          id: 'bait-eternal-commute',
          speaker: 'Mom',
          text: resolvedEnding.narrativeText,
        },
      });
      return;
    }

    // Non-forgiving False Stops (Stop 6b, Stop 9): enters the False Stop Trial room
    if (seg.stopType === 'false') {
      this.recordStopDecision(seg, true);
      this.enterTrialRoom(seg.stopNumber);
      return;
    }

    // Ordinary real stop: Dad calls you back inside
    this.recordStopDecision(seg, true);
    this.enterSegment(nextIdx);
    this.showSubtitle(
      {
        speaker: 'Dad',
        text: 'Hey! Where are you going? Get back in here.',
        stageDirection: 'Stepped off at a real stop',
      },
      3.8
    );
  }

  public chooseCourtSqExit(choice: ExitChoiceId): void {
    const seg = this.getCurrentSegmentRule();
    this.recordStopDecision(seg, true);
    pointerLock.unlock({ quiet: true });
    const stageText =
      choice === 'escalators'
        ? 'You follow your parents toward the escalators.'
        : choice === 'lower_level'
          ? 'You drift toward the side stairs. The hiss in your pocket gets louder.'
          : 'You lean on the emergency bar. Somewhere above, the air is moving.';

    const sanityRetainedPercent = computeSanityRetainedPercent({
      stopDecisions: this.snapshot.stopDecisions,
      finalSanity: this.snapshot.sanity,
      restraintHeld: this.snapshot.restraintHeld,
    });
    const anomalyAccuracyPercent = computeAnomalyAccuracyPercent(
      this.snapshot.anomaliesCaughtCount,
      this.snapshot.anomaliesSpawnedCount
    );
    const resolvedEnding = evaluateRideEnding({
      route: this.snapshot.activeRoute,
      selectedExit: choice,
      peakSuspicion: this.snapshot.peakSuspicion,
      sanityRetainedPercent,
      anomalyAccuracyPercent,
      tapesCount: this.snapshot.tapes.length,
      hasConductorOnTape: this.snapshot.hasConductorEvp,
      restraintHeld: this.snapshot.restraintHeld,
      falseStopTrialsCount: this.snapshot.falseStopTrials.length,
      interventionsCount: this.snapshot.interventionsCount,
      steppedOffAtBait: this.snapshot.steppedOffAtBait,
    });

    if (!this.snapshot.isPracticeRun && !this.snapshot.isDebugRun) {
      const archive = settingsStore.getArchive();
      const nextDocEndings = archive.documentedEndings.includes(resolvedEnding.id)
        ? archive.documentedEndings
        : [...archive.documentedEndings, resolvedEnding.id];
      settingsStore.updateArchive({
        finishedRides: archive.finishedRides + 1,
        documentedEndings: nextDocEndings,
      });
    }

    this.update({
      phase: 'end',
      paused: false,
      trainSpeedMps: 0,
      selectedExit: choice,
      resolvedEnding,
      sanityRetainedPercent,
      anomalyAccuracyPercent,
      cameraOpen: false,
      evpOpen: false,
      evpIsRecording: false,
      photos: this.snapshot.photos.map((p) => ({ ...p, developed: true })),
      activeMaskCheck: null,
      activeRestraint: null,
      watchingParentLabel: null,
      subtitle: {
        id: 'exit-choice',
        text: stageText,
      },
    });
  }

  public returnToMenu(): void {
    pointerLock.unlock({ quiet: true });
    playerController.resetToSeat();
    this.update({
      phase: 'menu',
      rideSubPhase: 'cruising',
      paused: false,
      segmentTableIndex: 0,
      stopIndex: 0,
      segmentId: '2',
      currentStationName: getStopName('G', 0),
      nextStationName: getStopName('G', 1),
      isOpenAirStation: false,
      isOnTrestle: false,
      trestleProgress: 0,
      trestleWitnessed: false,
      trainSpeedMps: 0,
      doorOpenProgress: 0,
      chimePlaying: false,
      lightFlickerIntensity: 1.0,
      rollsign: null,
      subtitle: null,
      selectedExit: null,
      resolvedEnding: null,
      sanityRetainedPercent: 100,
      anomalyAccuracyPercent: 100,
      tutorialState: null,
      watchingParentLabel: null,
      activeMaskCheck: null,
      paranoidFlashText: null,
      interventionsCount: 0,
      lastReactionReason: null,
      activeAnomaly: null,
      flagHoldProgress: 0,
      isFlagHolding: false,
      rideAnomalies: [],
      anomaliesSpawnedCount: 0,
      anomaliesCaughtCount: 0,
      falseFlagsCount: 0,
      cameraOpen: false,
      polaroidShotsRemaining: STARTING_FILM,
      polaroidFlashIntensity: 0,
      photos: [],
      albumOpen: false,
      hasRecorder: false,
      evpOpen: false,
      evpFrequencyMhz: EVP_FREQ_DEFAULT_MHZ,
      evpSignalStrength: 0,
      evpLockedSignalId: null,
      evpLockedTitle: null,
      evpTranscriptLive: null,
      evpIsRecording: false,
      evpRecordProgress: 0,
      evpLastSavedTitle: null,
      tapes: [],
      playingTapeId: null,
      hasConductorEvp: false,
      hasSecretBroadcasterEvp: false,
      safeHavenVisited: false,
      trialState: null,
      falseStopTrials: [],
      activeRestraint: null,
      restraintHeld: false,
      restraintCompleted: false,
      restraintCeilingBonus: 0,
      steppedOffAtBait: false,
      stopDecisions: [],
      sanity: 100,
      suspicion: 0,
      peakSuspicion: 0,
      carLocation: 'CAR B (MID)',
      nearGangwayDoor: false,
      playerX: PLAYER_SEAT_X,
      playerZ: PLAYER_SEAT_Z,
      playerYaw: 0,
      playerPitch: -0.03,
    });
  }

  public togglePause(force?: boolean): void {
    if (this.snapshot.phase === 'menu' || this.snapshot.phase === 'end') return;
    const nextPaused = typeof force === 'boolean' ? force : !this.snapshot.paused;
    if (nextPaused) {
      pointerLock.unlock({ quiet: true });
      this.notifyFocusLoss();
    }
    this.update({ paused: nextPaused });
  }

  public toggleMute(force?: boolean): void {
    const nextMuted = typeof force === 'boolean' ? force : !this.snapshot.muted;
    this.update({ muted: nextMuted });
  }

  public setNightmareMode(enabled: boolean): void {
    this.update({ nightmareMode: enabled });
  }

  public setStartChapter(chapter: ChapterStartOption): void {
    this.update({ startChapter: chapter, isPracticeRun: chapter > 1 });
  }

  public setActiveRoute(route: RouteLineId): void {
    const seg = this.getCurrentSegmentRule();
    const prevStationIdx = Math.max(0, seg.stationIndex - 1);
    const currentStationIdx =
      this.snapshot.phase === 'stop' || this.snapshot.phase === 'haven'
        ? seg.stationIndex
        : prevStationIdx;
    const openAir = isElevatedOpenAirStop(route, seg.stationIndex);
    const onTrestle = route === 'G' && seg.id === '12';

    this.update({
      activeRoute: route,
      currentStationName: getStopName(route, currentStationIdx),
      nextStationName: getStopName(route, seg.stationIndex),
      isOpenAirStation: openAir,
      isOnTrestle: onTrestle || openAir,
    });
  }

  public recordFrameDelta(dtMs: number): number | null {
    const clampedMs = Math.min(100, Math.max(0.1, dtMs));
    this.frameTimeAccumMs += clampedMs;
    this.frameSampleCount += 1;

    if (this.frameSampleCount >= GOVERNOR_SAMPLE_FRAMES) {
      const avgMs = this.frameTimeAccumMs / this.frameSampleCount;
      const measuredFps = Math.min(60, Math.max(1, Math.round(1000 / avgMs)));
      const nextPixelRatio = stepGovernorPixelRatio(this.snapshot.pixelRatio, avgMs);

      this.frameTimeAccumMs = 0;
      this.frameSampleCount = 0;

      const ratioChanged = nextPixelRatio !== this.snapshot.pixelRatio;
      if (ratioChanged || Math.abs(measuredFps - this.snapshot.fps) >= 2) {
        this.snapshot = {
          ...this.snapshot,
          fps: measuredFps,
          pixelRatio: nextPixelRatio,
        };
        this.emit();
      }
      return ratioChanged ? nextPixelRatio : null;
    }

    return null;
  }
}

export const gameEngine = new GameEngine();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__gameEngine = gameEngine;
}


