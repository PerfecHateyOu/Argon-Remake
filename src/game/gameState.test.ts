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

test('gameEngine handles anomaly manifestation, 0.7s Flag catch, false flags, and stop-arrival misses', () => {
  gameEngine.startRide({ chapter: 1, nightmare: false });

  // Spawn and immediately manifest window_residue
  gameEngine.spawnStretchAnomaly('window_residue', true);
  const snap1 = gameEngine.getSnapshot();
  assert.equal(snap1.activeAnomaly?.id, 'window_residue');
  assert.equal(snap1.activeAnomaly?.manifested, true);
  assert.equal(snap1.activeAnomaly?.caught, false);

  // Catch the active anomaly via Flag (caughtByPhoto = false)
  const caught = gameEngine.catchActiveAnomaly(false);
  assert.equal(caught, true);
  const snap2 = gameEngine.getSnapshot();
  assert.equal(snap2.activeAnomaly?.caught, true);
  assert.equal(snap2.anomaliesCaughtCount, 1);
  assert.equal(snap2.rideAnomalies.length, 1);
  assert.equal(snap2.rideAnomalies[0]?.id, 'window_residue');
  assert.equal(snap2.rideAnomalies[0]?.caught, true);
  assert.equal(snap2.rideAnomalies[0]?.caughtByPhoto, false);

  // Holding Flag for 0.7s when anomaly is already caught triggers a false flag (-3 sanity)
  const sanityBeforeFalseFlag = gameEngine.getSnapshot().sanity;
  gameEngine.setFlagHolding(true);
  gameEngine.stepRide(0.75);
  const snap3 = gameEngine.getSnapshot();
  assert.equal(snap3.falseFlagsCount, 1);
  assert.equal(snap3.sanity, sanityBeforeFalseFlag - 3);

  // Spawn a second anomaly and arrive at stop without catching -> recorded as missed (caught: false)
  gameEngine.spawnStretchAnomaly('cold_panel', true);
  gameEngine.arriveAtCurrentStop();
  const snap4 = gameEngine.getSnapshot();
  assert.equal(snap4.rideAnomalies.length, 2);
  assert.equal(snap4.rideAnomalies[1]?.id, 'cold_panel');
  assert.equal(snap4.rideAnomalies[1]?.caught, false);

  gameEngine.returnToMenu();
});

test('gameEngine handles Stop 4 forgiving false stop, Stop 6 Safe Haven + recorder handoff, and Stop 6b/9 False Stop Trial room', () => {
  gameEngine.startRide({ chapter: 1, nightmare: false });

  // Jump to Stop 4 (tableIndex = 2, forgivingFalseStop: true)
  gameEngine.enterSegment(2);
  gameEngine.arriveAtCurrentStop();
  assert.equal(gameEngine.getSnapshot().segmentId, '4');
  assert.equal(gameEngine.getSnapshot().activeDoorTell, 'doors_open_early');

  // Stepping off at Stop 4 does NOT trigger Trial; Mom grabs your sleeve
  gameEngine.stepOffTrain();
  assert.equal(gameEngine.getSnapshot().phase, 'ride');
  assert.equal(gameEngine.getSnapshot().segmentId, '5');
  assert.equal(gameEngine.getSnapshot().falseStopTrials.length, 0);
  assert.equal(
    gameEngine.getSnapshot().subtitle?.text,
    'Not this one, hon. The doors opened funny.'
  );

  // Jump to Stop 6 (tableIndex = 4, stopType = 'haven')
  gameEngine.enterSegment(4);
  gameEngine.update({ sanity: 60 });
  gameEngine.arriveAtCurrentStop();
  assert.equal(gameEngine.getSnapshot().segmentId, '6');

  // Step off at Stop 6 Safe Haven -> phase 'haven', +15 sanity, hasRecorder = true
  gameEngine.stepOffTrain();
  assert.equal(gameEngine.getSnapshot().phase, 'haven');
  assert.equal(gameEngine.getSnapshot().hasRecorder, true);
  assert.equal(gameEngine.getSnapshot().safeHavenVisited, true);
  assert.equal(gameEngine.getSnapshot().sanity, 75);

  // Complete Safe Haven -> enters Stop 6b (tableIndex = 5, silent flicker false stop)
  gameEngine.completeSafeHaven();
  assert.equal(gameEngine.getSnapshot().phase, 'ride');
  assert.equal(gameEngine.getSnapshot().segmentId, '6b');
  assert.equal(gameEngine.getSnapshot().activeDoorTell, 'lights_flicker');

  // Arrive at Stop 6b and step off -> enters False Stop Trial room (stage 1, depth 1)
  gameEngine.arriveAtCurrentStop();
  assert.equal(
    gameEngine.getSnapshot().subtitle?.text,
    'I think this is our… let’s… stretch our legs.'
  );
  gameEngine.stepOffTrain();
  assert.equal(gameEngine.getSnapshot().phase, 'trial');
  assert.equal(gameEngine.getSnapshot().trialState?.stage, 1);
  assert.equal(gameEngine.getSnapshot().trialState?.depth, 1);

  // Stage 1: 'terminus_sign' is a lie -> loops (depth = 2)
  gameEngine.chooseTrialOption('terminus_sign');
  assert.equal(gameEngine.getSnapshot().trialState?.stage, 1);
  assert.equal(gameEngine.getSnapshot().trialState?.depth, 2);

  // Stage 1: 'opposite_sign' advances to Stage 2
  gameEngine.chooseTrialOption('opposite_sign');
  assert.equal(gameEngine.getSnapshot().trialState?.stage, 2);

  // Stage 2: 'middle_stairs' (steady light) advances to Stage 3
  gameEngine.chooseTrialOption('middle_stairs');
  assert.equal(gameEngine.getSnapshot().trialState?.stage, 3);

  // Stage 3: 'right_train' (steady light) escapes Trial room back to ride (Stop 7)
  gameEngine.chooseTrialOption('right_train');
  assert.equal(gameEngine.getSnapshot().phase, 'ride');
  assert.equal(gameEngine.getSnapshot().segmentId, '7');
  assert.equal(gameEngine.getSnapshot().falseStopTrials.length, 1);
  assert.equal(gameEngine.getSnapshot().falseStopTrials[0]?.stop, 6);
  assert.equal(gameEngine.getSnapshot().falseStopTrials[0]?.depth, 2);

  gameEngine.returnToMenu();
});

