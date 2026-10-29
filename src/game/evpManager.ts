import {
  EVP_FREQ_MAX_MHZ,
  EVP_FREQ_MIN_MHZ,
  EVP_FREQ_STEP_MHZ,
  EVP_LISTEN_REVEAL_SEC,
  EVP_LOCK_TOLERANCE_MHZ,
  EVP_MIN_SIGNAL_SPACING_KHZ,
  EVP_SIGNAL_RANGE_MHZ,
} from '../constants';
import type { EvpSignalId, EvpTapeRecord, RouteLineId } from '../types';
import { formatRouteText } from './routeText';

export interface EvpStationSpec {
  id: EvpSignalId;
  frequencyMhz: number;
  stops: readonly number[];
  titleTemplate: string;
  transcriptTemplate: string;
  altTitleTemplate?: string;
  altTranscriptTemplate?: string;
  isCarrierOnly: boolean;
  isSecretBroadcaster: boolean;
  isConductor: boolean;
}

export const EVP_STATION_SPECS: EvpStationSpec[] = [
  {
    id: 'dispatch_track_2',
    frequencyMhz: 74,
    stops: [6, 7],
    titleTemplate: 'Dispatch, track 2',
    transcriptTemplate: '…{line} four-forty, hold at {s10}. Hold. Do not open the doors at {s10}…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'a_passenger',
    frequencyMhz: 83,
    stops: [6, 7, 8],
    titleTemplate: 'A passenger',
    transcriptTemplate:
      '…I got on at {originShort} too. I always get on at {originShort}. I always get on at {originShort}…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'dispatch_no_train',
    frequencyMhz: 92,
    stops: [8, 9, 10],
    titleTemplate: 'Dispatch, no train number',
    transcriptTemplate:
      '…there is no train scheduled on this track. Repeat: nothing is scheduled on this track…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'someone_far_end',
    frequencyMhz: 101,
    stops: [9, 10, 11],
    titleTemplate: 'Someone at the far end',
    transcriptTemplate:
      '…first time? It gets easier after {s11}. Don’t let them see you looking…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'static_then_time',
    frequencyMhz: 110,
    stops: [10, 11, 12],
    titleTemplate: 'Static, then a time',
    transcriptTemplate: '…6:52… 6:52 a.m.… it was 6:52 the last time, too…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'conductor_echo',
    frequencyMhz: 119,
    stops: [12, 13],
    titleTemplate: 'The conductor',
    transcriptTemplate:
      '…this is your conductor. We are under the river. This train does not go under the river…',
    altTranscriptTemplate:
      '…this is your conductor. We are above ground. This train does not go above ground…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: true,
  },
  {
    id: 'voice_like_moms',
    frequencyMhz: 128,
    stops: [12, 13],
    titleTemplate: 'A voice like Mom’s',
    transcriptTemplate: '…honey, don’t look at the window. Look at me. Look at me…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 's5_dispatch_static',
    frequencyMhz: 137,
    stops: [6, 7],
    titleTemplate: '{s5} dispatch static',
    transcriptTemplate:
      '…Dispatch 44 to all units on {line}… relay failure at {s5}. Unauthorized personnel on track bed… repeat: do not look at track bed…',
    isCarrierOnly: false,
    isSecretBroadcaster: true,
    isConductor: false,
  },
  {
    id: 's4_phantom_pa',
    frequencyMhz: 146,
    stops: [6, 7, 8, 9],
    titleTemplate: '{s4} phantom PA echo',
    transcriptTemplate:
      '…Please stand clear of the closing doors… the train following this one does not exist… return to your seat immediately…',
    isCarrierOnly: false,
    isSecretBroadcaster: true,
    isConductor: false,
  },
  {
    id: 's7_night_wiretap',
    frequencyMhz: 155,
    stops: [7, 8, 9, 10],
    titleTemplate: '{s7} night wiretap',
    transcriptTemplate:
      '…Station log 02:14. Platform empty, but footsteps continue down the south stairs. Someone is whistling the wrong chime…',
    isCarrierOnly: false,
    isSecretBroadcaster: true,
    isConductor: false,
  },
  {
    id: 'emergency_channel',
    frequencyMhz: 164,
    stops: [11, 12, 13],
    titleTemplate: 'Newtown Creek emergency channel',
    altTitleTemplate: 'Track emergency channel',
    transcriptTemplate:
      '…Maritime security channel 16. Bridge clearance confirmed. Unscheduled train visible on upper trestle. Who authorized that train…',
    altTranscriptTemplate:
      '…Track security channel 16. Signals confirmed. Unscheduled train visible on a closed track. Who authorized that train…',
    isCarrierOnly: false,
    isSecretBroadcaster: true,
    isConductor: false,
  },
];

