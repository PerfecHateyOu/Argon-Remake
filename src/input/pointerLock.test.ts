import test from 'node:test';
import assert from 'node:assert/strict';
import { UI_STRINGS } from '../constants';
import { PointerLockManager, requestPointerLockWithFallback } from './pointerLock';

test('requestPointerLockWithFallback passes unadjustedMovement when rawMouse is true and handles non-promise return', async () => {
  const calls: Array<{ unadjustedMovement?: boolean } | undefined> = [];
  const target = {
    requestPointerLock(options?: { unadjustedMovement?: boolean }) {
      calls.push(options);
    },
  };

  const ok = await requestPointerLockWithFallback(target, true);
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { unadjustedMovement: true });
});

test('requestPointerLockWithFallback falls back cleanly to plain requestPointerLock on promise rejection or throw', async () => {
  const calls: Array<{ unadjustedMovement?: boolean } | undefined> = [];
  const rejectingTarget = {
    requestPointerLock(options?: { unadjustedMovement?: boolean }) {
      calls.push(options);
      if (options?.unadjustedMovement) {
        return Promise.reject(new Error('NotSupportedError'));
      }
      return Promise.resolve();
    },
  };

  const okReject = await requestPointerLockWithFallback(rejectingTarget, true);
  assert.equal(okReject, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { unadjustedMovement: true });
  assert.equal(calls[1], undefined);

  const throwingCalls: Array<{ unadjustedMovement?: boolean } | undefined> = [];
  const throwingTarget = {
    requestPointerLock(options?: { unadjustedMovement?: boolean }) {
      throwingCalls.push(options);
      if (options?.unadjustedMovement) {
        throw new Error('TypeError: dictionary not supported');
      }
    },
  };

  const okThrow = await requestPointerLockWithFallback(throwingTarget, true);
  assert.equal(okThrow, true);
  assert.equal(throwingCalls.length, 2);
  assert.equal(throwingCalls[1], undefined);
});

test('PointerLockManager shows error hint when lock is denied and clears it once locked', () => {
  const mgr = new PointerLockManager();
  assert.equal(mgr.getState().errorHint, null);

  mgr.triggerErrorHint();
  assert.equal(mgr.getState().errorHint, UI_STRINGS.POINTER_LOCK_HINT);

  mgr.notifyLockStateChanged(true);
  assert.equal(mgr.isLocked(), true);
  assert.equal(mgr.getState().errorHint, null);
});

test('PointerLockManager distinguishes quiet unlock from unexpected unlock (auto-pause)', () => {
  const mgr = new PointerLockManager();
  let unexpectedCount = 0;
  mgr.onUnexpectedUnlock(() => {
    unexpectedCount += 1;
  });

  // Lock and then perform a quiet unlock (e.g. opening album or route selector)
  mgr.notifyLockStateChanged(true);
  mgr.unlock({ quiet: true });
  mgr.notifyLockStateChanged(false);
  assert.equal(unexpectedCount, 0);

  // Lock again and lose lock without quiet flag (e.g. Esc mid-ride) -> triggers auto-pause
  mgr.notifyLockStateChanged(true);
  mgr.notifyLockStateChanged(false);
  assert.equal(unexpectedCount, 1);
});
