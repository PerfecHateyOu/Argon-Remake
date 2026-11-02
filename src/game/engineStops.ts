import {
  DEFAULT_CRUISE_DURATION_SEC,
  EVP_FREQ_DEFAULT_MHZ,
  GOVERNOR_FRAME_TIME_THRESHOLD_MS,
  GOVERNOR_PIXEL_RATIO_STEP,
  MAX_PIXEL_RATIO_DESKTOP,
  MAX_PIXEL_RATIO_TOUCH,
  MIN_PIXEL_RATIO,
  PLAYER_SEAT_X,
  PLAYER_SEAT_Z,
  SANITY_BANDS_BY_STOP,
  SANITY_DELTAS,
  SANITY_TIER_THRESHOLDS,
  SEGMENT_TABLE,
  STARTING_FILM,
  SUSPICION_INTERVENTION_THRESHOLD,
  TRAIN_CRUISE_SPEED_MPS,
  TRAIN_NIGHTMARE_SPEED_MULT,
} from '../constants';
import { settingsStore } from '../settings';
import type {
  ActiveAnomalyInstance,
  ChapterStartOption,
  EngineSnapshot,
  RollsignBanner,
  SanityTier,
  SegmentRule,
  StopDecisionRecord,
} from '../types';
import { evaluateUnlockedAchievements } from './achievements';
import { EXTRA_CALM_SMALL_TALK, PARENT_RIDE_CHATS } from './carLife';
import {
  computeAnomalyAccuracyPercent,
  computeSanityRetainedPercent,
} from './endings';
import { evaluateSuspicionIntervention } from './passengerBehavior';
import { getStopName, isElevatedOpenAirStop } from './routeManager';
import { getBoardingPaText } from './routeText';

export { SANITY_BANDS_BY_STOP, SEGMENT_TABLE };

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

export function getSegmentRuleByIndex(tableIndex: number): SegmentRule {
  return (
    SEGMENT_TABLE[tableIndex] ??
    SEGMENT_TABLE[SEGMENT_TABLE.length - 1]!
  );
}

export function getInitialSegmentTableIndexForChapter(chapter: ChapterStartOption): number {
  if (chapter === 1) return 0;
  if (chapter === 2) return 4;
  return 10;
}

export function computeStretchDurationSec(seg: SegmentRule, nightmareMode: boolean): number {
  const baseDuration = seg.cruiseDurationSec ?? DEFAULT_CRUISE_DURATION_SEC;
  return nightmareMode ? baseDuration / TRAIN_NIGHTMARE_SPEED_MULT : baseDuration;
}

export function computeSanityAfterCeilingDrop(
  currentSanity: number,
  stopNumber: number,
  restraintCeilingBonus: number
): { sanity: number; sanityTier: SanityTier } {
  const band = SANITY_BANDS_BY_STOP[stopNumber] ?? [0, 100];
  const maxBand = Math.min(100, band[1] + restraintCeilingBonus);
  const driftedSanity =
    currentSanity > maxBand
      ? currentSanity + SANITY_DELTAS.DRIFT_ON_CEILING_DROP
      : currentSanity;
  const nextSanity = clampSanityForStop(driftedSanity, stopNumber, restraintCeilingBonus);
  return {
    sanity: nextSanity,
    sanityTier: computeSanityTier(nextSanity),
  };
}

export function getSegmentChatPair(seg: SegmentRule) {
  if (typeof seg.chatIndex !== 'number') return null;
  const archive = settingsStore.getArchive();
  if (archive.finishedRides > 0 && seg.chatIndex <= 2) {
    return EXTRA_CALM_SMALL_TALK[seg.chatIndex] ?? PARENT_RIDE_CHATS[seg.chatIndex] ?? null;
  }
  return PARENT_RIDE_CHATS[seg.chatIndex] ?? null;
}

export function buildStopDecisionRecord(
  snapshot: EngineSnapshot,
  seg: SegmentRule,
  steppedOff: boolean
): StopDecisionRecord {
  const route = snapshot.activeRoute;
  const stationName = getStopName(route, seg.stationIndex);
  const band = SANITY_BANDS_BY_STOP[seg.stopNumber] ?? [0, 100];
  const maxBand = Math.min(100, band[1] + snapshot.restraintCeilingBonus);

  return {
    segmentId: seg.id,
    stopNumber: seg.stopNumber,
    stationName,
    stopType: seg.stopType,
    doorTell: seg.doorTell,
    steppedOff,
    sanityAfter: snapshot.sanity,
    sanityBandMin: band[0],
    sanityBandMax: maxBand,
  };
}

