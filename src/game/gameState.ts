import {
  BRAKING_DURATION_SEC,
  DEFAULT_CRUISE_DURATION_SEC,
  DEPARTURE_ACCEL_DURATION_SEC,
  DOOR_CHIME_DURATION_SEC,
  EARLY_DOOR_OPEN_DELAY_SEC,
  GOVERNOR_FRAME_TIME_THRESHOLD_MS,
  GOVERNOR_PIXEL_RATIO_STEP,
  GOVERNOR_SAMPLE_FRAMES,
  MAX_PIXEL_RATIO_DESKTOP,
  MAX_PIXEL_RATIO_TOUCH,
  MIN_PIXEL_RATIO,
  PA_NEXT_STOP_ANNOUNCE_SEC,
  PLAYER_SEAT_X,
  PLAYER_SEAT_Z,
  ROLLSIGN_DISPLAY_SEC,
  SANITY_BANDS_BY_STOP,
  SANITY_DELTAS,
  SANITY_TIER_THRESHOLDS,
  SEGMENT_TABLE,
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
  ChapterStartOption,
  DoorTellType,
  EngineSnapshot,
  ExitChoiceId,
  GamePhase,
  RideSubPhase,
  RollsignBanner,
  RouteLineId,
  SanityTier,
  SegmentRule,
  SubtitleItem,
} from '../types';
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

