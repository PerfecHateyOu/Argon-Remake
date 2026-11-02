import {
  EVP_FREQ_STEP_MHZ,
  POLAROID_MAX_SHOTS,
  SANITY_DELTAS,
  SHUTTER_COOLDOWN,
  SUSPICION_DELTAS,
} from '../constants';
import { playerController } from '../input/keyLook';
import { settingsStore } from '../settings';
import type {
  ActiveAnomalyInstance,
  AnomalyId,
  EngineSnapshot,
  EvpSignalId,
  RideAnomalyRecord,
  SegmentRule,
  SubtitleItem,
} from '../types';
import {
  buildActiveAnomalyInstance,
  selectAnomalyIdForStretch,
} from './anomalyManager';
import {
  clampEvpFrequency,
  evaluateEvpTuning,
} from './evpManager';
import {
  buildPolaroidPhotoRecord,
  captureSquarePolaroidDataUrl,
  isAnomalyFramedInViewfinder,
} from './polaroidManager';

export interface InteractionsEngineAdapter {
  getSnapshot(): EngineSnapshot;
  getCurrentSegmentRule(): SegmentRule;
  update(patch: Partial<EngineSnapshot>): EngineSnapshot;
  showSubtitle(item: Omit<SubtitleItem, 'id'>, durationSec?: number): void;
  triggerParanoidFlash(customWord?: string): void;
  forceParentLook(): 'Mom' | 'Dad';
  emitTier3Tear(): void;
}

export function spawnStretchAnomalyHelper(params: {
  adapter: InteractionsEngineAdapter;
  usedAnomalyIds: Set<AnomalyId>;
  overrideId?: AnomalyId;
  forceManifest?: boolean;
}): ActiveAnomalyInstance | null {
  const { adapter, usedAnomalyIds, overrideId, forceManifest = false } = params;
  const snapshot = adapter.getSnapshot();
  const seg = adapter.getCurrentSegmentRule();
  const chosenId =
    overrideId ??
    selectAnomalyIdForStretch({
      segmentRule: seg,
      sanityTier: snapshot.sanityTier,
      alreadyUsedIds: Array.from(usedAnomalyIds),
    });

  if (!chosenId) {
    adapter.update({ activeAnomaly: null });
    return null;
  }

  usedAnomalyIds.add(chosenId);
  const instance = buildActiveAnomalyInstance(chosenId);

  if (forceManifest) {
    adapter.update({ activeAnomaly: instance });
    return manifestActiveAnomalyHelper(adapter);
  }

  adapter.update({ activeAnomaly: instance });
  return instance;
}