const decoyCarriersByStop = new Map<number, [EvpStationSpec, EvpStationSpec]>();

function sampleSpacedFrequencies(
  count: number,
  minKhz: number,
  maxKhz: number,
  minGapKhz: number,
  existingFreqs: readonly number[],
  randomFn: () => number
): number[] {
  const candidates: number[] = [];
  for (let f = minKhz; f <= maxKhz; f += 1) {
    candidates.push(f);
  }

  // Shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }

  const chosen: number[] = [];
  for (const f of candidates) {
    const farFromExisting = existingFreqs.every((ef) => Math.abs(ef - f) >= minGapKhz);
    const farFromChosen = chosen.every((cf) => Math.abs(cf - f) >= minGapKhz);
    if (farFromExisting && farFromChosen) {
      chosen.push(f);
      if (chosen.length === count) {
        return chosen;
      }
    }
  }

  // Fallback slack-distribution if greedy pass didn't fill all slots
  const totalNeeded = existingFreqs.length + count;
  const span = maxKhz - minKhz;
  const minSpan = (totalNeeded - 1) * minGapKhz;
  const totalSlack = Math.max(0, span - minSpan);
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i <= totalNeeded; i++) {
    const w = randomFn() + 0.05;
    weights.push(w);
    weightSum += w;
  }

  let accSlack = 0;
  const allSlots: number[] = [];
  for (let i = 0; i < totalNeeded; i++) {
    accSlack += ((weights[i] ?? 0) / weightSum) * totalSlack;
    const freq = Math.min(maxKhz, Math.round(minKhz + i * minGapKhz + accSlack));
    allSlots.push(freq);
  }
  for (let i = 1; i < allSlots.length; i++) {
    if (allSlots[i]! - allSlots[i - 1]! < minGapKhz) {
      allSlots[i] = allSlots[i - 1]! + minGapKhz;
    }
  }
  for (let i = allSlots.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = allSlots[i]!;
    allSlots[i] = allSlots[j]!;
    allSlots[j] = tmp;
  }
  return allSlots.slice(0, count);
}

/**
 * Reshuffles all 11 broadcast frequencies and generates 2 decoy carriers per stretch
 * in [70, 180] kHz with at least 8 kHz between signals.
 */
