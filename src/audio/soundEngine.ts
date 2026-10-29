import { HEARTBEAT_BPM_BY_TIER } from '../constants';
import { settingsStore } from '../settings';
import type { EngineSnapshot, SanityTier } from '../types';

/**
 * Canonical v5.3 Synthesized Web Audio Engine.
 * 100% procedural Web Audio synthesis with zero external audio files.
 * Safe in headless/Node environments where AudioContext is unavailable.
 */

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

export function computeEffectiveAudioGains(params: {
  muted: boolean;
  gameVolume: number;
  musicVolume: number;
  paused: boolean;
  paDuckingActive: boolean;
}): {
  masterSfxGain: number;
  rideMusicGain: number;
  pauseMusicGain: number;
} {
  if (params.muted) {
    return {
      masterSfxGain: 0,
      rideMusicGain: 0,
      pauseMusicGain: 0,
    };
  }

  const clampedGame = Math.max(0, Math.min(1, params.gameVolume));
  const clampedMusic = Math.max(0, Math.min(1, params.musicVolume));
  const duckMult = params.paDuckingActive ? 0.36 : 1.0;

  return {
    masterSfxGain: Number((clampedGame * (params.paused ? 0.25 : 1.0)).toFixed(3)),
    rideMusicGain: Number(
      (clampedMusic * (params.paused ? 0.0 : 0.42) * duckMult).toFixed(3)
    ),
    pauseMusicGain: Number((clampedMusic * (params.paused ? 0.48 : 0.0)).toFixed(3)),
  };
}

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

