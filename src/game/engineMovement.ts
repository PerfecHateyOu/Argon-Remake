import {
  BRAKING_DURATION_SEC,
  DEPARTURE_ACCEL_DURATION_SEC,
  EVP_RECORD_DURATION_SEC,
  PA_NEXT_STOP_ANNOUNCE_SEC,
  PLAYER_SEAT_X,
  PLAYER_SEAT_Z,
  SANITY_DELTAS,
  TRAIN_CRUISE_SPEED_MPS,
  TRAIN_NIGHTMARE_SPEED_MULT,
} from '../constants';
import {
  clampPlayerConsistPosition,
  isNearGangwayDoor,
  playerController,
  resolveConsistLocation,
  stepWalkAxisVelocity,
} from '../input/keyLook';
import { settingsStore } from '../settings';
import type {
  DoorTellType,
  EngineSnapshot,
  EvpSignalId,
  RideSubPhase,
  SegmentRule,
  SubtitleItem,
} from '../types';
import {
  isLookingAtAnomaly,
  shouldAnomalyManifest,
  stepFlagHoldProgress,
} from './anomalyManager';
import { getSegmentChatPair } from './engineStops';
import { computeActiveParentWatcher } from './engineWatching';
import {
  buildEvpTapeRecord,
  evaluateEvpTuning,
} from './evpManager';
import { evaluateHeadWhipReaction } from './passengerBehavior';
import { getNextStopPaText } from './routeText';

export {
  clampPlayerConsistPosition,
  isNearGangwayDoor,
  resolveConsistLocation,
  stepWalkAxisVelocity,
};

export interface RideSegmentRuntimeState {
  nextStopPaAnnounced: boolean;
  passingTrainTriggered: boolean;
  clockSanityTickApplied: boolean;
  chatPart1Played: boolean;
  chatPart2Played: boolean;
  restraintTriggeredInSegment: boolean;
  maskChecksTriggeredInSegment: number;
  staringAtAnomalySec: number;
  stareReactionCooldownSec: number;
  falseFlagCooldownSec: number;
  evpListenElapsedSec: number;
  evpLastLockedId: EvpSignalId | null;
  forcedWatcherLabel: 'Mom' | 'Dad' | null;
  forcedWatcherRemainingSec: number;
}

export interface TransitEngineAdapter {
  getSnapshot(): EngineSnapshot;
  getCurrentSegmentRule(): SegmentRule;
  update(patch: Partial<EngineSnapshot>): EngineSnapshot;
  showSubtitle(item: Omit<SubtitleItem, 'id'>, durationSec?: number): void;
  arriveAtCurrentStop(): void;
  catchActiveAnomaly(caughtByPhoto?: boolean): boolean;
  manifestActiveAnomaly(): unknown;
  triggerMaskCheck(): void;
  triggerRestraintMoment(): void;
  recordVisibleReaction(reason: string): void;
  emitPassingTrain(): void;
}

/**
 * Resets the player's kinematic controller and snapshot coordinates to seated eye-level
 * facing directly across the car (playerPitch === 0.0, playerYaw === 0.0).
 */
export function resetPlayerCameraToSeatedEyeLevel(
  _snapshot: EngineSnapshot
): Pick<
  EngineSnapshot,
  'carLocation' | 'nearGangwayDoor' | 'playerX' | 'playerZ' | 'playerYaw' | 'playerPitch'
> {
  playerController.resetToSeat();
  return {
    carLocation: 'CAR B (MID)',
    nearGangwayDoor: false,
    playerX: PLAYER_SEAT_X,
    playerZ: PLAYER_SEAT_Z,
    playerYaw: 0,
    playerPitch: 0,
  };
}

export interface SyncPlayerPoseOutcome {
  nextSnapshot: EngineSnapshot;
  shouldEmit: boolean;
  nextHeadWhipCooldownSec: number;
  triggeredWhipReason: string | null;
}

/**
 * Synchronizes player kinematics (x, z, yaw, pitch), car/gangway transitions,
 * and evaluates head-whip suspicion reactions while a parent is watching.
 */