export function reshuffleEvpFrequencies(randomFn: () => number = Math.random): void {
  const count = EVP_STATION_SPECS.length; // 11
  const span = EVP_FREQ_MAX_MHZ - EVP_FREQ_MIN_MHZ; // 110
  const minSpan = (count - 1) * EVP_MIN_SIGNAL_SPACING_KHZ; // 80
  const totalSlack = Math.max(0, span - minSpan); // 30

  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i <= count; i++) {
    const w = randomFn() + 0.05;
    weights.push(w);
    weightSum += w;
  }

  let accSlack = 0;
  const spacedFreqs: number[] = [];
  for (let i = 0; i < count; i++) {
    accSlack += ((weights[i] ?? 0) / weightSum) * totalSlack;
    const raw = Math.round(EVP_FREQ_MIN_MHZ + i * EVP_MIN_SIGNAL_SPACING_KHZ + accSlack);
    const prev = i > 0 ? spacedFreqs[i - 1]! + EVP_MIN_SIGNAL_SPACING_KHZ : EVP_FREQ_MIN_MHZ;
    const maxAllowed = EVP_FREQ_MAX_MHZ - (count - 1 - i) * EVP_MIN_SIGNAL_SPACING_KHZ;
    spacedFreqs.push(Math.max(prev, Math.min(maxAllowed, raw)));
  }

  // Shuffle order of the 11 spaced frequencies
  for (let i = spacedFreqs.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = spacedFreqs[i]!;
    spacedFreqs[i] = spacedFreqs[j]!;
    spacedFreqs[j] = tmp;
  }

  for (let i = 0; i < EVP_STATION_SPECS.length; i++) {
    EVP_STATION_SPECS[i]!.frequencyMhz = spacedFreqs[i]!;
  }

  decoyCarriersByStop.clear();
  for (let stop = 1; stop <= 13; stop++) {
    const stretchBroadcasts = EVP_STATION_SPECS.filter((s) => s.stops.includes(stop));
    const existing = stretchBroadcasts.map((s) => s.frequencyMhz);
    const decoyFreqs = sampleSpacedFrequencies(
      2,
      EVP_FREQ_MIN_MHZ,
      EVP_FREQ_MAX_MHZ,
      EVP_MIN_SIGNAL_SPACING_KHZ,
      existing,
      randomFn
    );

    const carrier1: EvpStationSpec = {
      id: 'decoy_carrier_1',
      frequencyMhz: decoyFreqs[0] ?? 71,
      stops: [stop],
      titleTemplate: 'Carrier Wave',
      transcriptTemplate: '— a carrier tone, no voice —',
      isCarrierOnly: true,
      isSecretBroadcaster: false,
      isConductor: false,
    };
    const carrier2: EvpStationSpec = {
      id: 'decoy_carrier_2',
      frequencyMhz: decoyFreqs[1] ?? 179,
      stops: [stop],
      titleTemplate: 'Carrier Wave',
      transcriptTemplate: '— a carrier tone, no voice —',
      isCarrierOnly: true,
      isSecretBroadcaster: false,
      isConductor: false,
    };
    decoyCarriersByStop.set(stop, [carrier1, carrier2]);
  }
}

// Initialize default decoy carriers at module load
reshuffleEvpFrequencies();

export function getStationFrequencyKhz(id: EvpSignalId): number {
  const spec = EVP_STATION_SPECS.find((s) => s.id === id);
  return spec ? spec.frequencyMhz : EVP_FREQ_MIN_MHZ;
}

/**
 * Returns the receivable broadcasts and the 2 decoy carriers for a given stretch (stopNumber).
 */
export function getActiveEvpSignalsForStretch(stopNumber: number): EvpStationSpec[] {
  const broadcasts = EVP_STATION_SPECS.filter((s) => s.stops.includes(stopNumber));
  let carriers = decoyCarriersByStop.get(stopNumber);
  if (!carriers) {
    reshuffleEvpFrequencies();
    carriers = decoyCarriersByStop.get(stopNumber);
  }
  return carriers ? [...broadcasts, carriers[0], carriers[1]] : broadcasts;
}

/**
 * Clamps and rounds an EVP dial frequency in [70, 180] kHz.
 */
export function clampEvpFrequency(freqMhz: number): number {
  const clamped = Math.max(EVP_FREQ_MIN_MHZ, Math.min(EVP_FREQ_MAX_MHZ, freqMhz));
  const stepped = Math.round(clamped / EVP_FREQ_STEP_MHZ) * EVP_FREQ_STEP_MHZ;
  return Number(stepped.toFixed(1));
}

/**
 * Resolves the canonical v5.3 title and transcript for an EVP station on the active route.
 * Conductor tape: on the G line ALWAYS uses "…this is your conductor. We are above ground. This train does not go above ground…";
 * uses "under the river" only off the G.
 */
export function resolveEvpStationText(
  spec: EvpStationSpec,
  route: RouteLineId,
  _isAboveGround?: boolean
): { title: string; transcript: string } {
  if (spec.id === 'conductor_echo') {
    const rawTranscript =
      route === 'G'
        ? (spec.altTranscriptTemplate ?? spec.transcriptTemplate)
        : spec.transcriptTemplate;
    return {
      title: formatRouteText(spec.titleTemplate, route),
      transcript: formatRouteText(rawTranscript, route),
    };
  }

  if (spec.id === 'emergency_channel') {
    const rawTitle =
      route === 'G' ? spec.titleTemplate : (spec.altTitleTemplate ?? spec.titleTemplate);
    const rawTranscript =
      route === 'G'
        ? spec.transcriptTemplate
        : (spec.altTranscriptTemplate ?? spec.transcriptTemplate);
    return {
      title: formatRouteText(rawTitle, route),
      transcript: formatRouteText(rawTranscript, route),
    };
  }

  return {
    title: formatRouteText(spec.titleTemplate, route),
    transcript: formatRouteText(spec.transcriptTemplate, route),
  };
}