export function manifestActiveAnomalyHelper(
  adapter: InteractionsEngineAdapter
): ActiveAnomalyInstance | null {
  const snapshot = adapter.getSnapshot();
  const current = snapshot.activeAnomaly;
  if (!current || current.manifested) return current;

  const seg = adapter.getCurrentSegmentRule();
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

  const nextRideAnomalies = [...snapshot.rideAnomalies, nextRecord];

  if (!snapshot.isPracticeRun && !snapshot.isDebugRun) {
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

  adapter.update({
    activeAnomaly: manifested,
    anomaliesSpawnedCount: snapshot.anomaliesSpawnedCount + 1,
    rideAnomalies: nextRideAnomalies,
  });

  if (manifested.id === 'dad_answering' && manifested.dadLine) {
    adapter.showSubtitle(
      {
        speaker: 'Dad',
        text: manifested.dadLine,
      },
      3.8
    );
  }

  if (manifested.tierIndex === 3) {
    adapter.emitTier3Tear();
    adapter.triggerParanoidFlash('LOOK AWAY');
  }

  return manifested;
}

export function catchActiveAnomalyHelper(
  adapter: InteractionsEngineAdapter,
  caughtByPhoto = false
): boolean {
  const snapshot = adapter.getSnapshot();
  const current = snapshot.activeAnomaly;
  if (!current || !current.manifested || current.caught) return false;

  const caughtInstance: ActiveAnomalyInstance = {
    ...current,
    caught: true,
  };

  const updatedRideAnomalies = snapshot.rideAnomalies.map((rec, idx, arr) =>
    idx === arr.length - 1 && rec.id === current.id
      ? { ...rec, caught: true, caughtByPhoto }
      : rec
  );

  if (!snapshot.isPracticeRun && !snapshot.isDebugRun) {
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

  adapter.update({
    activeAnomaly: caughtInstance,
    anomaliesCaughtCount: snapshot.anomaliesCaughtCount + 1,
    rideAnomalies: updatedRideAnomalies,
    flagHoldProgress: 0,
    isFlagHolding: false,
    sanity: snapshot.sanity + SANITY_DELTAS.CATCH,
  });

  return true;
}

export function snapPolaroidPhotoHelper(params: {
  adapter: InteractionsEngineAdapter;
  shutterCooldownSec: number;
  sourceCanvas?: HTMLCanvasElement | null;
}): {
  snapped: boolean;
  framedAnomaly: boolean;
  nextShutterCooldownSec: number;
} {
  const { adapter, shutterCooldownSec, sourceCanvas } = params;
  const snapshot = adapter.getSnapshot();

  if (shutterCooldownSec > 0) {
    return { snapped: false, framedAnomaly: false, nextShutterCooldownSec: shutterCooldownSec };
  }
  if (
    snapshot.polaroidShotsRemaining <= 0 ||
    snapshot.photos.length >= POLAROID_MAX_SHOTS
  ) {
    adapter.showSubtitle({ text: 'Out of film.' }, 2.2);
    return { snapped: false, framedAnomaly: false, nextShutterCooldownSec: shutterCooldownSec };
  }

  const seg = adapter.getCurrentSegmentRule();
  const camY = playerController.getState().y || 1.24;
  const framedAnomaly = isAnomalyFramedInViewfinder({
    activeAnomaly: snapshot.activeAnomaly,
    playerX: snapshot.playerX,
    playerEyeY: camY,
    playerZ: snapshot.playerZ,
    playerYaw: snapshot.playerYaw,
    playerPitch: snapshot.playerPitch,
  })
    ? snapshot.activeAnomaly
    : null;

  const dataUrl = captureSquarePolaroidDataUrl({
    sourceCanvas,
    stopNumber: seg.stopNumber,
    stationName: snapshot.nextStationName,
    anomalyTitle: framedAnomaly ? framedAnomaly.title : null,
  });

  const newPhoto = buildPolaroidPhotoRecord({
    photoIndex: snapshot.photos.length + 1,
    stopNumber: seg.stopNumber,
    stationName: snapshot.nextStationName,
    carLocation: snapshot.carLocation,
    routeId: snapshot.activeRoute,
    capturedAnomaly: framedAnomaly,
    dataUrl,
    capturedAtSec: snapshot.segmentElapsedSec,
    developed: false,
  });

  const watcher = snapshot.watchingParentLabel;
  let nextWatcher = watcher;
  if (!watcher && Math.random() < 0.5) {
    nextWatcher = adapter.forceParentLook();
  }
  const nextSuspicion = watcher
    ? snapshot.suspicion + SUSPICION_DELTAS.CAMERA_FLASH_WATCHED
    : snapshot.suspicion;
  const nextReason = watcher
    ? `Took a flash photo while ${watcher} was watching`
    : snapshot.lastReactionReason;

  adapter.update({
    polaroidShotsRemaining: snapshot.polaroidShotsRemaining - 1,
    polaroidFlashIntensity: 1.0,
    photos: [...snapshot.photos, newPhoto],
    watchingParentLabel: nextWatcher,
    suspicion: nextSuspicion,
    lastReactionReason: nextReason,
  });

  return {
    snapped: true,
    framedAnomaly: Boolean(framedAnomaly),
    nextShutterCooldownSec: SHUTTER_COOLDOWN,
  };
}

export function toggleEvpRecorderHelper(params: {
  adapter: InteractionsEngineAdapter;
  force?: boolean;
  evpListenElapsedSec: number;
  evpLastLockedId: EvpSignalId | null;
}): {
  evpListenElapsedSec: number;
  evpLastLockedId: EvpSignalId | null;
} {
  const { adapter, force } = params;
  let { evpListenElapsedSec, evpLastLockedId } = params;
  const snapshot = adapter.getSnapshot();

  if (snapshot.phase === 'menu' || snapshot.phase === 'end') {
    return { evpListenElapsedSec, evpLastLockedId };
  }
  if (!snapshot.hasRecorder) {
    adapter.showSubtitle({ text: 'You don’t have anything to record with.' }, 2.4);
    return { evpListenElapsedSec, evpLastLockedId };
  }
  if (snapshot.activeMaskCheck) {
    adapter.showSubtitle({ text: 'Answer first.' }, 2.0);
    return { evpListenElapsedSec, evpLastLockedId };
  }
  if (snapshot.activeRestraint) {
    adapter.showSubtitle({ text: 'Not now. Keep holding.' }, 2.0);
    return { evpListenElapsedSec, evpLastLockedId };
  }

  const nextOpen = typeof force === 'boolean' ? force : !snapshot.evpOpen;
  const raising = nextOpen && !snapshot.evpOpen;
  if (raising || !nextOpen) {
    evpListenElapsedSec = 0;
    evpLastLockedId = null;
  }

  const seg = adapter.getCurrentSegmentRule();
  const evalRes = evaluateEvpTuning({
    frequencyMhz: snapshot.evpFrequencyMhz,
    trainSpeedMps: snapshot.trainSpeedMps,
    route: snapshot.activeRoute,
    isAboveGround: snapshot.isOnTrestle || snapshot.isOpenAirStation,
    stopNumber: seg.stopNumber,
    listenElapsedSec: evpListenElapsedSec,
  });
  evpLastLockedId = evalRes.lockedSpec ? evalRes.lockedSpec.id : null;

  const watcher = snapshot.watchingParentLabel;
  const raisedWhileWatched = Boolean(raising && watcher);

  adapter.update({
    evpOpen: nextOpen,
    cameraOpen: nextOpen ? false : snapshot.cameraOpen,
    albumOpen: nextOpen ? false : snapshot.albumOpen,
    evpIsRecording: nextOpen ? snapshot.evpIsRecording : false,
    evpRecordProgress: nextOpen ? snapshot.evpRecordProgress : 0,
    evpSignalStrength: evalRes.signalStrength,
    evpLockedSignalId: evalRes.lockedSpec ? evalRes.lockedSpec.id : null,
    evpLockedTitle: evalRes.lockedTitle,
    evpTranscriptLive: evalRes.liveTranscript,
    suspicion: raisedWhileWatched
      ? snapshot.suspicion + SUSPICION_DELTAS.RECORDER_RAISED_WATCHED
      : snapshot.suspicion,
    lastReactionReason: raisedWhileWatched
      ? `Held up a tape recorder while ${watcher} was watching`
      : snapshot.lastReactionReason,
  });

  return { evpListenElapsedSec, evpLastLockedId };
}

export function setEvpFrequencyHelper(params: {
  adapter: InteractionsEngineAdapter;
  freqMhz: number;
  evpListenElapsedSec: number;
  evpLastLockedId: EvpSignalId | null;
}): {
  evpListenElapsedSec: number;
  evpLastLockedId: EvpSignalId | null;
} {
  const { adapter, freqMhz } = params;
  let { evpListenElapsedSec, evpLastLockedId } = params;
  const snapshot = adapter.getSnapshot();
  const clamped = clampEvpFrequency(freqMhz);
  const seg = adapter.getCurrentSegmentRule();

  const prelimRes = evaluateEvpTuning({
    frequencyMhz: clamped,
    trainSpeedMps: snapshot.trainSpeedMps,
    route: snapshot.activeRoute,
    isAboveGround: snapshot.isOnTrestle || snapshot.isOpenAirStation,
    stopNumber: seg.stopNumber,
    listenElapsedSec: 0,
  });
  const nextLockedId = prelimRes.lockedSpec ? prelimRes.lockedSpec.id : null;
  if (nextLockedId !== evpLastLockedId) {
    evpListenElapsedSec = 0;
    evpLastLockedId = nextLockedId;
  }

  const evalRes = evaluateEvpTuning({
    frequencyMhz: clamped,
    trainSpeedMps: snapshot.trainSpeedMps,
    route: snapshot.activeRoute,
    isAboveGround: snapshot.isOnTrestle || snapshot.isOpenAirStation,
    stopNumber: seg.stopNumber,
    listenElapsedSec: evpListenElapsedSec,
  });

  adapter.update({
    evpFrequencyMhz: clamped,
    evpSignalStrength: evalRes.signalStrength,
    evpLockedSignalId: evalRes.lockedSpec ? evalRes.lockedSpec.id : null,
    evpLockedTitle: evalRes.lockedTitle,
    evpTranscriptLive: evalRes.liveTranscript,
    evpRecordProgress: 0,
  });

  return { evpListenElapsedSec, evpLastLockedId };
}

export function stepEvpFrequencyHelper(params: {
  adapter: InteractionsEngineAdapter;
  deltaSteps: number;
  evpListenElapsedSec: number;
  evpLastLockedId: EvpSignalId | null;
}) {
  const { adapter, deltaSteps, evpListenElapsedSec, evpLastLockedId } = params;
  const nextFreq = clampEvpFrequency(
    adapter.getSnapshot().evpFrequencyMhz + deltaSteps * EVP_FREQ_STEP_MHZ
  );
  return setEvpFrequencyHelper({
    adapter,
    freqMhz: nextFreq,
    evpListenElapsedSec,
    evpLastLockedId,
  });
}

export function toggleTapePlaybackHelper(
  adapter: InteractionsEngineAdapter,
  tapeId: EvpSignalId
): void {
  const snapshot = adapter.getSnapshot();
  const isAlreadyPlaying = snapshot.playingTapeId === tapeId;
  const nextPlaying = isAlreadyPlaying ? null : tapeId;

  const watcher = snapshot.watchingParentLabel;
  const playedWhileWatched = Boolean(nextPlaying && watcher);
  let nextWatcher = watcher;
  if (nextPlaying && !watcher && Math.random() < 0.5) {
    nextWatcher = adapter.forceParentLook();
  }

  adapter.update({
    playingTapeId: nextPlaying,
    watchingParentLabel: nextWatcher,
    suspicion: playedWhileWatched
      ? snapshot.suspicion + SUSPICION_DELTAS.TAPE_PLAYED_WATCHED
      : snapshot.suspicion,
    lastReactionReason: playedWhileWatched
      ? `Played a tape out loud while ${watcher} was watching`
      : snapshot.lastReactionReason,
  });
}