const RIDE_MOTIF_HZ = [220.0, 261.63, 329.63, 293.66, 246.94, 196.0] as const;
const PAUSE_CHORD_HZ = [261.63, 329.63, 392.0, 493.88] as const;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxMaster: GainNode | null = null;
  private rideMusicGain: GainNode | null = null;
  private pauseMusicGain: GainNode | null = null;
  private railNoiseGain: GainNode | null = null;
  private railFilter: BiquadFilterNode | null = null;
  private evpStaticGain: GainNode | null = null;
  private evpCarrierOsc: OscillatorNode | null = null;
  private evpCarrierGain: GainNode | null = null;

  private lastSubtitleId: string | null = null;
  private lastChimePlaying = false;
  private lastPhotoCount = 0;
  private lastCaughtCount = 0;
  private paDuckTimerSec = 0;
  private motifStepTimerSec = 0;
  private motifNoteIndex = 0;
  private pauseStepTimerSec = 0;
  private pauseNoteIndex = 0;
  private heartbeatTimerSec = 0;
  private railJointTimerSec = 0;
  private intercomCooldownSec = 9.5;
  private evpVoiceTimerSec = 0;

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    if (typeof window === 'undefined') return null;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const sfxMaster = ctx.createGain();
      sfxMaster.gain.value = 0.8;
      sfxMaster.connect(ctx.destination);
      this.sfxMaster = sfxMaster;

      const rideMusicGain = ctx.createGain();
      rideMusicGain.gain.value = 0;
      rideMusicGain.connect(ctx.destination);
      this.rideMusicGain = rideMusicGain;

      const pauseMusicGain = ctx.createGain();
      pauseMusicGain.gain.value = 0;
      pauseMusicGain.connect(ctx.destination);
      this.pauseMusicGain = pauseMusicGain;

      // Continuous procedural rail noise bed
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = output[i]!;
      }

      const whiteSource = ctx.createBufferSource();
      whiteSource.buffer = noiseBuffer;
      whiteSource.loop = true;

      const railFilter = ctx.createBiquadFilter();
      railFilter.type = 'bandpass';
      railFilter.frequency.value = 140;
      railFilter.Q.value = 1.4;
      this.railFilter = railFilter;

      const railNoiseGain = ctx.createGain();
      railNoiseGain.gain.value = 0;
      this.railNoiseGain = railNoiseGain;

      whiteSource.connect(railFilter);
      railFilter.connect(railNoiseGain);
      railNoiseGain.connect(sfxMaster);
      whiteSource.start();

      // EVP static & carrier nodes
      const evpNoiseSource = ctx.createBufferSource();
      evpNoiseSource.buffer = noiseBuffer;
      evpNoiseSource.loop = true;

      const evpFilter = ctx.createBiquadFilter();
      evpFilter.type = 'bandpass';
      evpFilter.frequency.value = 1650;
      evpFilter.Q.value = 2.2;

      const evpStaticGain = ctx.createGain();
      evpStaticGain.gain.value = 0;
      this.evpStaticGain = evpStaticGain;

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

      this.evpCarrierOsc = evpCarrierOsc;
      this.evpCarrierGain = evpCarrierGain;

      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Steps all continuous and reactive audio layers once per animation frame.
   */
  public step(dtSec: number, snapshot: EngineSnapshot): void {
    const settings = settingsStore.get();
    if (snapshot.phase === 'menu') {
      if (this.railNoiseGain && this.ctx) {
        this.railNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      if (this.evpStaticGain && this.ctx) {
        this.evpStaticGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      if (this.evpCarrierGain && this.ctx) {
        this.evpCarrierGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }

    if (this.paDuckTimerSec > 0) {
      this.paDuckTimerSec = Math.max(0, this.paDuckTimerSec - dtSec);
    }

    const gains = computeEffectiveAudioGains({
      muted: snapshot.muted,
      gameVolume: settings.gameVolume,
      musicVolume: settings.musicVolume,
      paused: snapshot.paused,
      paDuckingActive: this.paDuckTimerSec > 0,
    });

    if (snapshot.muted || (gains.masterSfxGain === 0 && gains.rideMusicGain === 0 && gains.pauseMusicGain === 0)) {
      if (this.ctx) {
        const now = this.ctx.currentTime;
        this.sfxMaster?.gain.setTargetAtTime(0, now, 0.04);
        this.rideMusicGain?.gain.setTargetAtTime(0, now, 0.04);
        this.pauseMusicGain?.gain.setTargetAtTime(0, now, 0.04);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.sfxMaster?.gain.setTargetAtTime(gains.masterSfxGain, now, 0.06);
    this.rideMusicGain?.gain.setTargetAtTime(gains.rideMusicGain, now, 0.12);
    this.pauseMusicGain?.gain.setTargetAtTime(gains.pauseMusicGain, now, 0.12);

    // 1. Reactive one-shot events (Door chime, PA lines, Polaroid shutter, Anomaly catch)
    if (snapshot.chimePlaying && !this.lastChimePlaying) {
      this.playDoorChime(snapshot.activeDoorTell === 'doors_open_early');
    }
    this.lastChimePlaying = snapshot.chimePlaying;

    if (snapshot.subtitle && snapshot.subtitle.id !== this.lastSubtitleId) {
      this.lastSubtitleId = snapshot.subtitle.id;
      if (snapshot.subtitle.isPa) {
        this.paDuckTimerSec = 3.2;
        this.playSpokenPaCadence(snapshot.sanityTier);
      }
    }

    if (snapshot.photos.length > this.lastPhotoCount) {
      this.lastPhotoCount = snapshot.photos.length;
      this.playPolaroidShutter();
    } else if (snapshot.photos.length < this.lastPhotoCount) {
      this.lastPhotoCount = snapshot.photos.length;
    }

    if (snapshot.anomaliesCaughtCount > this.lastCaughtCount) {
      this.lastCaughtCount = snapshot.anomaliesCaughtCount;
      this.playAnomalyCatch();
    } else if (snapshot.anomaliesCaughtCount < this.lastCaughtCount) {
      this.lastCaughtCount = snapshot.anomaliesCaughtCount;
    }

    // 2. Pause music clean arrangement
    if (snapshot.paused) {
      this.railNoiseGain?.gain.setTargetAtTime(0, now, 0.08);
      this.pauseStepTimerSec -= dtSec;
      if (this.pauseStepTimerSec <= 0) {
        this.pauseStepTimerSec = 1.35;
        const noteHz = PAUSE_CHORD_HZ[this.pauseNoteIndex % PAUSE_CHORD_HZ.length]!;
        this.pauseNoteIndex += 1;
        this.triggerPauseNote(noteHz);
      }
      return;
    }

    // 3. Rail ambience & rhythmic track joints
    const speedNorm = Math.min(1, snapshot.trainSpeedMps / 16.0);
    const targetRailGain = snapshot.phase === 'ride' ? speedNorm * 0.28 : 0.02;
    this.railNoiseGain?.gain.setTargetAtTime(targetRailGain, now, 0.1);
    if (this.railFilter) {
      const targetFreq = snapshot.isOnTrestle ? 260 + speedNorm * 140 : 110 + speedNorm * 95;
      this.railFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);
    }

    if (snapshot.trainSpeedMps > 2.5) {
      this.railJointTimerSec -= dtSec * (snapshot.trainSpeedMps / 12.0);
      if (this.railJointTimerSec <= 0) {
        this.railJointTimerSec = 1.45;
        this.playRailJointClack(snapshot.isOnTrestle);
      }
    }

    // 4. 4-Stage Decaying Speaker Tune (RideMusic)
    const decay = DECAY_STAGE_BY_TIER[snapshot.sanityTier];
    this.motifStepTimerSec -= dtSec * decay.tempoMultiplier;
    if (this.motifStepTimerSec <= 0 && snapshot.phase === 'ride') {
      this.motifStepTimerSec = 1.65;
      const rawHz = RIDE_MOTIF_HZ[this.motifNoteIndex % RIDE_MOTIF_HZ.length]!;
      this.motifNoteIndex += 1;
      this.triggerDecayingSpeakerNote(rawHz * decay.pitchMultiplier, decay);
    }

    // 5. Wordless pitch-warbling background intercom
    if (snapshot.phase === 'ride' && this.paDuckTimerSec <= 0) {
      this.intercomCooldownSec -= dtSec;
      if (this.intercomCooldownSec <= 0) {
        this.intercomCooldownSec = 12 + Math.random() * 10;
        this.playWordlessIntercomBurst(snapshot.sanityTier);
      }
    }

    // 6. Heartbeat double-thump (Medium/Low/Critical sanity or active Restraint)
    const shouldBeat =
      snapshot.sanityTier !== 'High' || Boolean(snapshot.activeRestraint?.active);
    if (shouldBeat) {
      const bpm = HEARTBEAT_BPM_BY_TIER[snapshot.sanityTier];
      const periodSec = 60 / bpm;
      this.heartbeatTimerSec -= dtSec;
      if (this.heartbeatTimerSec <= 0) {
        this.heartbeatTimerSec = periodSec;
        this.playHeartbeatThump(snapshot.sanityTier);
      }
    }

    // 7. EVP Recorder radio hiss, carrier tones, & tape playback
    const evpActive = snapshot.evpOpen || snapshot.playingTapeId !== null;
    if (evpActive) {
      const strength = snapshot.playingTapeId ? 0.9 : snapshot.evpSignalStrength;
      const staticLevel = 0.06 + (1 - strength * 0.65) * 0.14;
      this.evpStaticGain?.gain.setTargetAtTime(staticLevel, now, 0.05);

      const isCarrier =
        snapshot.evpLockedSignalId?.startsWith('carrier_') ||
        snapshot.playingTapeId?.startsWith('carrier_');
      if (isCarrier && strength > 0.35) {
        const carrierHz = 440 + ((snapshot.evpFrequencyMhz * 10) % 240);
        this.evpCarrierOsc?.frequency.setTargetAtTime(carrierHz, now, 0.05);
        this.evpCarrierGain?.gain.setTargetAtTime(strength * 0.14, now, 0.05);
      } else {
        this.evpCarrierGain?.gain.setTargetAtTime(0, now, 0.05);
        if (strength > 0.45 && (snapshot.evpLockedSignalId || snapshot.playingTapeId)) {
          this.evpVoiceTimerSec -= dtSec;
          if (this.evpVoiceTimerSec <= 0) {
            this.evpVoiceTimerSec = 0.24;
            this.playEvpRadioSyllable(snapshot.sanityTier);
          }
        }
      }
    } else {
      this.evpStaticGain?.gain.setTargetAtTime(0, now, 0.06);
      this.evpCarrierGain?.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  public playDoorChime(earlyTell = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxMaster) return;

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
      gain.connect(this.sfxMaster!);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  }

  public playWordlessIntercomBurst(sanityTier: SanityTier): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxMaster) return;

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
      env.connect(this.sfxMaster);
      osc.start(start);
      osc.stop(end + 0.01);
    }
  }

  public playSpokenPaCadence(sanityTier: SanityTier): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxMaster) return;

    const now = ctx.currentTime;
    // Short attention pre-tone followed by cadence
    const preOsc = ctx.createOscillator();
    const preGain = ctx.createGain();
    preOsc.type = 'sine';
    preOsc.frequency.setValueAtTime(587.33, now);
    preGain.gain.setValueAtTime(0.001, now);
    preGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    preGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    preOsc.connect(preGain);
    preGain.connect(this.sfxMaster);
    preOsc.start(now);
    preOsc.stop(now + 0.24);

    this.playWordlessIntercomBurst(sanityTier);
  }

  public playPolaroidShutter(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxMaster) return;

    const now = ctx.currentTime;
    // Mechanical click + motor whirr
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxMaster);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playAnomalyCatch(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxMaster) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxMaster);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playTier3TearGlitch(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxMaster) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(48, now + 0.22);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxMaster);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playPassingTrainWhoosh(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxMaster) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(115, now + 1.1);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

    osc.connect(gain);
    gain.connect(this.sfxMaster);
    osc.start(now);
    osc.stop(now + 1.2);
  }

  private triggerDecayingSpeakerNote(freqHz: number, decay: DecayStageParams): void {
    if (!this.ctx || !this.rideMusicGain) return;
    const now = this.ctx.currentTime;
    const dur = 1.4;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqHz, now);

    if (decay.warbleDepthHz > 0.3) {
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(decay.warbleRateHz, now);
      lfoGain.gain.setValueAtTime(decay.warbleDepthHz, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + dur);
    }

    const speakerFilter = this.ctx.createBiquadFilter();
    speakerFilter.type = 'bandpass';
    speakerFilter.frequency.setValueAtTime(880, now);
    speakerFilter.Q.setValueAtTime(1.6, now);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.16, now + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(speakerFilter);
    speakerFilter.connect(env);
    env.connect(this.rideMusicGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private triggerPauseNote(freqHz: number): void {
    if (!this.ctx || !this.pauseMusicGain) return;
    const now = this.ctx.currentTime;
    const dur = 1.25;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqHz, now);

    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.14, now + 0.1);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(env);
    env.connect(this.pauseMusicGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private playRailJointClack(isOnTrestle: boolean): void {
    if (!this.ctx || !this.sfxMaster) return;
    const now = this.ctx.currentTime;
    const baseFreq = isOnTrestle ? 175 : 95;

    [0, 0.14].forEach((offset) => {
      const start = now + offset;
      const osc = this.ctx!.createOscillator();
      const env = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(42, start + 0.06);

      env.gain.setValueAtTime(0.12, start);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.07);

      osc.connect(env);
      env.connect(this.sfxMaster!);
      osc.start(start);
      osc.stop(start + 0.08);
    });
  }

  private playHeartbeatThump(sanityTier: SanityTier): void {
    if (!this.ctx || !this.sfxMaster) return;
    const now = this.ctx.currentTime;
    const level = sanityTier === 'Critical' ? 0.22 : sanityTier === 'Low' ? 0.15 : 0.09;

    [0, 0.18].forEach((offset, idx) => {
      const start = now + offset;
      const osc = this.ctx!.createOscillator();
      const env = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 58 : 48, start);
      osc.frequency.exponentialRampToValueAtTime(28, start + 0.11);

      env.gain.setValueAtTime(level * (idx === 0 ? 1 : 0.72), start);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(env);
      env.connect(this.sfxMaster!);
      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  private playEvpRadioSyllable(sanityTier: SanityTier): void {
    if (!this.ctx || !this.sfxMaster) return;
    const now = this.ctx.currentTime;
    const prof = computeIntercomFormantProfile(sanityTier, Math.floor(now * 7));

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

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
    env.connect(this.sfxMaster);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}

export const soundEngine = new SoundEngine();

