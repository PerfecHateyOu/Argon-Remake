import type { EngineSnapshot } from '../types';
import { type EvpAudioNodes, playEvpRadioSyllable } from './evpAudio';

/**
 * Tape static and microcassette playback synthesizer stepping.
 */
export function stepTapeAndEvpAudio(params: {
  ctx: AudioContext;
  sfxMaster: GainNode;
  nodes: EvpAudioNodes;
  snapshot: EngineSnapshot;
  dtSec: number;
  voiceTimerSec: number;
}): number {
  const { ctx, sfxMaster, nodes, snapshot, dtSec } = params;
  let nextVoiceTimerSec = params.voiceTimerSec;
  const now = ctx.currentTime;

  const evpActive = snapshot.evpOpen || snapshot.playingTapeId !== null;
  if (!evpActive) {
    nodes.evpStaticGain.gain.setTargetAtTime(0, now, 0.06);
    nodes.evpCarrierGain.gain.setTargetAtTime(0, now, 0.06);
    return nextVoiceTimerSec;
  }

  const strength = snapshot.playingTapeId ? 0.9 : snapshot.evpSignalStrength;
  const staticLevel = 0.06 + (1 - strength * 0.65) * 0.14;
  nodes.evpStaticGain.gain.setTargetAtTime(staticLevel, now, 0.05);

  const isCarrier =
    snapshot.evpLockedSignalId?.startsWith('carrier_') ||
    snapshot.playingTapeId?.startsWith('carrier_');

  if (isCarrier && strength > 0.35) {
    const carrierHz = 440 + ((snapshot.evpFrequencyMhz * 10) % 240);
    nodes.evpCarrierOsc.frequency.setTargetAtTime(carrierHz, now, 0.05);
    nodes.evpCarrierGain.gain.setTargetAtTime(strength * 0.14, now, 0.05);
  } else {
    nodes.evpCarrierGain.gain.setTargetAtTime(0, now, 0.05);
    if (strength > 0.45 && (snapshot.evpLockedSignalId || snapshot.playingTapeId)) {
      nextVoiceTimerSec -= dtSec;
      if (nextVoiceTimerSec <= 0) {
        nextVoiceTimerSec = 0.24;
        playEvpRadioSyllable(ctx, sfxMaster, snapshot.sanityTier);
      }
    }
  }

  return nextVoiceTimerSec;
}
