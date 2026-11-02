import {
  DOOR_CHIME_DURATION_SEC, GOVERNOR_SAMPLE_FRAMES, POLAROID_FLASH_DECAY_PER_SEC,
  ROLLSIGN_DISPLAY_SEC, SEGMENT_TABLE, STOP_DWELL_DURATION_SEC, SUSPICION_DELTAS,
} from '../constants';
import { pointerLock } from '../input/pointerLock';
import { settingsStore } from '../settings';
import type {
  ActiveAnomalyInstance, AnomalyId, ChapterStartOption, EngineSnapshot, EvpSignalId,
  ExitChoiceId, GamePhase, RollsignBanner, RouteLineId, SegmentRule, SubtitleItem,
} from '../types';
import { buildActiveAnomalyInstance, selectAnomalyIdForStretch } from './anomalyManager';
import { type MaskCheckDefinition, PARANOID_UI_WORDS } from './carLife';
import {
  catchActiveAnomalyHelper, manifestActiveAnomalyHelper, setEvpFrequencyHelper,
  snapPolaroidPhotoHelper, spawnStretchAnomalyHelper, stepEvpFrequencyHelper,
  toggleEvpRecorderHelper, toggleTapePlaybackHelper,
} from './engineInteractions';
import { resetPlayerCameraToSeatedEyeLevel, syncPlayerPoseHelper } from './engineMovement';
import {
  arriveAtCurrentStopHelper, chooseCourtSqExitHelper, chooseTrialOptionHelper,
  computeArrivalFlickerIntensity, computeStopDoorState, enterSegmentHelper,
  enterTrialRoomHelper, exitTrialHelper, type RideSegmentRuntimeState,
  stayOnTrainHelper, stepInTransitRideSegment, stepOffTrainHelper, type TrialChoiceId,
} from './enginePhases';
import {
  applyEngineUpdatePatch, buildReturnToMenuPatch, buildStartRideSnapshot,
  buildStopDecisionRecord, clampSanityForStop, computeInitialPixelRatio,
  computeSanityTier, computeStretchDurationSec, createInitialEngineSnapshot,
  getInitialSegmentTableIndexForChapter, getSegmentRuleByIndex, stepGovernorPixelRatio,
} from './engineStops';
import {
  answerMaskCheckHelper, handleMaskCheckTimeoutHelper, notifyRestraintFocusLossHelper,
  RESTRAINT_HOLD_DURATION_SEC, type RestraintBeatsTracker, setRestraintHoldingHelper,
  stepActiveRestraintHelper, triggerMaskCheckHelper, triggerRestraintMomentHelper,
} from './engineWatching';
import { reshuffleEvpFrequencies } from './evpManager';
import { getChapterRollsign, getStopName, isElevatedOpenAirStop } from './routeManager';
import { formatRouteText } from './routeText';
import {
  advanceTutorialStepHelper, startPracticeStretchHelper, stepIntroTutorialFlagHelper,
} from './tutorial';

export {
  clampSanityForStop, computeArrivalFlickerIntensity, computeInitialPixelRatio,
  computeSanityTier, computeStopDoorState, RESTRAINT_HOLD_DURATION_SEC,
  stepGovernorPixelRatio, type TrialChoiceId,
};