export interface EvpTuningEvaluation {
  signalStrength: number;
  lockedSpec: EvpStationSpec | null;
  lockedTitle: string | null;
  liveTranscript: string | null;
}

/**
 * Evaluates the signal meter strength (0..1, Gaussian width 4 kHz) and locked station (within 1.0 kHz)
 * at a given dial frequency.
 * - Signals only come through while the train is moving (`trainSpeedMps > 0.5`).
 * - Each broadcast is receivable only on its stretches (`stopNumber`).
 * - The full transcript reveals only after 3 s of listening (`listenElapsedSec >= 3.0`), not instantly on lock.
 */
export function evaluateEvpTuning(params: {
  frequencyMhz: number;
  trainSpeedMps: number;
  route: RouteLineId;
  isAboveGround?: boolean;
  stopNumber?: number;
  listenElapsedSec?: number;
}): EvpTuningEvaluation {
  const {
    frequencyMhz,
    trainSpeedMps,
    route,
    isAboveGround = false,
    stopNumber,
    listenElapsedSec = 0,
  } = params;

  if (trainSpeedMps <= 0.5) {
    return {
      signalStrength: 0,
      lockedSpec: null,
      lockedTitle: null,
      liveTranscript: null,
    };
  }

  const activeSignals =
    typeof stopNumber === 'number'
      ? getActiveEvpSignalsForStretch(stopNumber)
      : EVP_STATION_SPECS;

  let closestSpec: EvpStationSpec | null = null;
  let minDiff = Infinity;

  for (const spec of activeSignals) {
    const diff = Math.abs(spec.frequencyMhz - frequencyMhz);
    if (diff < minDiff) {
      minDiff = diff;
      closestSpec = spec;
    }
  }

  if (!closestSpec) {
    return {
      signalStrength: 0,
      lockedSpec: null,
      lockedTitle: null,
      liveTranscript: null,
    };
  }

  // Gaussian signal meter with width 4 kHz
  const gaussianStrength = Math.exp(-Math.pow(minDiff / EVP_SIGNAL_RANGE_MHZ, 2));
  const normalizedStrength = Number(Math.max(0, Math.min(1, gaussianStrength)).toFixed(2));
  const isLocked = minDiff <= EVP_LOCK_TOLERANCE_MHZ;

  if (!isLocked) {
    return {
      signalStrength: normalizedStrength,
      lockedSpec: null,
      lockedTitle: null,
      liveTranscript: null,
    };
  }

  const resolved = resolveEvpStationText(closestSpec, route, isAboveGround);
  const fullTranscriptRevealed = listenElapsedSec >= EVP_LISTEN_REVEAL_SEC;

  return {
    signalStrength: normalizedStrength,
    lockedSpec: closestSpec,
    lockedTitle: resolved.title,
    liveTranscript: fullTranscriptRevealed ? resolved.transcript : null,
  };
}

/**
 * Builds an EvpTapeRecord when the player finishes holding Record (1.5 s) on a locked signal.
 */
export function buildEvpTapeRecord(params: {
  spec: EvpStationSpec;
  route: RouteLineId;
  isAboveGround?: boolean;
  stopNumber: number;
}): EvpTapeRecord {
  const { spec, route, isAboveGround = false, stopNumber } = params;
  const resolved = resolveEvpStationText(spec, route, isAboveGround);
  return {
    id: spec.id,
    frequencyMhz: spec.frequencyMhz,
    title: resolved.title,
    transcript: resolved.transcript,
    isCarrierOnly: spec.isCarrierOnly,
    isSecretBroadcaster: spec.isSecretBroadcaster,
    stopNumber,
  };
}
