import { STORAGE_KEYS } from '../constants';
import type { SanityTier } from '../types';
import { playBandpassIntercomBurst } from './intercom';

/**
 * PA voice synthesis, chapter card transitions, and announcement persistence.
 */
export function recordLastLocalAnnouncement(text: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.ANNOUNCEMENT,
      JSON.stringify({ lastText: text, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

export function playPaVoiceAnnouncement(
  ctx: AudioContext,
  sfxMaster: GainNode,
  sanityTier: SanityTier,
  announcementText = ''
): void {
  if (announcementText) {
    recordLastLocalAnnouncement(announcementText);
  }

  const now = ctx.currentTime;
  const preOsc = ctx.createOscillator();
  const preGain = ctx.createGain();
  preOsc.type = 'sine';
  preOsc.frequency.setValueAtTime(587.33, now);
  preGain.gain.setValueAtTime(0.001, now);
  preGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  preGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  preOsc.connect(preGain);
  preGain.connect(sfxMaster);
  preOsc.start(now);
  preOsc.stop(now + 0.24);

  playBandpassIntercomBurst(ctx, sfxMaster, sanityTier);
}

export function playChapterCardTransition(ctx: AudioContext, sfxMaster: GainNode): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(146.83, now);
  osc.frequency.exponentialRampToValueAtTime(110.0, now + 0.45);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxMaster);
  osc.start(now);
  osc.stop(now + 0.5);
}
