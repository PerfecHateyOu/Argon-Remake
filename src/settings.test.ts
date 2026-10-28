import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, LOOK_SPEED_MAX, LOOK_SPEED_MIN } from './constants';
import { sanitizeSettings, settingsStore } from './settings';

test('sanitizeSettings preserves defaults on empty input and clamps numeric bounds', () => {
  const defaults = sanitizeSettings(null);
  assert.deepEqual(defaults, DEFAULT_SETTINGS);
  assert.equal(defaults.rawMouse, true);
  assert.equal(defaults.smoothWalking, false);

  const clamped = sanitizeSettings({
    lookSpeed: 99,
    gameVolume: -0.5,
    musicVolume: 1.5,
    rawMouse: false,
    smoothWalking: true,
    screenEffects: 'reduced',
  });
  assert.equal(clamped.lookSpeed, LOOK_SPEED_MAX);
  assert.equal(clamped.gameVolume, 0);
  assert.equal(clamped.musicVolume, 1);
  assert.equal(clamped.rawMouse, false);
  assert.equal(clamped.smoothWalking, true);
  assert.equal(clamped.screenEffects, 'reduced');

  const lowSpeed = sanitizeSettings({ lookSpeed: 0.05 });
  assert.equal(lowSpeed.lookSpeed, LOOK_SPEED_MIN);
});

test('settingsStore updates live and resolves reduced effects preference', () => {
  settingsStore.update({ screenEffects: 'full', smoothWalking: true });
  assert.equal(settingsStore.get().smoothWalking, true);
  assert.equal(settingsStore.isReducedEffectsActive(true), false);

  settingsStore.update({ screenEffects: 'reduced' });
  assert.equal(settingsStore.isReducedEffectsActive(false), true);

  settingsStore.update({ screenEffects: 'system', smoothWalking: false, rawMouse: true });
  assert.equal(settingsStore.isReducedEffectsActive(true), true);
  assert.equal(settingsStore.isReducedEffectsActive(false), false);
});
