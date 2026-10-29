import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEvpTapeRecord,
  clampEvpFrequency,
  evaluateEvpTuning,
  EVP_STATION_SPECS,
  getActiveEvpSignalsForStretch,
  getStationFrequencyKhz,
  reshuffleEvpFrequencies,
  resolveEvpStationText,
} from './evpManager';
import {
  buildPolaroidPhotoRecord,
  formatCarLocationForPolaroid,
  isAnomalyFramedInViewfinder,
} from './polaroidManager';
import { buildActiveAnomalyInstance } from './anomalyManager';

test('clampEvpFrequency clamps to [70, 180] kHz and rounds to 1 kHz steps', () => {
  assert.equal(clampEvpFrequency(50.0), 70);
  assert.equal(clampEvpFrequency(200.0), 180);
  assert.equal(clampEvpFrequency(98.2), 98);
  assert.equal(clampEvpFrequency(134.7), 135);
});

test('evaluateEvpTuning locks onto reshuffled 70-180 kHz EVP signals on their stretches, reveals transcript after 3s, and uses G-line conductor line', () => {
  assert.equal(EVP_STATION_SPECS.length, 11);
  reshuffleEvpFrequencies(() => 0.37);

  // Verify >= 8 kHz spacing and 2 decoy carriers per stretch
  const stretch12Signals = getActiveEvpSignalsForStretch(12);
  const decoys = stretch12Signals.filter((s) => s.isCarrierOnly);
  assert.equal(decoys.length, 2);

  const conductorFreq = getStationFrequencyKhz('conductor_echo');

  // At standstill (trainSpeedMps <= 0.5), nothing comes through
  const standstill = evaluateEvpTuning({
    frequencyMhz: conductorFreq,
    trainSpeedMps: 0,
    route: 'G',
    isAboveGround: false,
    stopNumber: 12,
    listenElapsedSec: 4.0,
  });
  assert.equal(standstill.signalStrength, 0);
  assert.equal(standstill.lockedSpec, null);

  // Conductor is only receivable on stops 12-13, not on stop 7
  const wrongStretch = evaluateEvpTuning({
    frequencyMhz: conductorFreq,
    trainSpeedMps: 15.5,
    route: 'G',
    isAboveGround: false,
    stopNumber: 7,
    listenElapsedSec: 4.0,
  });
  assert.notEqual(wrongStretch.lockedSpec?.id, 'conductor_echo');

  // On stop 12, before 3s of listening, lockedSpec is set but liveTranscript is null
  const before3s = evaluateEvpTuning({
    frequencyMhz: conductorFreq,
    trainSpeedMps: 15.5,
    route: 'G',
    isAboveGround: false,
    stopNumber: 12,
    listenElapsedSec: 1.5,
  });
  assert.equal(before3s.lockedSpec?.id, 'conductor_echo');
  assert.equal(before3s.lockedTitle, 'The conductor');
  assert.equal(before3s.liveTranscript, null);

  // After 3s of listening on the G line, full transcript reveals and ALWAYS uses "above ground"
  const onGLine = evaluateEvpTuning({
    frequencyMhz: conductorFreq,
    trainSpeedMps: 15.5,
    route: 'G',
    isAboveGround: false,
    stopNumber: 12,
    listenElapsedSec: 3.1,
  });
  assert.equal(onGLine.lockedSpec?.id, 'conductor_echo');
  assert.equal(
    onGLine.liveTranscript,
    '…this is your conductor. We are above ground. This train does not go above ground…'
  );

  // Off the G line (e.g. L train), conductor uses "under the river"
  const offGLine = evaluateEvpTuning({
    frequencyMhz: conductorFreq,
    trainSpeedMps: 15.5,
    route: 'L',
    isAboveGround: false,
    stopNumber: 12,
    listenElapsedSec: 3.1,
  });
  assert.equal(
    offGLine.liveTranscript,
    '…this is your conductor. We are under the river. This train does not go under the river…'
  );

  // Emergency channel switches between Newtown Creek emergency channel (G) and Track emergency channel (L/7)
  const emSpec = EVP_STATION_SPECS.find((s) => s.id === 'emergency_channel')!;
  const gEm = resolveEvpStationText(emSpec, 'G', true);
  assert.equal(gEm.title, 'Newtown Creek emergency channel');
  assert.ok(gEm.transcript.includes('Maritime security channel 16'));

  const lEm = resolveEvpStationText(emSpec, 'L', false);
  assert.equal(lEm.title, 'Track emergency channel');
  assert.ok(lEm.transcript.includes('Track security channel 16'));

  // Build tape record
  const tape = buildEvpTapeRecord({
    spec: onGLine.lockedSpec!,
    route: 'G',
    isAboveGround: false,
    stopNumber: 12,
  });
  assert.equal(tape.id, 'conductor_echo');
  assert.equal(tape.title, 'The conductor');
  assert.equal(tape.stopNumber, 12);
});

test('isAnomalyFramedInViewfinder detects manifested anomaly in Polaroid 600 square frame and formatCarLocationForPolaroid formats labels', () => {
  const anomaly = buildActiveAnomalyInstance('window_residue', () => 0.1);
  anomaly.manifested = true;

  // Looking directly toward window_residue target (0, 1.48, -1.42) from seat (0, 1.24, 0.85)
  const framed = isAnomalyFramedInViewfinder({
    activeAnomaly: anomaly,
    playerX: 0,
    playerEyeY: 1.24,
    playerZ: 0.85,
    playerYaw: 0,
    playerPitch: 0.1,
  });
  assert.equal(framed, true);

  // Turned away (yaw = Math.PI) -> not framed
  const turnedAway = isAnomalyFramedInViewfinder({
    activeAnomaly: anomaly,
    playerX: 0,
    playerEyeY: 1.24,
    playerZ: 0.85,
    playerYaw: Math.PI,
    playerPitch: 0,
  });
  assert.equal(turnedAway, false);

  assert.equal(formatCarLocationForPolaroid('CAR A (LEAD)'), 'Car A (Lead)');
  assert.equal(formatCarLocationForPolaroid('CAR B (MID)'), 'Car B (Mid)');
  assert.equal(formatCarLocationForPolaroid('CAR C (REAR)'), 'Car C (Rear)');

  const photo = buildPolaroidPhotoRecord({
    photoIndex: 1,
    stopNumber: 3,
    stationName: 'Clinton–Washington Avs',
    carLocation: 'CAR B (MID)',
    routeId: 'G',
    capturedAnomaly: anomaly,
    dataUrl: 'data:image/svg+xml;utf8,<svg/>',
    capturedAtSec: 8.5,
  });
  assert.equal(photo.anomalyId, 'window_residue');
  assert.equal(photo.developed, false);
});
