import {
  DOOR_CHIME_DURATION_SEC,
  EARLY_DOOR_OPEN_DELAY_SEC,
  ROLLSIGN_DISPLAY_SEC,
  SANITY_DELTAS,
  SEGMENT_TABLE,
  SUSPICION_DELTAS,
  TRAIN_CRUISE_SPEED_MPS,
} from '../constants';
import { pointerLock } from '../input/pointerLock';
import { settingsStore, triggerHapticPulse } from '../settings';
import type {
  AnomalyId,
  DoorTellType,
  EngineSnapshot,
  ExitChoiceId,
  SegmentRule,
  SubtitleItem,
} from '../types';
import {
  buildActiveAnomalyInstance,
  selectAnomalyIdForStretch,
} from './anomalyManager';
import {
  computeAnomalyAccuracyPercent,
  computeSanityRetainedPercent,
  evaluateRideEnding,
} from './endings';
import {
  computeArrivalFlickerIntensity,
  type RideSegmentRuntimeState,
  stepInTransitRideSegment,
} from './engineMovement';
import {
  computeSanityAfterCeilingDrop,
  computeStretchDurationSec,
} from './engineStops';
import { getChapterRollsign, getStopName, isElevatedOpenAirStop } from './routeManager';
import {
  formatRouteText,
  getArrivalPaText,
  getDeparturePaText,
} from './routeText';
import {
  chooseTrialOptionHelper,
  enterTrialRoomHelper,
  exitTrialHelper,
  type TrialChoiceId,
} from './tutorial';

export {
  chooseTrialOptionHelper,
  computeArrivalFlickerIntensity,
  enterTrialRoomHelper,
  exitTrialHelper,
  type RideSegmentRuntimeState,
  stepInTransitRideSegment,
  type TrialChoiceId,
};