type EngineListener = (snapshot: EngineSnapshot) => void;

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
  private shutterCooldownSec = 0;
  private photographedAnomalyInStretch = false;
  private usedMaskCheckIds = new Set<string>();
  private usedAnomalyIds = new Set<AnomalyId>();

  private runtime: RideSegmentRuntimeState = {
    nextStopPaAnnounced: false, passingTrainTriggered: false, clockSanityTickApplied: false,
    chatPart1Played: false, chatPart2Played: false, restraintTriggeredInSegment: false,
    maskChecksTriggeredInSegment: 0, staringAtAnomalySec: 0, stareReactionCooldownSec: 0,
    falseFlagCooldownSec: 0, evpListenElapsedSec: 0, evpLastLockedId: null,
    forcedWatcherLabel: null, forcedWatcherRemainingSec: 0,
  };

  private restraintBeats: RestraintBeatsTracker = {
    beat15Played: false, beat40Played: false, beat70Played: false, beat105Played: false,
  };

  private passingTrainListeners = new Set<() => void>();
  private tier3TearListeners = new Set<() => void>();
  private restraintWhisperListeners = new Set<() => void>();

  constructor() {
    this.snapshot = createInitialEngineSnapshot();
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
  }

  public get dim(): number { return this.snapshot.activeRestraint?.dimOpacity ?? 0; }
  public get playerPitch(): number { return this.snapshot.playerPitch; }
  public get playerYaw(): number { return this.snapshot.playerYaw; }

  private syncBodyDataset(): void {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.dataset.phase = this.snapshot.phase;
    document.body.dataset.subphase = this.snapshot.rideSubPhase;
    document.body.dataset.car = this.snapshot.carLocation;
    document.body.dataset.segment = this.snapshot.segmentId;
    document.body.dataset.state =
      this.snapshot.phase === 'menu' ? 'title'
      : this.snapshot.phase === 'end' ? 'gameover'
      : this.snapshot.paused ? 'paused' : 'playing';
  }

  private emit(): void {
    this.syncBodyDataset();
    for (const listener of this.listeners) listener(this.snapshot);
  }

  public getSnapshot(): EngineSnapshot { return this.snapshot; }
  public getCurrentSegmentRule(): SegmentRule {
    return getSegmentRuleByIndex(this.snapshot.segmentTableIndex);
  }
  public subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  public onPassingTrainTrigger(cb: () => void): () => void {
    this.passingTrainListeners.add(cb);
    return () => this.passingTrainListeners.delete(cb);
  }
  public onTier3Tear(cb: () => void): () => void {
    this.tier3TearListeners.add(cb);
    return () => this.tier3TearListeners.delete(cb);
  }
  public onRestraintWhisper(cb: () => void): () => void {
    this.restraintWhisperListeners.add(cb);
    return () => this.restraintWhisperListeners.delete(cb);
  }

  public forceParentLook(): 'Mom' | 'Dad' {
    const chosen: 'Mom' | 'Dad' = Math.random() < 0.5 ? 'Mom' : 'Dad';
    this.runtime.forcedWatcherLabel = chosen;
    this.runtime.forcedWatcherRemainingSec = 3.0;
    return chosen;
  }

  public setRollsignRemainingSec(sec: number): void { this.rollsignRemainingSec = sec; }
  public setSubtitleRemainingSec(sec: number): void { this.subtitleRemainingSec = sec; }
  public emitPassingTrain(): void { for (const cb of this.passingTrainListeners) cb(); }
  public emitTier3Tear(): void { for (const cb of this.tier3TearListeners) cb(); }
  public emitRestraintWhisper(): void { for (const cb of this.restraintWhisperListeners) cb(); }

  public showSubtitle(item: Omit<SubtitleItem, 'id'>, durationSec = 4.2): void {
    this.subtitleRemainingSec = durationSec;
    this.update({
      subtitle: { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
    });
  }

  public showRollsign(banner: RollsignBanner, durationSec = ROLLSIGN_DISPLAY_SEC): void {
    this.rollsignRemainingSec = durationSec;
    this.update({ rollsign: banner });
  }

  public triggerParanoidFlash(customWord?: string): void {
    const word = customWord ??
      PARANOID_UI_WORDS[Math.floor(Math.random() * PARANOID_UI_WORDS.length)] ?? 'SAY NOTHING';
    this.paranoidFlashRemainingSec = 0.7;
    this.update({ paranoidFlashText: word });
  }

  public update(patch: Partial<EngineSnapshot>): EngineSnapshot {
    const { nextSnapshot, intervened } = applyEngineUpdatePatch(this.snapshot, patch);
    this.snapshot = nextSnapshot;
    if (intervened) this.subtitleRemainingSec = 4.6;
    this.emit();
    return this.snapshot;
  }

  public recordVisibleReaction(reason: string): void {
    this.update({
      suspicion: this.snapshot.suspicion + SUSPICION_DELTAS.VISIBLE_REACTION,
      lastReactionReason: reason,
    });
  }

  public triggerMaskCheck(overrideDef?: MaskCheckDefinition): void {
    const check = triggerMaskCheckHelper(this, this.usedMaskCheckIds, overrideDef);
    this.subtitleRemainingSec = check.totalSec;
  }

  public answerMaskCheck(optionIndex: 0 | 1 | 2): void {
    answerMaskCheckHelper(this, optionIndex);
  }

  public syncPlayerPose(x: number, z: number, yaw: number, pitch: number): void {
    const outcome = syncPlayerPoseHelper({
      snapshot: this.snapshot, x, z, yaw, pitch, headWhipCooldownSec: this.headWhipCooldownSec,
    });
    this.headWhipCooldownSec = outcome.nextHeadWhipCooldownSec;
    this.snapshot = outcome.nextSnapshot;
    if (outcome.triggeredWhipReason) {
      this.recordVisibleReaction(outcome.triggeredWhipReason);
    } else if (outcome.shouldEmit) {
      this.emit();
    }
  }

  public setPhase(phase: GamePhase): void {
    this.update({ phase, paused: false });
  }

  public spawnStretchAnomaly(overrideId?: AnomalyId, forceManifest = false): ActiveAnomalyInstance | null {
    this.runtime.staringAtAnomalySec = 0;
    this.photographedAnomalyInStretch = false;
    return spawnStretchAnomalyHelper({
      adapter: this, usedAnomalyIds: this.usedAnomalyIds, overrideId, forceManifest,
    });
  }

  public manifestActiveAnomaly(): ActiveAnomalyInstance | null { return manifestActiveAnomalyHelper(this); }
  public catchActiveAnomaly(caughtByPhoto = false): boolean { return catchActiveAnomalyHelper(this, caughtByPhoto); }

  public setFlagHolding(holding: boolean): void {
    if (this.snapshot.isFlagHolding === holding) return;
    this.update({
      isFlagHolding: holding,
      flagHoldProgress: holding ? this.snapshot.flagHoldProgress : 0,
    });
  }

  public toggleCamera(force?: boolean): void {
    if (this.snapshot.phase === 'menu' || this.snapshot.phase === 'end') return;
    if (this.snapshot.activeMaskCheck) { this.showSubtitle({ text: 'Answer first.' }, 2.0); return; }
    if (this.snapshot.activeRestraint) { this.showSubtitle({ text: 'Not now. Keep holding.' }, 2.0); return; }
    const nextOpen = typeof force === 'boolean' ? force : !this.snapshot.cameraOpen;
    this.update({
      cameraOpen: nextOpen,
      evpOpen: nextOpen ? false : this.snapshot.evpOpen,
      albumOpen: nextOpen ? false : this.snapshot.albumOpen,
      evpIsRecording: nextOpen ? false : this.snapshot.evpIsRecording,
    });
  }

  public snapPolaroidPhoto(sourceCanvas?: HTMLCanvasElement | null): boolean {
    const res = snapPolaroidPhotoHelper({
      adapter: this, shutterCooldownSec: this.shutterCooldownSec, sourceCanvas,
    });
    this.shutterCooldownSec = res.nextShutterCooldownSec;
    if (res.framedAnomaly) this.photographedAnomalyInStretch = true;
    return res.framedAnomaly;
  }

  public toggleAlbum(force?: boolean): void {
    if (this.snapshot.phase === 'menu') return;
    const nextOpen = typeof force === 'boolean' ? force : !this.snapshot.albumOpen;
    if (nextOpen) pointerLock.unlock({ quiet: true });
    this.update({
      albumOpen: nextOpen,
      cameraOpen: nextOpen ? false : this.snapshot.cameraOpen,
      evpOpen: nextOpen ? false : this.snapshot.evpOpen,
    });
  }

  public toggleEvpRecorder(force?: boolean): void {
    const res = toggleEvpRecorderHelper({
      adapter: this, force,
      evpListenElapsedSec: this.runtime.evpListenElapsedSec,
      evpLastLockedId: this.runtime.evpLastLockedId,
    });
    this.runtime.evpListenElapsedSec = res.evpListenElapsedSec;
    this.runtime.evpLastLockedId = res.evpLastLockedId;
  }

  public stepEvpFrequency(deltaSteps: number): void {
    const res = stepEvpFrequencyHelper({
      adapter: this, deltaSteps,
      evpListenElapsedSec: this.runtime.evpListenElapsedSec,
      evpLastLockedId: this.runtime.evpLastLockedId,
    });
    this.runtime.evpListenElapsedSec = res.evpListenElapsedSec;
    this.runtime.evpLastLockedId = res.evpLastLockedId;
  }

  public setEvpFrequency(freqMhz: number): void {
    const res = setEvpFrequencyHelper({
      adapter: this, freqMhz,
      evpListenElapsedSec: this.runtime.evpListenElapsedSec,
      evpLastLockedId: this.runtime.evpLastLockedId,
    });
    this.runtime.evpListenElapsedSec = res.evpListenElapsedSec;
    this.runtime.evpLastLockedId = res.evpLastLockedId;
  }

  public setEvpRecording(recording: boolean): void {
    if (!this.snapshot.evpOpen && recording) return;
    if (this.snapshot.evpIsRecording === recording) return;
    this.update({
      evpIsRecording: recording,
      evpRecordProgress: recording ? this.snapshot.evpRecordProgress : 0,
    });
  }

  public toggleTapePlayback(tapeId: EvpSignalId): void { toggleTapePlaybackHelper(this, tapeId); }
  public triggerRestraintMoment(): void {
    this.runtime.restraintTriggeredInSegment = true;
    triggerRestraintMomentHelper(this, this.restraintBeats);
  }
  public notifyFocusLoss(): void { notifyRestraintFocusLossHelper(this); }
  public setRestraintHolding(holding: boolean): void { setRestraintHoldingHelper(this, holding); }

  public completeSafeHaven(): void {
    if (this.snapshot.phase !== 'haven') return;
    const route = this.snapshot.activeRoute;
    const nextIdx = Math.min(SEGMENT_TABLE.length - 1, this.snapshot.segmentTableIndex + 1);
    this.enterSegment(nextIdx);
    this.showSubtitle({
      speaker: 'Dad',
      text: formatRouteText('Feels good to stand up, right? Couple more stops after this. Then {terminus}.', route),
      stageDirection: 'You get back on with them.',
    }, 4.5);
  }

  public enterTrialRoom(stopNumber?: number): void { enterTrialRoomHelper(this, stopNumber); }
  public chooseTrialOption(choice: TrialChoiceId): void { chooseTrialOptionHelper(this, choice); }
  public exitTrial(): void { exitTrialHelper(this); }

  public recordStopDecision(seg: SegmentRule, steppedOff: boolean): void {
    const record = buildStopDecisionRecord(this.snapshot, seg, steppedOff);
    this.snapshot = { ...this.snapshot, stopDecisions: [...this.snapshot.stopDecisions, record] };
  }

  public startPracticeStretch(): void { startPracticeStretchHelper(this); }
  public startIntro(): void { this.startPracticeStretch(); }
  public advanceTutorialStep(): void { advanceTutorialStepHelper(this); }
  public finishPracticeStretch(): void { this.startRide({ chapter: 1, practice: false }); }
  public newGame(options?: { chapter?: ChapterStartOption; nightmare?: boolean; practice?: boolean }): void {
    this.startRide(options);
  }

  public startRide(options?: { chapter?: ChapterStartOption; nightmare?: boolean; practice?: boolean }): void {
    const settings = settingsStore.get();
    const chapter = options?.chapter ?? this.snapshot.startChapter;
    const isPractice = Boolean(options?.practice || chapter > 1);
    const initialSegmentTableIndex = getInitialSegmentTableIndexForChapter(chapter);
    const seg = getSegmentRuleByIndex(initialSegmentTableIndex);
    const originStationIdx = Math.max(0, seg.stationIndex - 1);
    const initialSanity = clampSanityForStop(100, seg.stopNumber);
    const initialTier = computeSanityTier(initialSanity);

    this.frameTimeAccumMs = 0;
    this.frameSampleCount = 0;
    this.stopElapsedSec = 0;
    this.havenElapsedSec = 0;
    this.headWhipCooldownSec = 0;
    this.paranoidFlashRemainingSec = 0;
    this.shutterCooldownSec = 0;
    this.photographedAnomalyInStretch = false;
    this.usedMaskCheckIds.clear();
    this.usedAnomalyIds.clear();
    this.resetSegmentRuntime();

    reshuffleEvpFrequencies();
    const eyeLevelPatch = resetPlayerCameraToSeatedEyeLevel(this.snapshot);
    pointerLock.clearErrorHint();

    const nightmare = options?.nightmare ?? this.snapshot.nightmareMode;
    const durationSec = computeStretchDurationSec(seg, nightmare);
    const rollsign = getChapterRollsign(chapter, 'G');
    this.rollsignRemainingSec = ROLLSIGN_DISPLAY_SEC;
    this.subtitleRemainingSec = 4.5;

    const firstAnomalyId = selectAnomalyIdForStretch({ segmentRule: seg, sanityTier: initialTier });
    if (firstAnomalyId) this.usedAnomalyIds.add(firstAnomalyId);

    this.snapshot = buildStartRideSnapshot({
      baseSnapshot: this.snapshot, chapter, nightmare, isPractice,
      initialSegmentTableIndex, seg, originStationIdx, initialSanity, initialTier,
      durationSec, rollsign,
      firstAnomaly: firstAnomalyId ? buildActiveAnomalyInstance(firstAnomalyId) : null,
      eyeLevelPatch,
    });

    if (
      settings.fullscreenOnBoard && typeof document !== 'undefined' &&
      !document.fullscreenElement && document.documentElement.requestFullscreen
    ) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    this.emit();
  }

  private resetSegmentRuntime(): void {
    this.stopElapsedSec = 0;
    this.havenElapsedSec = 0;
    this.photographedAnomalyInStretch = false;
    this.runtime = {
      nextStopPaAnnounced: false, passingTrainTriggered: false, clockSanityTickApplied: false,
      chatPart1Played: false, chatPart2Played: false, restraintTriggeredInSegment: false,
      maskChecksTriggeredInSegment: 0, staringAtAnomalySec: 0, stareReactionCooldownSec: 0,
      falseFlagCooldownSec: 0, evpListenElapsedSec: 0, evpLastLockedId: null,
      forcedWatcherLabel: null, forcedWatcherRemainingSec: 0,
    };
  }

  public enterSegment(tableIndex: number): void {
    this.resetSegmentRuntime();
    enterSegmentHelper(this, tableIndex, this.usedAnomalyIds);
  }

  public arriveAtCurrentStop(): void {
    this.stopElapsedSec = 0;
    const photographed = this.photographedAnomalyInStretch;
    this.photographedAnomalyInStretch = false;
    arriveAtCurrentStopHelper(this, photographed);
  }

  public stepRide(dtSec: number): void {
    if (this.snapshot.paused || this.snapshot.phase === 'menu' || this.snapshot.phase === 'end') return;

    this.headWhipCooldownSec = Math.max(0, this.headWhipCooldownSec - dtSec);
    this.runtime.stareReactionCooldownSec = Math.max(0, this.runtime.stareReactionCooldownSec - dtSec);
    this.runtime.falseFlagCooldownSec = Math.max(0, this.runtime.falseFlagCooldownSec - dtSec);
    this.shutterCooldownSec = Math.max(0, this.shutterCooldownSec - dtSec);
    if (this.runtime.forcedWatcherRemainingSec > 0) {
      this.runtime.forcedWatcherRemainingSec = Math.max(0, this.runtime.forcedWatcherRemainingSec - dtSec);
      if (this.runtime.forcedWatcherRemainingSec <= 0) this.runtime.forcedWatcherLabel = null;
    }

    let bannerChanged = false;
    if (this.snapshot.rollsign && this.rollsignRemainingSec > 0) {
      this.rollsignRemainingSec -= dtSec;
      if (this.rollsignRemainingSec <= 0) { this.snapshot.rollsign = null; bannerChanged = true; }
    }
    if (this.snapshot.subtitle && this.subtitleRemainingSec > 0) {
      this.subtitleRemainingSec -= dtSec;
      if (this.subtitleRemainingSec <= 0) { this.snapshot.subtitle = null; bannerChanged = true; }
    }
    if (this.snapshot.paranoidFlashText && this.paranoidFlashRemainingSec > 0) {
      this.paranoidFlashRemainingSec -= dtSec;
      if (this.paranoidFlashRemainingSec <= 0) { this.snapshot.paranoidFlashText = null; bannerChanged = true; }
    }
    if (this.snapshot.polaroidFlashIntensity > 0) {
      const nextFlash = Math.max(0, this.snapshot.polaroidFlashIntensity - POLAROID_FLASH_DECAY_PER_SEC * dtSec);
      this.snapshot.polaroidFlashIntensity = Number(nextFlash.toFixed(2));
      bannerChanged = true;
    }

    if (this.snapshot.phase === 'haven') {
      this.havenElapsedSec += dtSec;
      if (this.havenElapsedSec >= 4.2) { this.completeSafeHaven(); return; }
      if (bannerChanged) this.emit();
      return;
    }
    if (this.snapshot.phase === 'trial') { if (bannerChanged) this.emit(); return; }
    if (this.snapshot.phase === 'intro') {
      if (stepIntroTutorialFlagHelper(this, dtSec) || bannerChanged) this.emit();
      return;
    }

    if (this.snapshot.activeMaskCheck) {
      const nextRem = this.snapshot.activeMaskCheck.remainingSec - dtSec;
      if (nextRem <= 0) { handleMaskCheckTimeoutHelper(this); return; }
      const prevSecInt = Math.ceil(this.snapshot.activeMaskCheck.remainingSec);
      const nextSecInt = Math.ceil(nextRem);
      this.snapshot.activeMaskCheck = {
        ...this.snapshot.activeMaskCheck,
        remainingSec: Number(nextRem.toFixed(2)),
      };
      if (prevSecInt !== nextSecInt) bannerChanged = true;
    }

    if (this.snapshot.activeRestraint && this.snapshot.activeRestraint.active) {
      const restraintRes = stepActiveRestraintHelper({
        adapter: this, dtSec, beats: this.restraintBeats,
      });
      if (restraintRes.completedOrFailed) return;
      this.snapshot.activeRestraint = restraintRes.nextRestraint;
      if (bannerChanged || restraintRes.bannerChanged) this.emit();
      return;
    }

    if (this.snapshot.phase === 'ride') {
      const res = stepInTransitRideSegment({
        adapter: this, dtSec, runtime: this.runtime, bannerChanged,
      });
      if (res.shouldEmit) this.emit();
      return;
    }

    if (this.snapshot.phase === 'stop') {
      const seg = this.getCurrentSegmentRule();
      this.stopElapsedSec += dtSec;
      const doorState = computeStopDoorState(this.stopElapsedSec, seg.doorTell);
      const prevDoorBucket = Math.round(this.snapshot.doorOpenProgress * 10);
      const nextDoorBucket = Math.round(doorState.doorOpenProgress * 10);
      const stateChanged =
        doorState.chimePlaying !== this.snapshot.chimePlaying ||
        doorState.subPhase !== this.snapshot.rideSubPhase ||
        prevDoorBucket !== nextDoorBucket || bannerChanged;

      this.snapshot.chimePlaying = doorState.chimePlaying;
      this.snapshot.doorOpenProgress = doorState.doorOpenProgress;
      this.snapshot.rideSubPhase = doorState.subPhase;

      const totalStopTime = DOOR_CHIME_DURATION_SEC + STOP_DWELL_DURATION_SEC;
      if (seg.stopType !== 'final' && this.stopElapsedSec >= totalStopTime) {
        this.stayOnTrain();
        return;
      }
      if (stateChanged) this.emit();
    }
  }

  public stayOnTrain(): void { stayOnTrainHelper(this); }
  public stepOffTrain(): void { stepOffTrainHelper(this, () => { this.havenElapsedSec = 0; }); }
  public chooseCourtSqExit(choice: ExitChoiceId): void { chooseCourtSqExitHelper(this, choice); }

  public returnToMenu(): void {
    pointerLock.unlock({ quiet: true });
    const eyeLevelPatch = resetPlayerCameraToSeatedEyeLevel(this.snapshot);
    this.update(buildReturnToMenuPatch(eyeLevelPatch));
  }

  public togglePause(force?: boolean): void {
    if (this.snapshot.phase === 'menu' || this.snapshot.phase === 'end') return;
    const nextPaused = typeof force === 'boolean' ? force : !this.snapshot.paused;
    if (nextPaused) { pointerLock.unlock({ quiet: true }); this.notifyFocusLoss(); }
    this.update({ paused: nextPaused });
  }

  public toggleMute(force?: boolean): void {
    const nextMuted = typeof force === 'boolean' ? force : !this.snapshot.muted;
    this.update({ muted: nextMuted });
  }
  public setNightmareMode(enabled: boolean): void { this.update({ nightmareMode: enabled }); }
  public setStartChapter(chapter: ChapterStartOption): void {
    this.update({ startChapter: chapter, isPracticeRun: chapter > 1 });
  }

  public setActiveRoute(route: RouteLineId): void {
    const seg = this.getCurrentSegmentRule();
    const prevStationIdx = Math.max(0, seg.stationIndex - 1);
    const currentStationIdx =
      this.snapshot.phase === 'stop' || this.snapshot.phase === 'haven'
        ? seg.stationIndex : prevStationIdx;
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
        this.snapshot = { ...this.snapshot, fps: measuredFps, pixelRatio: nextPixelRatio };
        this.emit();
      }
      return ratioChanged ? nextPixelRatio : null;
    }
    return null;
  }
}

export const gameEngine = new GameEngine();

if (typeof window !== 'undefined' && !import.meta.env?.PROD) {
  const win = window as unknown as Record<string, unknown>;
  win.__G = gameEngine;
  win.__gameEngine = gameEngine;
  win.__lastLocalEngine = gameEngine;
}
