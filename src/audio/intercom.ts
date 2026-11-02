import type { SanityTier } from '../types';
import { DECAY_STAGE_BY_TIER } from './rideMusic';

/**
 * Conductor two-tone chime and bandpass PA filter synthesizer.
 */
export function computeIntercomFormantProfile(
  sanityTier: SanityTier,
  syllableIndex: number
): {
  fundamentalHz: number;
  formant1Hz: number;
  formant2Hz: number;
  durationSec: number;
  warbleDepthHz: number;
  warbleRateHz: number;
} {
  const stage = DECAY_STAGE_BY_TIER[sanityTier];
  const basePattern = [142, 156, 138, 162, 134, 128];
  const f1Pattern = [520, 640, 480, 690, 540, 460];
  const f2Pattern = [1380, 1620, 1240, 1710, 1420, 1190];

  const idx = Math.abs(syllableIndex) % basePattern.length;
  const fundamentalHz = Number((basePattern[idx]! * stage.pitchMultiplier).toFixed(2));
  const formant1Hz = Number((f1Pattern[idx]! * stage.pitchMultiplier).toFixed(2));
  const formant2Hz = Number((f2Pattern[idx]! * stage.pitchMultiplier).toFixed(2));
  const durationSec = Number((0.14 / stage.tempoMultiplier).toFixed(3));

  return {
    fundamentalHz,
    formant1Hz,
    formant2Hz,
    durationSec,
    warbleDepthHz: stage.warbleDepthHz,
    warbleRateHz: stage.warbleRateHz,
  };
}

export function playConductorDoorChime(
  ctx: AudioContext,
  sfxMaster: GainNode,
  earlyTell = false
): void {
  const now = ctx.currentTime;
  const notes: readonly [number, number] = earlyTell ? [402, 318] : [415.3, 329.63]; // G#4 -> E4

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.52;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.24, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.56);

    osc.connect(gain);
    gain.connect(sfxMaster);
    osc.start(start);
    osc.stop(start + 0.58);
  });
}

export function playBandpassIntercomBurst(
  ctx: AudioContext,
  sfxMaster: GainNode,
  sanityTier: SanityTier
): void {
  const now = ctx.currentTime;
  let offset = 0;
  const count = 5;

  for (let i = 0; i < count; i++) {
    const prof = computeIntercomFormantProfile(sanityTier, i);
    const start = now + offset;
    const end = start + prof.durationSec;
    offset += prof.durationSec + 0.04;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(prof.fundamentalHz, start);

    if (prof.warbleDepthHz > 0.5) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(prof.warbleRateHz, start);
      lfoGain.gain.setValueAtTime(prof.warbleDepthHz, start);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(end);
    }

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(prof.formant1Hz, start);
    bandpass.Q.setValueAtTime(3.2, start);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, start);
    env.gain.linearRampToValueAtTime(0.08, start + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, end);

    osc.connect(bandpass);
    bandpass.connect(env);
    env.connect(sfxMaster);
    osc.start(start);
    osc.stop(end + 0.01);
  }
}
