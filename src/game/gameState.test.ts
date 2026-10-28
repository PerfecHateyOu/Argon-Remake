import assert from 'node:assert/strict';
import test from 'node:test';
import { SEGMENT_TABLE } from '../constants';
import { wrapTunnelRingX } from '../graphics/tunnelBuilder';
import {
  clampSanityForStop,
  computeArrivalFlickerIntensity,
  computeInitialPixelRatio,
  computeSanityTier,
  computeStopDoorState,
  gameEngine,
  stepGovernorPixelRatio,
} from './gameState';

test('computeSanityTier maps sanity values to canonical High/Medium/Low/Critical tiers', () => {
  assert.equal(computeSanityTier(100), 'High');
  assert.equal(computeSanityTier(75), 'High');
  assert.equal(computeSanityTier(74), 'Medium');
  assert.equal(computeSanityTier(40), 'Medium');
  assert.equal(computeSanityTier(39), 'Low');
  assert.equal(computeSanityTier(10), 'Low');
  assert.equal(computeSanityTier(9), 'Critical');
  assert.equal(computeSanityTier(0), 'Critical');
});

test('clampSanityForStop enforces stop bands and restraint ceiling bonus', () => {
  // Stops 1-3: 80-100
  assert.equal(clampSanityForStop(50, 1), 80);
  assert.equal(clampSanityForStop(100, 2), 100);
  // Stop 4: 70-95
  assert.equal(clampSanityForStop(99, 4), 95);
  // Stops 11-13: 0-9 (+6 with restraint held = 15)
  assert.equal(clampSanityForStop(20, 11, 0), 9);
  assert.equal(clampSanityForStop(20, 12, 6), 15);
});

test('performance governor caps initial pixel ratio and steps down by 0.25 above 25ms', () => {
  assert.equal(computeInitialPixelRatio(3.0, false), 2.0);
  assert.equal(computeInitialPixelRatio(3.0, true), 1.75);

  assert.equal(stepGovernorPixelRatio(2.0, 16.6), 2.0);
  assert.equal(stepGovernorPixelRatio(2.0, 28.0), 1.75);
  assert.equal(stepGovernorPixelRatio(1.25, 31.0), 1.0);
  assert.equal(stepGovernorPixelRatio(1.0, 40.0), 1.0);
});

test('computeStopDoorState distinguishes real door chime timing from doors_open_early tell', () => {
  // At 0.6s into the 1.4s chime:
  const normalMidChime = computeStopDoorState(0.6, 'none');
  assert.equal(normalMidChime.chimePlaying, true);
  assert.equal(normalMidChime.doorOpenProgress, 0);

  const earlyMidChime = computeStopDoorState(0.6, 'doors_open_early');
  assert.equal(earlyMidChime.chimePlaying, true);
  assert.ok(earlyMidChime.doorOpenProgress > 0.4, 'Early tell opens doors while chime is still playing');

  // After chime finishes at 2.3s:
  const normalAfterChime = computeStopDoorState(2.3, 'none');
  assert.equal(normalAfterChime.chimePlaying, false);
  assert.equal(normalAfterChime.doorOpenProgress, 1);
  assert.equal(normalAfterChime.subPhase, 'doors_open');
});

test('computeArrivalFlickerIntensity triggers hard double-dip only on lights_flicker tell', () => {
  assert.equal(computeArrivalFlickerIntensity(0.7, 'none'), 1.0);
  assert.equal(computeArrivalFlickerIntensity(0.7, 'doors_open_early'), 1.0);
  assert.equal(computeArrivalFlickerIntensity(0.7, 'lights_flicker'), 0.05);
  assert.equal(computeArrivalFlickerIntensity(0.3, 'lights_flicker'), 0.08);
  assert.equal(computeArrivalFlickerIntensity(2.5, 'lights_flicker'), 1.0);
});

test('wrapTunnelRingX recycles pooled tunnel rings in [-60, +60)', () => {
  assert.equal(wrapTunnelRingX(0, 60), 0);
  assert.equal(wrapTunnelRingX(62, 60), -58);
  assert.equal(wrapTunnelRingX(-65, 60), 55);
});