export function applyEngineUpdatePatch(
  snapshot: EngineSnapshot,
  patch: Partial<EngineSnapshot>
): { nextSnapshot: EngineSnapshot; intervened: boolean } {
  const segRule = getSegmentRuleByIndex(
    patch.segmentTableIndex ?? snapshot.segmentTableIndex
  );
  const stopNum = segRule.stopNumber;
  const restraintBonus = patch.restraintCeilingBonus ?? snapshot.restraintCeilingBonus;

  const nextSanity =
    typeof patch.sanity === 'number'
      ? clampSanityForStop(patch.sanity, stopNum, restraintBonus)
      : snapshot.sanity;

  const rawSuspicion =
    typeof patch.suspicion === 'number'
      ? Math.max(0, Math.round(patch.suspicion))
      : snapshot.suspicion;

  const nextPeakSuspicion = Math.max(
    patch.peakSuspicion ?? snapshot.peakSuspicion,
    Math.min(SUSPICION_INTERVENTION_THRESHOLD, rawSuspicion)
  );

  const intervention = evaluateSuspicionIntervention(rawSuspicion);
  const finalSuspicion = intervention.nextSuspicion;
  const finalSanity = intervention.intervened
    ? clampSanityForStop(nextSanity + intervention.sanityDelta, stopNum, restraintBonus)
    : nextSanity;
  const finalInterventionsCount =
    (patch.interventionsCount ?? snapshot.interventionsCount) +
    (intervention.intervened ? 1 : 0);

  const nextSnapshot: EngineSnapshot = {
    ...snapshot,
    ...patch,
    sanity: finalSanity,
    sanityTier: computeSanityTier(finalSanity),
    suspicion: finalSuspicion,
    peakSuspicion: nextPeakSuspicion,
    interventionsCount: finalInterventionsCount,
    lastReactionReason: intervention.intervened
      ? intervention.eventLabel
      : (patch.lastReactionReason ?? snapshot.lastReactionReason),
  };

  nextSnapshot.sanityRetainedPercent =
    patch.sanityRetainedPercent ??
    computeSanityRetainedPercent({
      stopDecisions: nextSnapshot.stopDecisions,
      finalSanity: nextSnapshot.sanity,
      restraintHeld: nextSnapshot.restraintHeld,
    });
  nextSnapshot.anomalyAccuracyPercent =
    patch.anomalyAccuracyPercent ??
    computeAnomalyAccuracyPercent(
      nextSnapshot.anomaliesCaughtCount,
      nextSnapshot.anomaliesSpawnedCount
    );

  if (!nextSnapshot.isPracticeRun && !nextSnapshot.isDebugRun) {
    const archive = settingsStore.getArchive();
    const nextAchievements = evaluateUnlockedAchievements({
      existingUnlockedIds: archive.unlockedAchievements,
      documentedAnomaliesCount: archive.documentedAnomalies.length,
      anomaliesCaughtCount: nextSnapshot.anomaliesCaughtCount,
      rideAnomalies: nextSnapshot.rideAnomalies,
      photos: nextSnapshot.photos,
      tapes: nextSnapshot.tapes,
      hasSecretBroadcasterEvp: nextSnapshot.hasSecretBroadcasterEvp,
      trestleWitnessed: nextSnapshot.trestleWitnessed,
      rideCompleted: nextSnapshot.phase === 'end',
      steppedOffAtBait: nextSnapshot.steppedOffAtBait,
      peakSuspicion: nextSnapshot.peakSuspicion,
      resolvedEnding: nextSnapshot.resolvedEnding,
    });
    if (nextAchievements.length !== archive.unlockedAchievements.length) {
      settingsStore.updateArchive({ unlockedAchievements: nextAchievements });
    }
  }

  if (intervention.intervened) {
    nextSnapshot.subtitle = {
      id: `intervention-${Date.now()}`,
      speaker: 'Dad',
      text: 'Hey. Look at me. Both of us, right now. Talk to us. What is going on with you?',
    };
  }

  return { nextSnapshot, intervened: intervention.intervened };
}

export function createInitialEngineSnapshot(): EngineSnapshot {
  const settings = settingsStore.get();
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  return {
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
    playerPitch: 0,
  };
}

export function buildStartRideSnapshot(params: {
  baseSnapshot: EngineSnapshot;
  chapter: ChapterStartOption;
  nightmare: boolean;
  isPractice: boolean;
  initialSegmentTableIndex: number;
  seg: SegmentRule;
  originStationIdx: number;
  initialSanity: number;
  initialTier: SanityTier;
  durationSec: number;
  rollsign: RollsignBanner;
  firstAnomaly: ActiveAnomalyInstance | null;
  eyeLevelPatch: Pick<
    EngineSnapshot,
    'carLocation' | 'nearGangwayDoor' | 'playerX' | 'playerZ' | 'playerYaw' | 'playerPitch'
  >;
}): EngineSnapshot {
  const settings = settingsStore.get();
  const {
    baseSnapshot,
    chapter,
    nightmare,
    isPractice,
    initialSegmentTableIndex,
    seg,
    originStationIdx,
    initialSanity,
    initialTier,
    durationSec,
    rollsign,
    firstAnomaly,
    eyeLevelPatch,
  } = params;

  return {
    ...baseSnapshot,
    ...eyeLevelPatch,
    phase: 'ride',
    rideSubPhase: 'departing',
    paused: false,
    muted: settings.startMuted ? true : baseSnapshot.muted,
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
    activeAnomaly: firstAnomaly,
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
  };
}

export function buildReturnToMenuPatch(
  eyeLevelPatch: Pick<
    EngineSnapshot,
    'carLocation' | 'nearGangwayDoor' | 'playerX' | 'playerZ' | 'playerYaw' | 'playerPitch'
  >
): Partial<EngineSnapshot> {
  return {
    ...eyeLevelPatch,
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
  };
}
