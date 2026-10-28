import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildActiveMaskCheck,
  MASK_CHECKS_CALM,
  selectMaskCheckPool,
} from './carLife';
import {
  computeParentTargetHeadAngles,
  evaluateHeadWhipReaction,
  evaluateSuspicionIntervention,
} from './passengerBehavior';

test('evaluateHeadWhipReaction enforces >5.5 rad/s on mouse and >8.0 rad/s + 75 deg on touch while watched', () => {
  // Not watched -> no reaction
  const unwatched = evaluateHeadWhipReaction({
    angularSpeedRadS: 9.0,
    cumulativeTouchTurnRad: 2.0,
    isTouchDrag: false,
    watchingParentLabel: null,
    cooldownRemainingSec: 0,
  });
  assert.equal(unwatched.triggered, false);

  // Mouse below 5.5 rad/s -> no reaction
  const calmMouse = evaluateHeadWhipReaction({
    angularSpeedRadS: 4.8,
    cumulativeTouchTurnRad: 0,
    isTouchDrag: false,
    watchingParentLabel: 'Mom',
    cooldownRemainingSec: 0,
  });
  assert.equal(calmMouse.triggered, false);

  // Mouse above 5.5 rad/s while Mom watches -> triggers +10 suspicion
  const whipMouse = evaluateHeadWhipReaction({
    angularSpeedRadS: 6.2,
    cumulativeTouchTurnRad: 0,
    isTouchDrag: false,
    watchingParentLabel: 'Mom',
    cooldownRemainingSec: 0,
  });
  assert.equal(whipMouse.triggered, true);
  assert.equal(whipMouse.suspicionDelta, 10);
  assert.equal(
    whipMouse.reason,
    'Snapped your head around while Mom was watching'
  );

  // Touch drag > 8.0 rad/s but turn < 75 deg -> no reaction
  const shortTouch = evaluateHeadWhipReaction({
    angularSpeedRadS: 9.2,
    cumulativeTouchTurnRad: (45 * Math.PI) / 180,
    isTouchDrag: true,
    watchingParentLabel: 'Dad',
    cooldownRemainingSec: 0,
  });
  assert.equal(shortTouch.triggered, false);

  // Touch drag > 8.0 rad/s and turn >= 75 deg -> triggers +10 suspicion
  const whipTouch = evaluateHeadWhipReaction({
    angularSpeedRadS: 9.2,
    cumulativeTouchTurnRad: (80 * Math.PI) / 180,
    isTouchDrag: true,
    watchingParentLabel: 'Dad',
    cooldownRemainingSec: 0,
  });
  assert.equal(whipTouch.triggered, true);
  assert.equal(
    whipTouch.reason,
    'Snapped your head around while Dad was watching'
  );
});

test('evaluateSuspicionIntervention triggers at 60, resets suspicion to 40, and drops sanity by 5', () => {
  const below = evaluateSuspicionIntervention(55);
  assert.equal(below.intervened, false);
  assert.equal(below.nextSuspicion, 55);

  const atThreshold = evaluateSuspicionIntervention(60);
  assert.equal(atThreshold.intervened, true);
  assert.equal(atThreshold.nextSuspicion, 40);
  assert.equal(atThreshold.sanityDelta, -5);
  assert.equal(
    atThreshold.eventLabel,
    'Concerned Intervention (suspicion reset to 40)'
  );
});

test('selectMaskCheckPool filters requiresSuspicion when suspicion is 0 and buildActiveMaskCheck builds 3 options', () => {
  const calmNoSusp = selectMaskCheckPool('High', 0);
  assert.equal(
    calmNoSusp.some((m) => m.requiresSuspicion),
    false,
    'Should exclude Dad staring check when suspicion is 0'
  );

  const calmWithSusp = selectMaskCheckPool('High', 15);
  assert.equal(
    calmWithSusp.some((m) => m.requiresSuspicion),
    true,
    'Should include Dad staring check when suspicion > 0'
  );

  const sampleCheck = buildActiveMaskCheck(MASK_CHECKS_CALM[0]!, () => 0.42);
  assert.equal(sampleCheck.options.length, 3);
  assert.equal(
    sampleCheck.options.filter((o) => o.isCalm).length,
    1
  );
  assert.equal(
    sampleCheck.options.filter((o) => !o.isCalm).length,
    2
  );
});

test('computeParentTargetHeadAngles turns Mom right and Dad left toward player when watching', () => {
  const momWatching = computeParentTargetHeadAngles('mom', -0.68, 1.08, 0, 0.85, true);
  const dadWatching = computeParentTargetHeadAngles('dad', 0.68, 1.08, 0, 0.85, true);

  assert.ok(momWatching.yaw < -0.5, 'Mom turns head to her right (negative yaw) to face player');
  assert.ok(dadWatching.yaw > 0.5, 'Dad turns head to his left (positive yaw) to face player');
});