type EngineListener = (snapshot: EngineSnapshot) => void;

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
  private subtitleRemainingSec = 0;
  private rollsignRemainingSec = 0;
  private paranoidFlashRemainingSec = 0;
  private headWhipCooldownSec = 0;

  private nextStopPaAnnounced = false;
  private passingTrainTriggered = false;
  private clockSanityTickApplied = false;
  private chatPart1Played = false;
  private chatPart2Played = false;
  private maskChecksTriggeredInSegment = 0;
  private usedMaskCheckIds = new Set<string>();

  private passingTrainListeners = new Set<() => void>();

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
      watchingParentLabel: null,
      activeMaskCheck: null,
      paranoidFlashText: null,
      interventionsCount: 0,
      lastReactionReason: null,
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

    const nextSanity =
      typeof patch.sanity === 'number'
        ? clampSanityForStop(patch.sanity, stopNum)
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
      ? clampSanityForStop(nextSanity + intervention.sanityDelta, stopNum)
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

    this.frameTimeAccumMs = 0;
    this.frameSampleCount = 0;
    this.stopElapsedSec = 0;
    this.headWhipCooldownSec = 0;
    this.paranoidFlashRemainingSec = 0;
    this.nextStopPaAnnounced = false;
    this.passingTrainTriggered = false;
    this.clockSanityTickApplied = false;
    this.chatPart1Played = false;
    this.chatPart2Played = false;
    this.maskChecksTriggeredInSegment = 0;
    this.usedMaskCheckIds.clear();

    playerController.resetToSeat();
    pointerLock.clearErrorHint();

    const nightmare = options?.nightmare ?? this.snapshot.nightmareMode;
    const baseDuration = seg.cruiseDurationSec ?? DEFAULT_CRUISE_DURATION_SEC;
    const durationSec = nightmare ? baseDuration / TRAIN_NIGHTMARE_SPEED_MULT : baseDuration;

    const rollsign = getChapterRollsign(chapter, 'G');
    this.rollsignRemainingSec = ROLLSIGN_DISPLAY_SEC;
    this.subtitleRemainingSec = 4.5;

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
      watchingParentLabel: null,
      activeMaskCheck: null,
      paranoidFlashText: null,
      interventionsCount: 0,
      lastReactionReason: null,
      sanity: initialSanity,
      sanityTier: computeSanityTier(initialSanity),
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
    this.nextStopPaAnnounced = false;
    this.passingTrainTriggered = false;
    this.clockSanityTickApplied = false;
    this.chatPart1Played = false;
    this.chatPart2Played = false;
    this.maskChecksTriggeredInSegment = 0;

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
    const driftedSanity =
      this.snapshot.sanity > band[1]
        ? this.snapshot.sanity + SANITY_DELTAS.DRIFT_ON_CEILING_DROP
        : this.snapshot.sanity;
    const nextSanity = clampSanityForStop(driftedSanity, seg.stopNumber);

    this.update({
      phase: 'ride',
      rideSubPhase: 'departing',
      segmentTableIndex: clampedIdx,
      stopIndex: prevStationIndex,
      segmentId: seg.id,
      currentStationName: getStopName(route, prevStationIndex),
      nextStationName: getStopName(route, seg.stationIndex),
      isOpenAirStation: isElevatedOpenAirStop(route, seg.stationIndex),
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

    this.update({
      phase: 'stop',
      rideSubPhase: 'chime',
      stopIndex: seg.stationIndex,
      currentStationName: stationName,
      nextStationName: getStopName(route, Math.min(12, seg.stationIndex + 1)),
      isOpenAirStation: openAir,
      trainSpeedMps: 0,
      segmentElapsedSec: this.snapshot.segmentDurationSec,
      stationDistanceM: 0,
      doorOpenProgress: 0,
      chimePlaying: true,
      activeDoorTell: seg.doorTell,
      lightFlickerIntensity: 1.0,
      activeMaskCheck: null,
      watchingParentLabel: null,
    });

    if (!seg.silent) {
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

    const seg = this.getCurrentSegmentRule();
    const maxCruiseSpeed =
      TRAIN_CRUISE_SPEED_MPS *
      (this.snapshot.nightmareMode ? TRAIN_NIGHTMARE_SPEED_MULT : 1.0);

    // 3. In-transit ride motion & parent watching / chats / mask checks
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

      // Scheduled parent mask checks (1st at ~9.5s, 2nd at ~14.2s if maskChecksCount === 2)
      if (
        seg.maskChecksCount >= 1 &&
        this.maskChecksTriggeredInSegment === 0 &&
        nextElapsed >= 9.5 &&
        !this.snapshot.activeMaskCheck
      ) {
        this.maskChecksTriggeredInSegment = 1;
        this.triggerMaskCheck();
      } else if (
        seg.maskChecksCount >= 2 &&
        this.maskChecksTriggeredInSegment === 1 &&
        nextElapsed >= 14.2 &&
        !this.snapshot.activeMaskCheck
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

      // Parent watching cycle (when not already locked by an active mask check)
      let nextWatcher: 'Mom' | 'Dad' | null = this.snapshot.watchingParentLabel;
      if (this.snapshot.activeMaskCheck) {
        nextWatcher = this.snapshot.activeMaskCheck.speakerLabel;
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

      const nextFlicker = computeArrivalFlickerIntensity(timeRemaining, seg.doorTell);
      const subPhaseChanged = nextSubPhase !== this.snapshot.rideSubPhase;
      const flickerChanged =
        Math.abs(nextFlicker - this.snapshot.lightFlickerIntensity) > 0.02;
      const watcherChanged = nextWatcher !== this.snapshot.watchingParentLabel;

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
      this.update({
        suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.REFUSE_SAFE_HAVEN,
      });
      this.showSubtitle(
        {
          speaker: 'Mom',
          text: 'You don’t want to stretch your legs? …Okay.',
        },
        3.5
      );
    } else {
      this.update({
        suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.CLEAN_STOP,
      });
    }

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

    if (seg.stopType === 'haven') {
      this.update({
        sanity: this.snapshot.sanity + SANITY_DELTAS.SAFE_HAVEN,
      });
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
      return;
    }

    if (seg.stopType === 'false' && seg.forgivingFalseStop) {
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

    if (seg.stopType === 'false' || seg.stopType === 'bait') {
      this.update({
        sanity: this.snapshot.sanity + SANITY_DELTAS.TRIAL,
      });
      this.enterSegment(nextIdx);
      this.showSubtitle(
        {
          speaker: 'Mom',
          text: 'Where did you go?! You can’t just walk off like that!',
        },
        4.2
      );
      return;
    }

    this.enterSegment(nextIdx);
    this.showSubtitle(
      {
        speaker: 'Dad',
        text: 'Hey! Where are you going? Get back in here.',
      },
      3.8
    );
  }

  public chooseCourtSqExit(choice: ExitChoiceId): void {
    pointerLock.unlock({ quiet: true });
    const stageText =
      choice === 'escalators'
        ? 'You follow your parents toward the escalators.'
        : choice === 'lower_level'
          ? 'You drift toward the side stairs. The hiss in your pocket gets louder.'
          : 'You lean on the emergency bar. Somewhere above, the air is moving.';

    if (!this.snapshot.isPracticeRun && !this.snapshot.isDebugRun) {
      const archive = settingsStore.getArchive();
      settingsStore.updateArchive({
        finishedRides: archive.finishedRides + 1,
      });
    }

    this.update({
      phase: 'end',
      paused: false,
      trainSpeedMps: 0,
      selectedExit: choice,
      activeMaskCheck: null,
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
      trainSpeedMps: 0,
      doorOpenProgress: 0,
      chimePlaying: false,
      lightFlickerIntensity: 1.0,
      rollsign: null,
      subtitle: null,
      selectedExit: null,
      watchingParentLabel: null,
      activeMaskCheck: null,
      paranoidFlashText: null,
      interventionsCount: 0,
      lastReactionReason: null,
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
      this.snapshot.phase === 'stop' ? seg.stationIndex : prevStationIdx;

    this.update({
      activeRoute: route,
      currentStationName: getStopName(route, currentStationIdx),
      nextStationName: getStopName(route, seg.stationIndex),
      isOpenAirStation: isElevatedOpenAirStop(route, seg.stationIndex),
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

