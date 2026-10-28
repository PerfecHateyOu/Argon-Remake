import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEvpTapeRecord,
  clampEvpFrequency,
  evaluateEvpTuning,
  EVP_STATION_SPECS,
  resolveEvpStationText,
} from './evpManager';
import {
  buildPolaroidPhotoRecord,
  formatCarLocationForPolaroid,
  isAnomalyFramedInViewfinder,
} from './polaroidManager';
import { buildActiveAnomalyInstance } from './anomalyManager';

test('clampEvpFrequency clamps to [88.1, 107.9] MHz and rounds to 0.05 MHz (5 kHz) steps', () => {
  assert.equal(clampEvpFrequency(80.0), 88.1);
  assert.equal(clampEvpFrequency(110.0), 107.9);
  assert.equal(clampEvpFrequency(98.212), 98.2);
  assert.equal(clampEvpFrequency(98.238), 98.25);
});

test('evaluateEvpTuning locks onto all 11 canonical EVP signals + 3 carrier tones while moving and returns 0 at standstill', () => {
  assert.equal(EVP_STATION_SPECS.length, 14);
  const voiceSpecs = EVP_STATION_SPECS.filter((s) => !s.isCarrierOnly);
  const carrierSpecs = EVP_STATION_SPECS.filter((s) => s.isCarrierOnly);
  assert.equal(voiceSpecs.length, 11);
  assert.equal(carrierSpecs.length, 3);

  // At standstill (trainSpeedMps <= 0.5), nothing comes through
  const standstill = evaluateEvpTuning({
    frequencyMhz: 98.2,
    trainSpeedMps: 0,
    route: 'G',
    isAboveGround: false,
  });
  assert.equal(standstill.signalStrength, 0);
  assert.equal(standstill.lockedSpec, null);

  // Moving at 98.20 MHz locks onto The conductor (under the river variant underground)
  const underRiver = evaluateEvpTuning({
    frequencyMhz: 98.2,
    trainSpeedMps: 15.5,
    route: 'G',
    isAboveGround: false,
  });
  assert.equal(underRiver.lockedSpec?.id, 'conductor_echo');
  assert.equal(underRiver.lockedTitle, 'The conductor');
  assert.equal(
    underRiver.liveTranscript,
    '…this is your conductor. We are under the river. This train does not go under the river…'
  );

  // Above ground on G trestle switches conductor line to above-ground variant
  const aboveGround = evaluateEvpTuning({
    frequencyMhz: 98.2,
    trainSpeedMps: 15.5,
    route: 'G',
    isAboveGround: true,
  });
  assert.equal(
    aboveGround.liveTranscript,
    '…this is your conductor. We are above ground. This train does not go above ground…'
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
    spec: underRiver.lockedSpec!,
    route: 'G',
    isAboveGround: false,
    stopNumber: 7,
  });
  assert.equal(tape.id, 'conductor_echo');
  assert.equal(tape.title, 'The conductor');
  assert.equal(tape.stopNumber, 7);
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
