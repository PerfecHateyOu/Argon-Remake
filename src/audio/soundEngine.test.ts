import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeEffectiveAudioGains,
  computeIntercomFormantProfile,
  DECAY_STAGE_BY_TIER,
} from './soundEngine';

test('DECAY_STAGE_BY_TIER slows tempo and increases warble across High/Medium/Low/Critical', () => {
  assert.ok(
    DECAY_STAGE_BY_TIER.High.tempoMultiplier > DECAY_STAGE_BY_TIER.Medium.tempoMultiplier
  );
  assert.ok(
    DECAY_STAGE_BY_TIER.Medium.tempoMultiplier > DECAY_STAGE_BY_TIER.Low.tempoMultiplier
  );
  assert.ok(
    DECAY_STAGE_BY_TIER.Low.tempoMultiplier > DECAY_STAGE_BY_TIER.Critical.tempoMultiplier
  );

  assert.ok(
    DECAY_STAGE_BY_TIER.Critical.warbleDepthHz > DECAY_STAGE_BY_TIER.Low.warbleDepthHz
  );
  assert.ok(DECAY_STAGE_BY_TIER.Low.warbleDepthHz > DECAY_STAGE_BY_TIER.Medium.warbleDepthHz);
  assert.ok(DECAY_STAGE_BY_TIER.Medium.warbleDepthHz > DECAY_STAGE_BY_TIER.High.warbleDepthHz);
});

test('computeEffectiveAudioGains enforces mute, PA ducking, and clean pause music crossfade', () => {
  const mutedGains = computeEffectiveAudioGains({
    muted: true,
    gameVolume: 0.85,
    musicVolume: 0.75,
    paused: false,
    paDuckingActive: false,
  });
  assert.deepEqual(mutedGains, {
    masterSfxGain: 0,
    rideMusicGain: 0,
    pauseMusicGain: 0,
  });

  const activeGains = computeEffectiveAudioGains({
    muted: false,
    gameVolume: 0.8,
    musicVolume: 0.8,
    paused: false,
    paDuckingActive: false,
  });
  assert.equal(activeGains.masterSfxGain, 0.8);
  assert.ok(activeGains.rideMusicGain > 0.3);
  assert.equal(activeGains.pauseMusicGain, 0);

  const duckedGains = computeEffectiveAudioGains({
    muted: false,
    gameVolume: 0.8,
    musicVolume: 0.8,
    paused: false,
    paDuckingActive: true,
  });
  assert.ok(duckedGains.rideMusicGain < activeGains.rideMusicGain);

  const pausedGains = computeEffectiveAudioGains({
    muted: false,
    gameVolume: 0.8,
    musicVolume: 0.8,
    paused: true,
    paDuckingActive: false,
  });
  assert.equal(pausedGains.rideMusicGain, 0);
  assert.ok(pausedGains.pauseMusicGain > 0.3);
});

test('computeIntercomFormantProfile slows down and lowers wordless formants as sanity drops', () => {
  const highProf = computeIntercomFormantProfile('High', 0);
  const critProf = computeIntercomFormantProfile('Critical', 0);

  assert.ok(critProf.fundamentalHz < highProf.fundamentalHz);
  assert.ok(critProf.formant1Hz < highProf.formant1Hz);
  assert.ok(critProf.durationSec > highProf.durationSec);
  assert.ok(critProf.warbleDepthHz > highProf.warbleDepthHz);
});

