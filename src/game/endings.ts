import { COMPOSURE_INTACT_MAX_SUSPICION, RESTRAINT_CEILING_RAISE, SEGMENT_TABLE } from '../constants';
import type {
  EndingId,
  EndingResult,
  ExitChoiceId,
  ProgressArchive,
  RouteLineId,
  StopDecisionRecord,
} from '../types';
import { formatRouteText } from './routeText';

export interface EndingCatalogEntry {
  id: EndingId;
  index: number; // 1..8
  title: string;
  badge: string;
  narrativeTemplate: string;
  summaryTemplate: string;
  primaryButtonLabel: 'Get back on' | 'Ride again';
  isAlternativeEscape: boolean;
}

export const ENDING_IDS: readonly EndingId[] = [
  'unbroken_mask',
  'eternal_commute',
  'midnight_terminal',
  'skyward_catwalk',
  'dawn_horizon',
  'exposed',
  'disoriented_collapse',
  'civilian_extraction',
] as const;

export const ENDING_CATALOG: Record<EndingId, EndingCatalogEntry> = {
  unbroken_mask: {
    id: 'unbroken_mask',
    index: 1,
    title: 'The Unbroken Mask',
    badge: '[SECRET: THE UNBROKEN MASK]',
    narrativeTemplate:
      'At {terminus}, Mom takes your hand on the escalator. “You can stop pretending now,” she says, not looking at you. “We saw it too.”',
    summaryTemplate: 'The whole ride without a single visible reaction (peak Suspicion 0).',
    primaryButtonLabel: 'Ride again',
    isAlternativeEscape: true,
  },
  eternal_commute: {
    id: 'eternal_commute',
    index: 2,
    title: 'The Eternal Commute',
    badge: '[LOOP: THE ETERNAL COMMUTE]',
    narrativeTemplate:
      'The doors open. The sign says {origin}. Mom stands up and smooths her coat. “This is us,” she says.',
    summaryTemplate:
      'Stepped off at {bait}, or let too much of yourself slip away (Sanity Retained under 30%).',
    primaryButtonLabel: 'Get back on',
    isAlternativeEscape: false,
  },
  midnight_terminal: {
    id: 'midnight_terminal',
    index: 3,
    title: 'Midnight Terminal',
    badge: '[BRANCH: SIGNAL ARCHIVIST]',
    narrativeTemplate:
      'You descend past the rusted chain-link gate into {terminus}’s abandoned lower level. The microcassette recorder crackles to life on its own in the damp darkness. A calm dispatcher voice speaks through the hiss: “Track 4 clear. All units hold position.” The loop is broken.',
    summaryTemplate:
      'Followed the static down the side stairs, with tapes in hand, most anomalies caught, and your composure intact.',
    primaryButtonLabel: 'Ride again',
    isAlternativeEscape: true,
  },
  skyward_catwalk: {
    id: 'skyward_catwalk',
    index: 4,
    title: 'Skyward Catwalk',
    badge: '[BRANCH: SKYWARD VOID]',
    narrativeTemplate:
      'You break away through the emergency door and climb until there is open air. Below you, the sodium lights of the city glow in eerie silence, completely empty. Behind you, the train rumbles into the dark tunnel—its cars completely hollow.',
    summaryTemplate:
      'Pushed through the emergency door after holding firm through the restraint, without a single False Stop or intervention.',
    primaryButtonLabel: 'Ride again',
    isAlternativeEscape: true,
  },
  dawn_horizon: {
    id: 'dawn_horizon',
    index: 5,
    title: 'Dawn Horizon',
    badge: '[BRANCH: DAWN HORIZON]',
    narrativeTemplate:
      'The doors open at {terminus} onto daylight that shouldn’t reach this platform. Dad squints and says nothing. For once, neither do you.',
    summaryTemplate:
      'Stayed with your parents after holding firm through the restraint, with the conductor on tape and most of yourself intact.',
    primaryButtonLabel: 'Ride again',
    isAlternativeEscape: true,
  },
  exposed: {
    id: 'exposed',
    index: 6,
    title: 'Exposed',
    badge: '[TERMINAL: EXPOSED]',
    narrativeTemplate:
      'You made it to {terminus}. Dad keeps a firm, unyielding grip on your shoulder all the way up the stairs into the street. Nobody says a single word.',
    summaryTemplate: 'Your parents stepped in.',
    primaryButtonLabel: 'Ride again',
    isAlternativeEscape: false,
  },
  disoriented_collapse: {
    id: 'disoriented_collapse',
    index: 7,
    title: 'Disoriented Collapse',
    badge: '[COLLAPSE: DISORIENTED]',
    narrativeTemplate:
      'You made it to {terminus}. Mom doesn’t let go of your sleeve until you’re outside on {street}. You have no memory of the last three stops.',
    summaryTemplate: 'Stepped off at a False Stop.',
    primaryButtonLabel: 'Ride again',
    isAlternativeEscape: false,
  },
  civilian_extraction: {
    id: 'civilian_extraction',
    index: 8,
    title: 'Civilian Extraction',
    badge: '[STANDARD: EXTRACTION]',
    narrativeTemplate:
      'You made it to {terminus}. Your parents push through the turnstiles, already arguing about where to eat in {area}.',
    summaryTemplate: 'An ordinary arrival.',
    primaryButtonLabel: 'Ride again',
    isAlternativeEscape: false,
  },
};