export function syncPlayerPoseHelper(params: {
  snapshot: EngineSnapshot;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  headWhipCooldownSec: number;
}): SyncPlayerPoseOutcome {
  const { snapshot, x, z, yaw, pitch, headWhipCooldownSec } = params;
  const nextLoc = resolveConsistLocation(x);
  const nextNearDoor = isNearGangwayDoor(x);
  const settings = settingsStore.get();

  const kinState = playerController.getState();
  const whipResult = evaluateHeadWhipReaction({
    angularSpeedRadS: kinState.angularSpeedRadS,
    cumulativeTouchTurnRad: kinState.touchTurnAccumRad,
    isTouchDrag: kinState.lastInputSource === 'touch',
    watchingParentLabel: snapshot.watchingParentLabel,
    cooldownRemainingSec: headWhipCooldownSec,
  });

  const nextHeadWhipCooldownSec =
    whipResult.triggered && whipResult.reason
      ? whipResult.nextCooldownSec
      : headWhipCooldownSec;
  const triggeredWhipReason =
    whipResult.triggered && whipResult.reason ? whipResult.reason : null;

  const locChanged =
    nextLoc !== snapshot.carLocation || nextNearDoor !== snapshot.nearGangwayDoor;
  const debugNeedsCoords =
    settings.debugOverlay &&
    (Math.abs(x - snapshot.playerX) > 0.05 ||
      Math.abs(z - snapshot.playerZ) > 0.05 ||
      Math.abs(yaw - snapshot.playerYaw) > 0.05);

  const nextSnapshot: EngineSnapshot = {
    ...snapshot,
    playerX: Number(x.toFixed(2)),
    playerZ: Number(z.toFixed(2)),
    playerYaw: Number(yaw.toFixed(2)),
    playerPitch: Number(pitch.toFixed(2)),
    carLocation: locChanged || debugNeedsCoords ? nextLoc : snapshot.carLocation,
    nearGangwayDoor: locChanged || debugNeedsCoords ? nextNearDoor : snapshot.nearGangwayDoor,
  };

  return {
    nextSnapshot,
    shouldEmit: locChanged || debugNeedsCoords,
    nextHeadWhipCooldownSec,
    triggeredWhipReason,
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

export function stepInTransitRideSegment(params: {
  adapter: TransitEngineAdapter;
  dtSec: number;
  runtime: RideSegmentRuntimeState;
  bannerChanged: boolean;
}): { shouldEmit: boolean } {
  const { adapter, dtSec, runtime } = params;
  let { bannerChanged } = params;
  const snapshot = adapter.getSnapshot();
  const seg = adapter.getCurrentSegmentRule();
  const maxCruiseSpeed =
    TRAIN_CRUISE_SPEED_MPS *
    (snapshot.nightmareMode ? TRAIN_NIGHTMARE_SPEED_MULT : 1.0);

  const nextElapsed = snapshot.segmentElapsedSec + dtSec;
  const totalDur = snapshot.segmentDurationSec;
  const timeRemaining = Math.max(0, totalDur - nextElapsed);

  if (nextElapsed >= totalDur) {
    adapter.arriveAtCurrentStop();
    return { shouldEmit: false };
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

  const chatPair = getSegmentChatPair(seg);
  if (chatPair && !runtime.chatPart1Played && nextElapsed >= 3.6) {
    runtime.chatPart1Played = true;
    adapter.showSubtitle(
      {
        speaker: chatPair.first.speakerLabel,
        text: chatPair.first.text,
      },
      2.1
    );
  }
  if (chatPair && !runtime.chatPart2Played && nextElapsed >= 5.8) {
    runtime.chatPart2Played = true;
    adapter.showSubtitle(
      {
        speaker: chatPair.second.speakerLabel,
        text: chatPair.second.text,
      },
      2.4
    );
  }

  if (
    !runtime.nextStopPaAnnounced &&
    nextElapsed >= PA_NEXT_STOP_ANNOUNCE_SEC &&
    !seg.silent
  ) {
    runtime.nextStopPaAnnounced = true;
    adapter.showSubtitle(
      {
        speaker: 'PA',
        text: getNextStopPaText(snapshot.activeRoute, seg.stationIndex),
        isPa: true,
      },
      3.2
    );
  }

  if (
    seg.restraint &&
    !runtime.restraintTriggeredInSegment &&
    nextElapsed >= 8.2 &&
    !snapshot.activeRestraint
  ) {
    runtime.restraintTriggeredInSegment = true;
    adapter.triggerRestraintMoment();
    return { shouldEmit: false };
  }

  if (
    seg.maskChecksCount >= 1 &&
    runtime.maskChecksTriggeredInSegment === 0 &&
    nextElapsed >= 9.5 &&
    !snapshot.activeMaskCheck &&
    !snapshot.activeRestraint
  ) {
    runtime.maskChecksTriggeredInSegment = 1;
    adapter.triggerMaskCheck();
  } else if (
    seg.maskChecksCount >= 2 &&
    runtime.maskChecksTriggeredInSegment === 1 &&
    nextElapsed >= 14.2 &&
    !snapshot.activeMaskCheck &&
    !snapshot.activeRestraint
  ) {
    runtime.maskChecksTriggeredInSegment = 2;
    adapter.triggerMaskCheck();
  }

  if (!runtime.clockSanityTickApplied && nextElapsed >= totalDur * 0.6) {
    runtime.clockSanityTickApplied = true;
    const clockDelta = snapshot.nightmareMode
      ? SANITY_DELTAS.CLOCK * 2
      : SANITY_DELTAS.CLOCK;
    adapter.update({
      sanity: adapter.getSnapshot().sanity + clockDelta,
    });
  }

  if (!runtime.passingTrainTriggered && nextElapsed >= totalDur * 0.45 && !seg.thin) {
    runtime.passingTrainTriggered = true;
    adapter.emitPassingTrain();
  }

  const latestSnap = adapter.getSnapshot();
  const nextWatcher = computeActiveParentWatcher({
    snapshot: latestSnap,
    seg,
    nextElapsedSec: nextElapsed,
    forcedWatcherLabel: runtime.forcedWatcherLabel,
    forcedWatcherRemainingSec: runtime.forcedWatcherRemainingSec,
  });

  const camY = playerController.getState().y || 1.24;
  const currentAnomaly = latestSnap.activeAnomaly;

  if (currentAnomaly && !currentAnomaly.manifested && nextElapsed >= 1.5) {
    const canManifest = shouldAnomalyManifest({
      anomaly: currentAnomaly,
      cameraX: latestSnap.playerX,
      cameraY: camY,
      cameraZ: latestSnap.playerZ,
      yaw: latestSnap.playerYaw,
      pitch: latestSnap.playerPitch,
      stretchElapsedSec: nextElapsed,
      stretchDurationSec: totalDur,
    });
    if (canManifest) {
      adapter.manifestActiveAnomaly();
      bannerChanged = true;
    }
  }

  const snapAfterManifest = adapter.getSnapshot();
  const lookingAtActive = isLookingAtAnomaly(
    snapAfterManifest.activeAnomaly,
    snapAfterManifest.playerX,
    camY,
    snapAfterManifest.playerZ,
    snapAfterManifest.playerYaw,
    snapAfterManifest.playerPitch
  );

  if (lookingAtActive && nextWatcher !== null) {
    runtime.staringAtAnomalySec += dtSec;
    if (runtime.staringAtAnomalySec >= 1.35 && runtime.stareReactionCooldownSec <= 0) {
      runtime.staringAtAnomalySec = 0;
      runtime.stareReactionCooldownSec = 3.5;
      adapter.recordVisibleReaction(
        `Stared at something wrong while ${nextWatcher} was watching`
      );
      bannerChanged = true;
    }
  } else {
    runtime.staringAtAnomalySec = Math.max(0, runtime.staringAtAnomalySec - dtSec * 2.0);
  }

  const snapBeforeFlag = adapter.getSnapshot();
  if (snapBeforeFlag.isFlagHolding || snapBeforeFlag.flagHoldProgress > 0) {
    const flagStep = stepFlagHoldProgress({
      isHolding: snapBeforeFlag.isFlagHolding,
      currentProgress: snapBeforeFlag.flagHoldProgress,
      dtSec,
      lookingAtActiveAnomaly: lookingAtActive,
    });

    const prevBucket = Math.round(snapBeforeFlag.flagHoldProgress * 20);
    const nextBucket = Math.round(flagStep.nextProgress * 20);
    snapBeforeFlag.flagHoldProgress = Number(flagStep.nextProgress.toFixed(2));
    if (prevBucket !== nextBucket) {
      bannerChanged = true;
    }

    if (flagStep.completedCatch) {
      adapter.catchActiveAnomaly(false);
      bannerChanged = true;
    } else if (flagStep.completedFalseFlag && runtime.falseFlagCooldownSec <= 0) {
      runtime.falseFlagCooldownSec = 2.5;
      adapter.update({
        isFlagHolding: false,
        flagHoldProgress: 0,
        falseFlagsCount: snapBeforeFlag.falseFlagsCount + 1,
        sanity: snapBeforeFlag.sanity + SANITY_DELTAS.FALSE_FLAG,
      });
      bannerChanged = true;
    }
  }

  const snapBeforeEvp = adapter.getSnapshot();
  if (snapBeforeEvp.evpOpen) {
    const isAboveGround =
      (snapBeforeEvp.activeRoute === 'G' && seg.id === '12') ||
      snapBeforeEvp.isOpenAirStation;
    const prelimRes = evaluateEvpTuning({
      frequencyMhz: snapBeforeEvp.evpFrequencyMhz,
      trainSpeedMps: nextSpeed,
      route: snapBeforeEvp.activeRoute,
      isAboveGround,
      stopNumber: seg.stopNumber,
      listenElapsedSec: 0,
    });
    if (prelimRes.lockedSpec) {
      if (runtime.evpLastLockedId === prelimRes.lockedSpec.id) {
        runtime.evpListenElapsedSec += dtSec;
      } else {
        runtime.evpLastLockedId = prelimRes.lockedSpec.id;
        runtime.evpListenElapsedSec = dtSec;
      }
    } else {
      runtime.evpLastLockedId = null;
      runtime.evpListenElapsedSec = 0;
    }

    const evalRes = evaluateEvpTuning({
      frequencyMhz: snapBeforeEvp.evpFrequencyMhz,
      trainSpeedMps: nextSpeed,
      route: snapBeforeEvp.activeRoute,
      isAboveGround,
      stopNumber: seg.stopNumber,
      listenElapsedSec: runtime.evpListenElapsedSec,
    });

    if (snapBeforeEvp.evpTranscriptLive !== evalRes.liveTranscript) {
      bannerChanged = true;
    }
    snapBeforeEvp.evpSignalStrength = evalRes.signalStrength;
    snapBeforeEvp.evpLockedSignalId = evalRes.lockedSpec ? evalRes.lockedSpec.id : null;
    snapBeforeEvp.evpLockedTitle = evalRes.lockedTitle;
    snapBeforeEvp.evpTranscriptLive = evalRes.liveTranscript;

    if (snapBeforeEvp.evpIsRecording && evalRes.lockedSpec) {
      const nextRecProg = Math.min(
        1,
        snapBeforeEvp.evpRecordProgress + dtSec / EVP_RECORD_DURATION_SEC
      );
      if (nextRecProg >= 1) {
        const spec = evalRes.lockedSpec;
        const newTape = buildEvpTapeRecord({
          spec,
          route: snapBeforeEvp.activeRoute,
          isAboveGround,
          stopNumber: seg.stopNumber,
        });
        const alreadyRecorded = snapBeforeEvp.tapes.some((t) => t.id === newTape.id);
        const nextTapes = alreadyRecorded
          ? snapBeforeEvp.tapes.map((t) => (t.id === newTape.id ? newTape : t))
          : [...snapBeforeEvp.tapes, newTape];

        adapter.update({
          tapes: nextTapes,
          evpIsRecording: false,
          evpRecordProgress: 0,
          evpLastSavedTitle: newTape.title,
          hasConductorEvp: snapBeforeEvp.hasConductorEvp || spec.isConductor,
          hasSecretBroadcasterEvp:
            snapBeforeEvp.hasSecretBroadcasterEvp || spec.isSecretBroadcaster,
        });
        bannerChanged = true;
      } else {
        snapBeforeEvp.evpRecordProgress = Number(nextRecProg.toFixed(2));
        bannerChanged = true;
      }
    } else if (!snapBeforeEvp.evpIsRecording && snapBeforeEvp.evpRecordProgress > 0) {
      snapBeforeEvp.evpRecordProgress = 0;
      bannerChanged = true;
    }
  }

  const finalSnap = adapter.getSnapshot();
  // Restraint NEVER dims car lights; only arrival door-tick ('lights_flicker') flickers the door tube
  const nextFlicker = computeArrivalFlickerIntensity(timeRemaining, seg.doorTell);
  const subPhaseChanged = nextSubPhase !== finalSnap.rideSubPhase;
  const flickerChanged = Math.abs(nextFlicker - finalSnap.lightFlickerIntensity) > 0.02;
  const watcherChanged = nextWatcher !== finalSnap.watchingParentLabel;

  const onTrestle = finalSnap.activeRoute === 'G' && seg.id === '12';
  finalSnap.isOnTrestle = onTrestle;
  finalSnap.trestleProgress = onTrestle
    ? Number((nextElapsed / Math.max(1, totalDur)).toFixed(2))
    : 0;
  if (onTrestle && !finalSnap.trestleWitnessed) {
    finalSnap.trestleWitnessed = true;
  }

  finalSnap.segmentElapsedSec = Number(nextElapsed.toFixed(2));
  finalSnap.trainSpeedMps = Number(nextSpeed.toFixed(2));
  finalSnap.stationDistanceM = Number(stationDistanceM.toFixed(2));
  finalSnap.lightFlickerIntensity = nextFlicker;
  finalSnap.rideSubPhase = nextSubPhase;
  finalSnap.watchingParentLabel = nextWatcher;

  return {
    shouldEmit: subPhaseChanged || flickerChanged || watcherChanged || bannerChanged,
  };
}