test('gameEngine progresses across all 13 stops (including 6b and 21 St open-air) to Court Sq', () => {
  gameEngine.returnToMenu();
  assert.equal(gameEngine.getSnapshot().phase, 'menu');

  gameEngine.startRide({ chapter: 1, nightmare: false });
  assert.equal(gameEngine.getSnapshot().phase, 'ride');
  assert.equal(gameEngine.getSnapshot().currentStationName, 'Hoyt–Schermerhorn');
  assert.equal(gameEngine.getSnapshot().nextStationName, 'Fulton St');
  assert.equal(gameEngine.getSnapshot().rollsign?.title, 'CHAPTER I — THE DESCENT');

  // Walk through every stretch in SEGMENT_TABLE
  for (let i = 0; i < SEGMENT_TABLE.length; i++) {
    const seg = SEGMENT_TABLE[i]!;
    assert.equal(gameEngine.getSnapshot().segmentId, seg.id);

    gameEngine.arriveAtCurrentStop();
    assert.equal(gameEngine.getSnapshot().phase, 'stop');

    if (seg.id === '12') {
      assert.equal(gameEngine.getSnapshot().currentStationName, '21 St');
      assert.equal(gameEngine.getSnapshot().isOpenAirStation, true);
    }

    if (seg.stopType === 'final') {
      assert.equal(gameEngine.getSnapshot().currentStationName, 'Court Sq');
      gameEngine.chooseCourtSqExit('escalators');
      assert.equal(gameEngine.getSnapshot().phase, 'end');
    } else {
      gameEngine.stayOnTrain();
      assert.equal(gameEngine.getSnapshot().phase, 'ride');
    }
  }

  gameEngine.returnToMenu();
  assert.equal(gameEngine.getSnapshot().phase, 'menu');
});

test('gameEngine handles mask checks, unasked 1/2/3 replies, and suspicion intervention at 60', () => {
  gameEngine.startRide({ chapter: 1, nightmare: false });

  // Pressing 1/2/3 when no mask check is active triggers Dad's unasked reply
  gameEngine.answerMaskCheck(0);
  assert.equal(gameEngine.getSnapshot().subtitle?.speaker, 'Dad');
  assert.ok(gameEngine.getSnapshot().subtitle?.text.length);

  // Trigger a mask check and answer with the calm option
  gameEngine.triggerMaskCheck();
  const check1 = gameEngine.getSnapshot().activeMaskCheck;
  assert.ok(check1);
  const calmIdx = check1.options.findIndex((o) => o.isCalm) as 0 | 1 | 2;
  assert.ok(calmIdx >= 0);
  const preSanity = gameEngine.getSnapshot().sanity;
  const preSuspicion = gameEngine.getSnapshot().suspicion;
  gameEngine.answerMaskCheck(calmIdx);
  assert.equal(gameEngine.getSnapshot().activeMaskCheck, null);
  assert.equal(gameEngine.getSnapshot().sanity, preSanity);
  assert.equal(gameEngine.getSnapshot().suspicion, preSuspicion);

  // Trigger a mask check and answer with a wrong option (+15 suspicion, -5 sanity)
  gameEngine.triggerMaskCheck();
  const check2 = gameEngine.getSnapshot().activeMaskCheck;
  assert.ok(check2);
  const wrongIdx = check2.options.findIndex((o) => !o.isCalm) as 0 | 1 | 2;
  assert.ok(wrongIdx >= 0);
  gameEngine.answerMaskCheck(wrongIdx);
  assert.equal(gameEngine.getSnapshot().suspicion, preSuspicion + 15);
  assert.equal(gameEngine.getSnapshot().sanity, preSanity - 4);

  // Push suspicion to >= 60 via visible reactions (5 * +10 = +50 -> reaches 60) -> intervention resets to 40
  for (let i = 0; i < 5; i++) {
    gameEngine.recordVisibleReaction('Snapped head while Dad was watching');
  }
  assert.equal(gameEngine.getSnapshot().suspicion, 40);
  assert.equal(gameEngine.getSnapshot().interventionsCount, 1);
  assert.equal(gameEngine.getSnapshot().peakSuspicion, 60);
  assert.equal(
    gameEngine.getSnapshot().subtitle?.text,
    'Hey. Look at me. Both of us, right now. Talk to us. What is going on with you?'
  );

  gameEngine.returnToMenu();
});