/**
 * Computes "Sanity Retained" (0..100%):
 * "How well you held on, stop by stop: where your sanity sat inside each stop's band, averaged over the ride."
 * Adds +6 restraint bonus when Stop 11 Restraint was held.
 */
export function computeSanityRetainedPercent(params: {
  stopDecisions: readonly StopDecisionRecord[];
  finalSanity: number;
  restraintHeld: boolean;
}): number {
  const { stopDecisions, finalSanity, restraintHeld } = params;
  if (stopDecisions.length === 0) {
    const raw = Math.max(0, Math.min(100, Math.round(finalSanity)));
    return Math.min(100, raw + (restraintHeld ? RESTRAINT_CEILING_RAISE : 0));
  }

  let sumNormalized = 0;
  for (const decision of stopDecisions) {
    const span = Math.max(1, decision.sanityBandMax - decision.sanityBandMin);
    const ratio = (decision.sanityAfter - decision.sanityBandMin) / span;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    sumNormalized += clampedRatio;
  }

  const baseAveragePct = Math.round((sumNormalized / stopDecisions.length) * 100);
  const withBonus = baseAveragePct + (restraintHeld ? RESTRAINT_CEILING_RAISE : 0);
  return Math.max(0, Math.min(100, withBonus));
}

/**
 * Computes "Anomaly Accuracy" (0..100%):
 * "Anomalies you flagged or photographed in time, out of all that appeared."
 */
export function computeAnomalyAccuracyPercent(
  caughtCount: number,
  spawnedCount: number
): number {
  if (spawnedCount <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((caughtCount / spawnedCount) * 100)));
}

export interface EvaluateEndingInput {
  route: RouteLineId;
  selectedExit: ExitChoiceId | null;
  peakSuspicion: number;
  sanityRetainedPercent: number;
  anomalyAccuracyPercent: number;
  tapesCount: number;
  hasConductorOnTape: boolean;
  restraintHeld: boolean;
  falseStopTrialsCount: number;
  interventionsCount: number;
  steppedOffAtBait: boolean;
}

/**
 * Evaluates the 8 canonical v5.3 endings in strict priority order (1 through 8).
 */