test('gameEngine handles Stop 11 Restraint (hold steady vs fail), Newtown Creek trestle, and Stop 12 bait', () => {
  gameEngine.startRide({ chapter: 1, nightmare: false });

  // Enter Segment 11 (tableIndex = 10, Stop 11 Greenpoint Av)
  gameEngine.enterSegment(10);
  assert.equal(gameEngine.getSnapshot().segmentId, '11');

  // Trigger Restraint and hold Space for 4.0s -> restraintHeld = true, ceiling bonus = +6 (ceiling 15)
  gameEngine.triggerRestraintMoment();
  assert.equal(gameEngine.getSnapshot().activeRestraint?.active, true);
  gameEngine.setRestraintHolding(true);
  gameEngine.stepRide(4.1);
  assert.equal(gameEngine.getSnapshot().activeRestraint, null);
  assert.equal(gameEngine.getSnapshot().restraintHeld, true);
  assert.equal(gameEngine.getSnapshot().restraintCeilingBonus, 6);
  assert.ok(gameEngine.getSnapshot().sanity <= 15 && gameEngine.getSnapshot().sanity > 9);

  // Arrive at Stop 11 and stay on -> enters Segment 12 (Newtown Creek trestle on G train)
  gameEngine.arriveAtCurrentStop();
  gameEngine.stayOnTrain();
  assert.equal(gameEngine.getSnapshot().segmentId, '12');
  assert.equal(gameEngine.getSnapshot().isOnTrestle, true);
  assert.equal(gameEngine.getSnapshot().trestleWitnessed, true);

  // Arrive at Stop 12 (21 St bait) and step off -> ends ride with The Eternal Commute
  gameEngine.arriveAtCurrentStop();
  assert.equal(gameEngine.getSnapshot().currentStationName, '21 St');
  gameEngine.stepOffTrain();
  assert.equal(gameEngine.getSnapshot().phase, 'end');
  assert.equal(gameEngine.getSnapshot().steppedOffAtBait, true);

  gameEngine.returnToMenu();
});

test('gameEngine handles Polaroid 600 anomaly capture, watched flash suspicion, EVP tuning/recording, and tape playback', () => {
  gameEngine.startRide({ chapter: 2, nightmare: false });
  assert.equal(gameEngine.getSnapshot().hasRecorder, true);
  assert.equal(gameEngine.getSnapshot().polaroidShotsRemaining, 6);

  // Spawn & manifest window_residue and snap a Polaroid while looking at it
  gameEngine.spawnStretchAnomaly('window_residue', true);
  gameEngine.syncPlayerPose(0, 0.85, 0, 0.1);
  gameEngine.toggleCamera(true);
  assert.equal(gameEngine.getSnapshot().cameraOpen, true);

  const caughtByPhoto = gameEngine.snapPolaroidPhoto(null);
  assert.equal(caughtByPhoto, true);
  assert.equal(gameEngine.getSnapshot().polaroidShotsRemaining, 5);
  assert.equal(gameEngine.getSnapshot().anomaliesCaughtCount, 1);
  assert.equal(gameEngine.getSnapshot().photos.length, 1);
  assert.equal(gameEngine.getSnapshot().photos[0]?.anomalyId, 'window_residue');
  assert.equal(gameEngine.getSnapshot().photos[0]?.developed, false);

  // Raise EVP recorder, tune to 98.20 MHz (The conductor), and hold record for 1.7s
  gameEngine.toggleEvpRecorder(true);
  assert.equal(gameEngine.getSnapshot().evpOpen, true);
  assert.equal(gameEngine.getSnapshot().cameraOpen, false);
  gameEngine.setEvpFrequency(98.2);
  assert.equal(gameEngine.getSnapshot().evpLockedSignalId, 'conductor_echo');

  gameEngine.setEvpRecording(true);
  gameEngine.stepRide(1.7);
  assert.equal(gameEngine.getSnapshot().tapes.length, 1);
  assert.equal(gameEngine.getSnapshot().tapes[0]?.id, 'conductor_echo');
  assert.equal(gameEngine.getSnapshot().hasConductorEvp, true);

  // Finish ride at Court Sq -> Polaroids develop
  gameEngine.enterSegment(12);
  gameEngine.arriveAtCurrentStop();
  gameEngine.chooseCourtSqExit('escalators');
  assert.equal(gameEngine.getSnapshot().phase, 'end');
  assert.equal(gameEngine.getSnapshot().photos[0]?.developed, true);

  gameEngine.returnToMenu();
});





