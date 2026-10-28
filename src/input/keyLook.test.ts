import test from 'node:test';
import assert from 'node:assert/strict';
import { WALK_CAR_HALF_Z, WALK_GANGWAY_HALF_Z, WALK_SPEED_MPS } from '../constants';
import {
  clampPlayerConsistPosition,
  isNearGangwayDoor,
  resolveConsistLocation,
  stepWalkAxisVelocity,
} from './keyLook';

test('resolveConsistLocation identifies Car A (-19.5), Car B (0), Car C (+19.5), and Gangway Couplings', () => {
  assert.equal(resolveConsistLocation(-19.5), 'CAR A (LEAD)');
  assert.equal(resolveConsistLocation(-9.75), 'GANGWAY COUPLING');
  assert.equal(resolveConsistLocation(0), 'CAR B (MID)');
  assert.equal(resolveConsistLocation(9.75), 'GANGWAY COUPLING');
  assert.equal(resolveConsistLocation(19.5), 'CAR C (REAR)');

  assert.equal(isNearGangwayDoor(-9.6), true);
  assert.equal(isNearGangwayDoor(9.8), true);
  assert.equal(isNearGangwayDoor(0), false);
});

test('stepWalkAxisVelocity starts/stops instantly when smoothWalking is off and ramps gradually when on', () => {
  // Smooth walking OFF: instant top speed & instant stop
  const instantStart = stepWalkAxisVelocity(0, 1, false, 0.016);
  assert.equal(instantStart, WALK_SPEED_MPS);
  const instantStop = stepWalkAxisVelocity(WALK_SPEED_MPS, 0, false, 0.016);
  assert.equal(instantStop, 0);

  // Smooth walking ON: gradual acceleration toward top speed
  let v = 0;
  v = stepWalkAxisVelocity(v, 1, true, 0.05);
  assert.ok(v > 0 && v < WALK_SPEED_MPS, 'velocity should be intermediate after 50ms');

  for (let i = 0; i < 20; i++) {
    v = stepWalkAxisVelocity(v, 1, true, 0.05);
  }
  assert.equal(v, WALK_SPEED_MPS, 'reaches same top speed');

  // Gradual deceleration back to 0
  v = stepWalkAxisVelocity(v, 0, true, 0.05);
  assert.ok(v > 0 && v < WALK_SPEED_MPS, 'decelerates gradually');
});

test('clampPlayerConsistPosition restricts Z narrower inside gangways than inside cars', () => {
  const inCar = clampPlayerConsistPosition(0, 2.0);
  assert.equal(inCar.z, WALK_CAR_HALF_Z);

  const inGangway = clampPlayerConsistPosition(-9.75, 2.0);
  assert.equal(inGangway.z, WALK_GANGWAY_HALF_Z);
});