export interface PhasesEngineAdapter {
  getSnapshot(): EngineSnapshot;
  getCurrentSegmentRule(): SegmentRule;
  update(patch: Partial<EngineSnapshot>): EngineSnapshot;
  showSubtitle(item: Omit<SubtitleItem, 'id'>, durationSec?: number): void;
  setRollsignRemainingSec(sec: number): void;
  setSubtitleRemainingSec(sec: number): void;
  enterSegment(tableIndex: number): void;
  arriveAtCurrentStop(): void;
  enterTrialRoom(stopNumber?: number): void;
  exitTrial(): void;
  stayOnTrain(): void;
  chooseCourtSqExit(choice: ExitChoiceId): void;
  recordStopDecision(seg: SegmentRule, steppedOff: boolean): void;
  catchActiveAnomaly(caughtByPhoto?: boolean): boolean;
  manifestActiveAnomaly(): unknown;
  triggerMaskCheck(): void;
  triggerRestraintMoment(): void;
  recordVisibleReaction(reason: string): void;
  emitPassingTrain(): void;
  finishPracticeStretch(): void;
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

export function enterSegmentHelper(
  adapter: PhasesEngineAdapter,
  tableIndex: number,
  usedAnomalyIds: Set<AnomalyId>
): void {
  const snapshot = adapter.getSnapshot();
  const clampedIdx = Math.max(0, Math.min(SEGMENT_TABLE.length - 1, tableIndex));
  const seg = SEGMENT_TABLE[clampedIdx]!;
  const route = snapshot.activeRoute;
  const prevStationIndex = Math.max(0, seg.stationIndex - 1);
  const durationSec = computeStretchDurationSec(seg, snapshot.nightmareMode);

  let nextRollsign = snapshot.rollsign;
  if (seg.id === '6') {
    nextRollsign = getChapterRollsign(2, route);
    adapter.setRollsignRemainingSec(ROLLSIGN_DISPLAY_SEC);
  } else if (seg.id === '11') {
    nextRollsign = getChapterRollsign(3, route);
    adapter.setRollsignRemainingSec(ROLLSIGN_DISPLAY_SEC);
  }

  const { sanity: nextSanity, sanityTier: nextTier } = computeSanityAfterCeilingDrop(
    snapshot.sanity,
    seg.stopNumber,
    snapshot.restraintCeilingBonus
  );

  const nextAnomalyId = selectAnomalyIdForStretch({
    segmentRule: seg,
    sanityTier: nextTier,
    alreadyUsedIds: Array.from(usedAnomalyIds),
  });
  if (nextAnomalyId) {
    usedAnomalyIds.add(nextAnomalyId);
  }

  const onTrestle = route === 'G' && seg.id === '12';
  const nextTrestleWitnessed = snapshot.trestleWitnessed || onTrestle;

  adapter.update({
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
    adapter.showSubtitle(
      {
        speaker: 'PA',
        text: getDeparturePaText(),
        isPa: true,
      },
      3.2
    );
  }
}

export function arriveAtCurrentStopHelper(
  adapter: PhasesEngineAdapter,
  photographedAnomalyInStretch: boolean
): void {
  const snapshot = adapter.getSnapshot();
  const seg = adapter.getCurrentSegmentRule();
  const route = snapshot.activeRoute;
  const stationName = getStopName(route, seg.stationIndex);
  const openAir = isElevatedOpenAirStop(route, seg.stationIndex);

  if (
    photographedAnomalyInStretch &&
    snapshot.activeAnomaly?.manifested &&
    !snapshot.activeAnomaly.caught
  ) {
    adapter.catchActiveAnomaly(true);
  }

  const postCatchSnap = adapter.getSnapshot();
  const missedActiveAnomaly =
    postCatchSnap.activeAnomaly?.manifested && !postCatchSnap.activeAnomaly.caught;
  const caughtActiveAnomaly = Boolean(
    postCatchSnap.activeAnomaly?.manifested && postCatchSnap.activeAnomaly.caught
  );
  const nextSanity = missedActiveAnomaly
    ? postCatchSnap.sanity + SANITY_DELTAS.MISS
    : postCatchSnap.sanity;

  if (caughtActiveAnomaly) {
    triggerHapticPulse(35);
  }

  adapter.update({
    phase: 'stop',
    rideSubPhase: 'chime',
    stopIndex: seg.stationIndex,
    currentStationName: stationName,
    nextStationName: getStopName(route, Math.min(12, seg.stationIndex + 1)),
    isOpenAirStation: openAir,
    isOnTrestle: openAir,
    trestleProgress: openAir ? 1 : 0,
    trestleWitnessed: postCatchSnap.trestleWitnessed || openAir,
    trainSpeedMps: 0,
    segmentElapsedSec: postCatchSnap.segmentDurationSec,
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
    adapter.showSubtitle(
      {
        speaker: 'Mom',
        text: 'I think this is our… let’s… stretch our legs.',
      },
      4.5
    );
  } else if (seg.stopType === 'haven') {
    adapter.showSubtitle(
      {
        speaker: 'Mom',
        text: 'I think this is our transfer. Let’s stretch our legs.',
        stageDirection: getArrivalPaText(route, seg),
      },
      4.5
    );
  } else if (seg.stopType === 'bait') {
    adapter.showSubtitle(
      {
        speaker: 'Mom',
        text: 'This is us. Come on, get up.',
        stageDirection: getArrivalPaText(route, seg),
      },
      4.5
    );
  } else if (seg.stopType === 'final') {
    adapter.showSubtitle(
      {
        speaker: 'Mom',
        text: formatRouteText('Here we are. {terminus}.', route),
        stageDirection: getArrivalPaText(route, seg),
      },
      5.0
    );
  } else if (!seg.silent) {
    adapter.showSubtitle(
      {
        speaker: 'PA',
        text: getArrivalPaText(route, seg),
        isPa: true,
      },
      4.5
    );
  }
}

export function stayOnTrainHelper(adapter: PhasesEngineAdapter): void {
  const snapshot = adapter.getSnapshot();
  if (snapshot.phase !== 'stop') return;
  const seg = adapter.getCurrentSegmentRule();
  if (seg.stopType === 'final') return;

  if (seg.stopType === 'haven') {
    const isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    adapter.update({
      hasRecorder: true,
      suspicion: snapshot.suspicion + SUSPICION_DELTAS.REFUSE_SAFE_HAVEN,
      lastReactionReason: 'Refused to step off when your parents asked',
    });
    adapter.recordStopDecision(seg, false);
    const nextIdx = snapshot.segmentTableIndex + 1;
    if (nextIdx < SEGMENT_TABLE.length) {
      adapter.enterSegment(nextIdx);
    }
    adapter.showSubtitle(
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

  adapter.update({
    suspicion: snapshot.suspicion + SUSPICION_DELTAS.CLEAN_STOP,
  });
  adapter.recordStopDecision(seg, false);

  const nextIdx = snapshot.segmentTableIndex + 1;
  if (nextIdx < SEGMENT_TABLE.length) {
    adapter.enterSegment(nextIdx);
  }
}

export function stepOffTrainHelper(
  adapter: PhasesEngineAdapter,
  resetHavenTimer: () => void
): void {
  const snapshot = adapter.getSnapshot();
  if (snapshot.phase !== 'stop') return;
  const seg = adapter.getCurrentSegmentRule();
  const route = snapshot.activeRoute;

  if (seg.stopType === 'final') {
    adapter.chooseCourtSqExit('escalators');
    return;
  }

  const nextIdx = Math.min(
    SEGMENT_TABLE.length - 1,
    snapshot.segmentTableIndex + 1
  );

  if (seg.stopType === 'haven') {
    const isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    resetHavenTimer();
    adapter.update({
      phase: 'haven',
      safeHavenVisited: true,
      hasRecorder: true,
      sanity: snapshot.sanity + SANITY_DELTAS.SAFE_HAVEN,
    });
    adapter.recordStopDecision(seg, true);
    adapter.showSubtitle(
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

  if (seg.stopType === 'false' && seg.forgivingFalseStop) {
    adapter.recordStopDecision(seg, true);
    adapter.enterSegment(nextIdx);
    adapter.showSubtitle(
      {
        speaker: 'Mom',
        text: 'Not this one, hon. The doors opened funny.',
        stageDirection: 'Mom grabs your sleeve.',
      },
      4.2
    );
    return;
  }

  if (seg.stopType === 'bait') {
    adapter.recordStopDecision(seg, true);
    pointerLock.unlock({ quiet: true });

    const postDecisionSnap = adapter.getSnapshot();
    const sanityRetainedPercent = computeSanityRetainedPercent({
      stopDecisions: postDecisionSnap.stopDecisions,
      finalSanity: postDecisionSnap.sanity,
      restraintHeld: postDecisionSnap.restraintHeld,
    });
    const anomalyAccuracyPercent = computeAnomalyAccuracyPercent(
      postDecisionSnap.anomaliesCaughtCount,
      postDecisionSnap.anomaliesSpawnedCount
    );
    const resolvedEnding = evaluateRideEnding({
      route,
      selectedExit: null,
      peakSuspicion: postDecisionSnap.peakSuspicion,
      sanityRetainedPercent,
      anomalyAccuracyPercent,
      tapesCount: postDecisionSnap.tapes.length,
      hasConductorOnTape: postDecisionSnap.hasConductorEvp,
      restraintHeld: postDecisionSnap.restraintHeld,
      falseStopTrialsCount: postDecisionSnap.falseStopTrials.length,
      interventionsCount: postDecisionSnap.interventionsCount,
      steppedOffAtBait: true,
    });

    if (!postDecisionSnap.isPracticeRun && !postDecisionSnap.isDebugRun) {
      const archive = settingsStore.getArchive();
      const nextDocEndings = archive.documentedEndings.includes(resolvedEnding.id)
        ? archive.documentedEndings
        : [...archive.documentedEndings, resolvedEnding.id];
      settingsStore.updateArchive({
        finishedRides: archive.finishedRides + 1,
        documentedEndings: nextDocEndings,
      });
    }

    adapter.update({
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
      photos: postDecisionSnap.photos.map((p) => ({ ...p, developed: true })),
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

  if (seg.stopType === 'false') {
    adapter.recordStopDecision(seg, true);
    adapter.enterTrialRoom(seg.stopNumber);
    return;
  }

  adapter.recordStopDecision(seg, true);
  adapter.enterSegment(nextIdx);
  adapter.showSubtitle(
    {
      speaker: 'Dad',
      text: 'Hey! Where are you going? Get back in here.',
      stageDirection: 'Stepped off at a real stop',
    },
    3.8
  );
}

export function chooseCourtSqExitHelper(
  adapter: PhasesEngineAdapter,
  choice: ExitChoiceId
): void {
  const seg = adapter.getCurrentSegmentRule();
  adapter.recordStopDecision(seg, true);
  pointerLock.unlock({ quiet: true });
  const stageText =
    choice === 'escalators'
      ? 'You follow your parents toward the escalators.'
      : choice === 'lower_level'
        ? 'You drift toward the side stairs. The hiss in your pocket gets louder.'
        : 'You lean on the emergency bar. Somewhere above, the air is moving.';

  const snapshot = adapter.getSnapshot();
  const sanityRetainedPercent = computeSanityRetainedPercent({
    stopDecisions: snapshot.stopDecisions,
    finalSanity: snapshot.sanity,
    restraintHeld: snapshot.restraintHeld,
  });
  const anomalyAccuracyPercent = computeAnomalyAccuracyPercent(
    snapshot.anomaliesCaughtCount,
    snapshot.anomaliesSpawnedCount
  );
  const resolvedEnding = evaluateRideEnding({
    route: snapshot.activeRoute,
    selectedExit: choice,
    peakSuspicion: snapshot.peakSuspicion,
    sanityRetainedPercent,
    anomalyAccuracyPercent,
    tapesCount: snapshot.tapes.length,
    hasConductorOnTape: snapshot.hasConductorEvp,
    restraintHeld: snapshot.restraintHeld,
    falseStopTrialsCount: snapshot.falseStopTrials.length,
    interventionsCount: snapshot.interventionsCount,
    steppedOffAtBait: snapshot.steppedOffAtBait,
  });

  if (!snapshot.isPracticeRun && !snapshot.isDebugRun) {
    const archive = settingsStore.getArchive();
    const nextDocEndings = archive.documentedEndings.includes(resolvedEnding.id)
      ? archive.documentedEndings
      : [...archive.documentedEndings, resolvedEnding.id];
    settingsStore.updateArchive({
      finishedRides: archive.finishedRides + 1,
      documentedEndings: nextDocEndings,
    });
  }

  adapter.update({
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
    photos: snapshot.photos.map((p) => ({ ...p, developed: true })),
    activeMaskCheck: null,
    activeRestraint: null,
    watchingParentLabel: null,
    subtitle: {
      id: 'exit-choice',
      text: stageText,
    },
  });
}
