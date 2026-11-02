import type { SanityTier } from '../types';

export interface DecayStageParams {
  tempoMultiplier: number;
  pitchMultiplier: number;
  warbleDepthHz: number;
  warbleRateHz: number;
  subDroneGain: number;
}

export const DECAY_STAGE_BY_TIER: Record<SanityTier, DecayStageParams> = {
  High: {
    tempoMultiplier: 1.0,
    pitchMultiplier: 1.0,
    warbleDepthHz: 0.2,
    warbleRateHz: 0.5,
    subDroneGain: 0.0,
  },
  Medium: {
    tempoMultiplier: 0.91,
    pitchMultiplier: 0.96,
    warbleDepthHz: 2.2,
    warbleRateHz: 0.9,
    subDroneGain: 0.08,
  },
  Low: {
    tempoMultiplier: 0.8,
    pitchMultiplier: 0.89,
    warbleDepthHz: 6.5,
    warbleRateHz: 1.5,
    subDroneGain: 0.18,
  },
  Critical: {
    tempoMultiplier: 0.66,
    pitchMultiplier: 0.78,
    warbleDepthHz: 15.0,
    warbleRateHz: 2.4,
    subDroneGain: 0.32,
  },
};

export const RIDE_MOTIF_HZ = [220.0, 261.63, 329.63, 293.66, 246.94, 196.0] as const;
export const PAUSE_CHORD_HZ = [261.63, 329.63, 392.0, 493.88] as const;

/**
 * Generative FM lead, bass voice, and sanity-driven pitch warble/detune for the overhead car speaker.
 */
export function triggerDecayingSpeakerNote(
  ctx: AudioContext,
  rideMusicGain: GainNode,
  freqHz: number,
  decay: DecayStageParams
): void {
  const now = ctx.currentTime;
  const dur = 1.4;

  // Lead carrier voice with FM modulator
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freqHz, now);

  const fmMod = ctx.createOscillator();
  const fmGain = ctx.createGain();
  fmMod.type = 'sine';
  fmMod.frequency.setValueAtTime(freqHz * 2.0, now);
  fmGain.gain.setValueAtTime(freqHz * 0.18, now);
  fmMod.connect(fmGain);
  fmGain.connect(osc.frequency);
  fmMod.start(now);
  fmMod.stop(now + dur);

  // Sanity-driven pitch warble LFO
  if (decay.warbleDepthHz > 0.3) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(decay.warbleRateHz, now);
    lfoGain.gain.setValueAtTime(decay.warbleDepthHz, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + dur);
  }

  // Sub-bass voice scaled by sanity decay
  if (decay.subDroneGain > 0.01) {
    const bassOsc = ctx.createOscillator();
    const bassEnv = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(freqHz * 0.5, now);
    bassEnv.gain.setValueAtTime(0.001, now);
    bassEnv.gain.linearRampToValueAtTime(decay.subDroneGain * 0.35, now + 0.12);
    bassEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);
    bassOsc.connect(bassEnv);
    bassEnv.connect(rideMusicGain);
    bassOsc.start(now);
    bassOsc.stop(now + dur + 0.02);
  }

  const speakerFilter = ctx.createBiquadFilter();
  speakerFilter.type = 'bandpass';
  speakerFilter.frequency.setValueAtTime(880, now);
  speakerFilter.Q.setValueAtTime(1.6, now);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(0.16, now + 0.08);
  env.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(speakerFilter);
  speakerFilter.connect(env);
  env.connect(rideMusicGain);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export function triggerPauseNote(
  ctx: AudioContext,
  pauseMusicGain: GainNode,
  freqHz: number
): void {
  const now = ctx.currentTime;
  const dur = 1.25;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freqHz, now);

  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(0.14, now + 0.1);
  env.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(env);
  env.connect(pauseMusicGain);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}
