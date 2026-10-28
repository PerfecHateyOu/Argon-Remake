import {
  EVP_FREQ_MAX_MHZ,
  EVP_FREQ_MIN_MHZ,
  EVP_FREQ_STEP_MHZ,
  EVP_LOCK_TOLERANCE_MHZ,
  EVP_SIGNAL_RANGE_MHZ,
} from '../constants';
import type { EvpSignalId, EvpTapeRecord, RouteLineId } from '../types';
import { formatRouteText } from './routeText';

export interface EvpStationSpec {
  id: EvpSignalId;
  frequencyMhz: number;
  titleTemplate: string;
  transcriptTemplate: string;
  altTitleTemplate?: string;
  altTranscriptTemplate?: string;
  isCarrierOnly: boolean;
  isSecretBroadcaster: boolean;
  isConductor: boolean;
}

export const EVP_STATION_SPECS: readonly EvpStationSpec[] = [
  {
    id: 'dispatch_track_2',
    frequencyMhz: 89.3,
    titleTemplate: 'Dispatch, track 2',
    transcriptTemplate: '…{line} four-forty, hold at {s10}. Hold. Do not open the doors at {s10}…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'carrier_90_20',
    frequencyMhz: 90.2,
    titleTemplate: 'Carrier Wave',
    transcriptTemplate: '— a carrier tone, no voice —',
    isCarrierOnly: true,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'a_passenger',
    frequencyMhz: 91.15,
    titleTemplate: 'A passenger',
    transcriptTemplate:
      '…I got on at {originShort} too. I always get on at {originShort}. I always get on at {originShort}…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'dispatch_no_train',
    frequencyMhz: 92.8,
    titleTemplate: 'Dispatch, no train number',
    transcriptTemplate:
      '…there is no train scheduled on this track. Repeat: nothing is scheduled on this track…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'someone_far_end',
    frequencyMhz: 94.6,
    titleTemplate: 'Someone at the far end',
    transcriptTemplate:
      '…first time? It gets easier after {s11}. Don’t let them see you looking…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'static_then_time',
    frequencyMhz: 96.45,
    titleTemplate: 'Static, then a time',
    transcriptTemplate: '…6:52… 6:52 a.m.… it was 6:52 the last time, too…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'carrier_97_35',
    frequencyMhz: 97.35,
    titleTemplate: 'Carrier Wave',
    transcriptTemplate: '— a carrier tone, no voice —',
    isCarrierOnly: true,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 'conductor_echo',
    frequencyMhz: 98.2,
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
    frequencyMhz: 100.1,
    titleTemplate: 'A voice like Mom’s',
    transcriptTemplate: '…honey, don’t look at the window. Look at me. Look at me…',
    isCarrierOnly: false,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 's5_dispatch_static',
    frequencyMhz: 101.75,
    titleTemplate: '{s5} dispatch static',
    transcriptTemplate:
      '…Dispatch 44 to all units on {line}… relay failure at {s5}. Unauthorized personnel on track bed… repeat: do not look at track bed…',
    isCarrierOnly: false,
    isSecretBroadcaster: true,
    isConductor: false,
  },
  {
    id: 's4_phantom_pa',
    frequencyMhz: 103.4,
    titleTemplate: '{s4} phantom PA echo',
    transcriptTemplate:
      '…Please stand clear of the closing doors… the train following this one does not exist… return to your seat immediately…',
    isCarrierOnly: false,
    isSecretBroadcaster: true,
    isConductor: false,
  },
  {
    id: 'carrier_104_30',
    frequencyMhz: 104.3,
    titleTemplate: 'Carrier Wave',
    transcriptTemplate: '— a carrier tone, no voice —',
    isCarrierOnly: true,
    isSecretBroadcaster: false,
    isConductor: false,
  },
  {
    id: 's7_night_wiretap',
    frequencyMhz: 105.25,
    titleTemplate: '{s7} night wiretap',
    transcriptTemplate:
      '…Station log 02:14. Platform empty, but footsteps continue down the south stairs. Someone is whistling the wrong chime…',
    isCarrierOnly: false,
    isSecretBroadcaster: true,
    isConductor: false,
  },
  {
    id: 'emergency_channel',
    frequencyMhz: 106.9,
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

/**
 * Clamps and rounds an EVP dial frequency to the nearest 5 kHz (0.05 MHz) step
 * in [88.1, 107.9] MHz.
 */
export function clampEvpFrequency(freqMhz: number): number {
  const clamped = Math.max(EVP_FREQ_MIN_MHZ, Math.min(EVP_FREQ_MAX_MHZ, freqMhz));
  const stepped = Math.round(clamped / EVP_FREQ_STEP_MHZ) * EVP_FREQ_STEP_MHZ;
  return Number(stepped.toFixed(2));
}

/**
 * Resolves the canonical v5.3 title and transcript for an EVP station on the active route.
 */
export function resolveEvpStationText(
  spec: EvpStationSpec,
  route: RouteLineId,
  isAboveGround: boolean
): { title: string; transcript: string } {
  if (spec.id === 'conductor_echo') {
    const rawTranscript =
      route === 'G' && isAboveGround && spec.altTranscriptTemplate
        ? spec.altTranscriptTemplate
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
 * Evaluates the signal meter strength (0..1) and locked station at a given dial frequency.
 * Signals only come through while the train is moving (`trainSpeedMps > 0.5`).
 */
export function evaluateEvpTuning(params: {
  frequencyMhz: number;
  trainSpeedMps: number;
  route: RouteLineId;
  isAboveGround: boolean;
}): EvpTuningEvaluation {
  const { frequencyMhz, trainSpeedMps, route, isAboveGround } = params;

  if (trainSpeedMps <= 0.5) {
    return {
      signalStrength: 0,
      lockedSpec: null,
      lockedTitle: null,
      liveTranscript: null,
    };
  }

  let closestSpec: EvpStationSpec | null = null;
  let minDiff = Infinity;

  for (const spec of EVP_STATION_SPECS) {
    const diff = Math.abs(spec.frequencyMhz - frequencyMhz);
    if (diff < minDiff) {
      minDiff = diff;
      closestSpec = spec;
    }
  }

  if (!closestSpec || minDiff > EVP_SIGNAL_RANGE_MHZ) {
    return {
      signalStrength: 0.06,
      lockedSpec: null,
      lockedTitle: null,
      liveTranscript: null,
    };
  }

  const normalizedStrength = Math.max(
    0.08,
    Math.min(1, 1 - minDiff / EVP_SIGNAL_RANGE_MHZ)
  );
  const isLocked = minDiff <= EVP_LOCK_TOLERANCE_MHZ;

  if (!isLocked) {
    return {
      signalStrength: Number(normalizedStrength.toFixed(2)),
      lockedSpec: null,
      lockedTitle: null,
      liveTranscript: null,
    };
  }

  const resolved = resolveEvpStationText(closestSpec, route, isAboveGround);
  return {
    signalStrength: Number(normalizedStrength.toFixed(2)),
    lockedSpec: closestSpec,
    lockedTitle: resolved.title,
    liveTranscript: resolved.transcript,
  };
}

/**
 * Builds an EvpTapeRecord when the player finishes holding Record on a locked signal.
 */
export function buildEvpTapeRecord(params: {
  spec: EvpStationSpec;
  route: RouteLineId;
  isAboveGround: boolean;
  stopNumber: number;
}): EvpTapeRecord {
  const { spec, route, isAboveGround, stopNumber } = params;
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