export function evaluateRideEnding(input: EvaluateEndingInput): EndingResult {
  const exit: ExitChoiceId = input.selectedExit ?? 'escalators';
  const composureIntact = input.peakSuspicion <= COMPOSURE_INTACT_MAX_SUSPICION;

  let chosenId: EndingId = 'civilian_extraction';

  // Priority 1: The Unbroken Mask — peak Suspicion 0 (when ride wasn't aborted at Stop 12 bait or lost to <30% sanity loop)
  if (
    !input.steppedOffAtBait &&
    input.sanityRetainedPercent >= 30 &&
    input.peakSuspicion === 0
  ) {
    chosenId = 'unbroken_mask';
  }
  // Priority 2: The Eternal Commute — stepped off at 21 St bait (stop 12) OR Sanity Retained < 30%
  else if (input.steppedOffAtBait || input.sanityRetainedPercent < 30) {
    chosenId = 'eternal_commute';
  }
  // Priority 3: Midnight Terminal — lower-level exit, >=2 tapes, anomaly accuracy >=75%, peak Suspicion <=30
  else if (
    exit === 'lower_level' &&
    input.tapesCount >= 2 &&
    input.anomalyAccuracyPercent >= 75 &&
    composureIntact
  ) {
    chosenId = 'midnight_terminal';
  }
  // Priority 4: Skyward Catwalk — surface-hatch exit, restraint held, no False Stop Trials, no interventions
  else if (
    exit === 'surface_hatch' &&
    input.restraintHeld &&
    input.falseStopTrialsCount === 0 &&
    input.interventionsCount === 0
  ) {
    chosenId = 'skyward_catwalk';
  }
  // Priority 5: Dawn Horizon — escalators exit, restraint held, no Trials, conductor tape recorded, Sanity Retained >=60%
  else if (
    exit === 'escalators' &&
    input.restraintHeld &&
    input.falseStopTrialsCount === 0 &&
    input.hasConductorOnTape &&
    input.sanityRetainedPercent >= 60
  ) {
    chosenId = 'dawn_horizon';
  }
  // Priority 6: Exposed — any intervention
  else if (input.interventionsCount > 0) {
    chosenId = 'exposed';
  }
  // Priority 7: Disoriented Collapse — any False Stop Trial
  else if (input.falseStopTrialsCount > 0) {
    chosenId = 'disoriented_collapse';
  }
  // Priority 8: Civilian Extraction — fallback
  else {
    chosenId = 'civilian_extraction';
  }

  return buildEndingResult(chosenId, input.route);
}

export function buildEndingResult(id: EndingId, route: RouteLineId = 'G'): EndingResult {
  const entry = ENDING_CATALOG[id];
  return {
    id: entry.id,
    index: entry.index,
    title: entry.title,
    badge: entry.badge,
    narrativeText: formatRouteText(entry.narrativeTemplate, route),
    summary: formatRouteText(entry.summaryTemplate, route),
    primaryButtonLabel: entry.primaryButtonLabel,
    isAlternativeEscape: entry.isAlternativeEscape,
  };
}

/**
 * Formats the canonical Report Screen door-tell and parent trap explanation for a stop decision.
 */
export function formatStopReportNotes(decision: StopDecisionRecord): {
  stopBadgeLabel: 'Safe Haven' | 'False Stop' | 'Real Stop';
  tellNote: string | null;
  parentNote: string | null;
} {
  const segRule = SEGMENT_TABLE.find((s) => s.id === decision.segmentId);

  const stopBadgeLabel: 'Safe Haven' | 'False Stop' | 'Real Stop' =
    decision.stopType === 'haven'
      ? 'Safe Haven'
      : decision.stopType === 'false' || decision.stopType === 'bait'
        ? 'False Stop'
        : 'Real Stop';

  let tellNote: string | null = null;
  if (decision.doorTell === 'doors_open_early') {
    if (segRule?.paLie) {
      tellNote = 'The tell: the doors opened early, and the announcement lied.';
    } else {
      tellNote = 'The tell: the doors opened early, with no announcement.';
    }
  } else if (decision.doorTell === 'lights_flicker') {
    tellNote = 'The tell: the lights flickered as you pulled in.';
  }

  let parentNote: string | null = null;
  if (decision.segmentId === '6b') {
    parentNote = 'Mom said it was your transfer. She was wrong. The doors weren’t.';
  } else if (decision.stopType === 'bait') {
    parentNote = 'Mom said "This is us." She was wrong. The lights weren’t.';
  }

  return {
    stopBadgeLabel,
    tellNote,
    parentNote,
  };
}

export interface ResolvedEndingArchiveEntry {
  definition: EndingCatalogEntry;
  documented: boolean;
  formattedSummary: string;
}

export function resolveEndingsCatalog(
  archive: ProgressArchive,
  route: RouteLineId = 'G'
): {
  entries: ResolvedEndingArchiveEntry[];
  documentedEndingsCount: number;
} {
  const docSet = new Set(archive.documentedEndings);
  let documentedEndingsCount = 0;

  const entries: ResolvedEndingArchiveEntry[] = ENDING_IDS.map((id) => {
    const def = ENDING_CATALOG[id];
    const documented = docSet.has(id);
    if (documented) documentedEndingsCount += 1;
    return {
      definition: def,
      documented,
      formattedSummary: formatRouteText(def.summaryTemplate, route),
    };
  });

  return {
    entries,
    documentedEndingsCount,
  };
}

