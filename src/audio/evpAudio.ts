import type { SanityTier } from '../types';
import { computeIntercomFormantProfile } from './intercom';

export interface EvpAudioNodes {
  evpStaticGain: GainNode;
  evpCarrierOsc: OscillatorNode;
  evpCarrierGain: GainNode;
}

/**
 * EVP radio frequency sweeping, static bed, carrier whistle, and voice syllable synthesis.
 */
export function createEvpAudioNodes(
  ctx: AudioContext,
  noiseBuffer: AudioBuffer,
  sfxMaster: GainNode
): EvpAudioNodes {
  const evpNoiseSource = ctx.createBufferSource();
  evpNoiseSource.buffer = noiseBuffer;
  evpNoiseSource.loop = true;

  const evpFilter = ctx.createBiquadFilter();
  evpFilter.type = 'bandpass';
  evpFilter.frequency.value = 1650;
  evpFilter.Q.value = 2.2;

  const evpStaticGain = ctx.createGain();
  evpStaticGain.gain.value = 0;

  evpNoiseSource.connect(evpFilter);
  evpFilter.connect(evpStaticGain);
  evpStaticGain.connect(sfxMaster);
  evpNoiseSource.start();

  const evpCarrierOsc = ctx.createOscillator();
  evpCarrierOsc.type = 'sine';
  evpCarrierOsc.frequency.value = 520;
  const evpCarrierGain = ctx.createGain();
  evpCarrierGain.gain.value = 0;
  evpCarrierOsc.connect(evpCarrierGain);
  evpCarrierGain.connect(sfxMaster);
  evpCarrierOsc.start();

  return {
    evpStaticGain,
    evpCarrierOsc,
    evpCarrierGain,
  };
}

export function playEvpRadioSyllable(
  ctx: AudioContext,
  sfxMaster: GainNode,
  sanityTier: SanityTier
): void {
  const now = ctx.currentTime;
  const prof = computeIntercomFormantProfile(sanityTier, Math.floor(now * 7));

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(prof.fundamentalHz * 1.15, now);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(prof.formant2Hz, now);
  filter.Q.setValueAtTime(4.5, now);

  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(0.06, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(filter);
  filter.connect(env);
  env.connect(sfxMaster);
  osc.start(now);
  osc.stop(now + 0.13);
}
