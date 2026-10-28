import type {
  AnomalyId,
  EvidenceStatusChip,
  ProgressArchive,
  PsychClass,
  RideAnomalyRecord,
} from '../types';

/**
 * Canonical v5.3 Psych Log (Case Files -> Anomalies) catalog.
 * Every title, Case File note, and report description matches the story bible word for word.
 */

export interface PsychLogEntryDefinition {
  id: AnomalyId;
  index: number; // 1..13
  title: string;
  psychClass: PsychClass;
  tierIndex: 0 | 1 | 2 | 3; // 0 = High (I), 1 = Medium (II), 2 = Low (III), 3 = Critical (IV)
  caseFileNote: string;
  closeUpRead: boolean;
}

export const PSYCH_IDS: readonly AnomalyId[] = [
  'misprint',
  'window_residue',
  'cold_panel',
  'man_across_aisle',
  'route_map_error',
  'color_drift',
  'relocated_passenger',
  'additional_passenger',
  'warped_copy',
  'woman_on_bench',
  'mom_fixed',
  'dad_answering',
  'empty_car',
] as const;

export const PSYCH_LOG_CATALOG: Record<AnomalyId, PsychLogEntryDefinition> = {
  misprint: {
    id: 'misprint',
    index: 1,
    title: 'The Misprint',
    psychClass: 'I',
    tierIndex: 0,
    caseFileNote:
      'One letter in an overhead ad changed while you weren’t looking. Small enough to doubt.',
    closeUpRead: true,
  },
  window_residue: {
    id: 'window_residue',
    index: 2,
    title: 'Window Residue',
    psychClass: 'I',
    tierIndex: 0,
    caseFileNote: 'Something appeared on the glass between stops. Nobody saw it get there.',
    closeUpRead: true,
  },
  cold_panel: {
    id: 'cold_panel',
    index: 3,
    title: 'The Cold Panel',
    psychClass: 'I',
    tierIndex: 0,
    caseFileNote:
      'One ceiling tube turned a hospital blue. It lit the same car. It didn’t feel like the same car.',
    closeUpRead: true,
  },
  man_across_aisle: {
    id: 'man_across_aisle',
    index: 4,
    title: 'The Man Across the Aisle',
    psychClass: 'I',
    tierIndex: 0,
    caseFileNote: 'He stopped blinking. He didn’t look away when you did.',
    closeUpRead: false,
  },
  route_map_error: {
    id: 'route_map_error',
    index: 5,
    title: 'Route Map Error',
    psychClass: 'II',
    tierIndex: 1,
    caseFileNote:
      'The strip map disagreed with itself. Sometimes it lists Hollow St. There is no Hollow St.',
    closeUpRead: true,
  },
  color_drift: {
    id: 'color_drift',
    index: 6,
    title: 'Color Drift',
    psychClass: 'II',
    tierIndex: 1,
    caseFileNote:
      'An ad’s background changed between glances. The words stayed exactly where they were.',
    closeUpRead: true,
  },
  relocated_passenger: {
    id: 'relocated_passenger',
    index: 7,
    title: 'The Relocated Passenger',
    psychClass: 'II',
    tierIndex: 1,
    caseFileNote:
      'A standing passenger was at the far doors without crossing the car. No one saw them walk.',
    closeUpRead: false,
  },
  additional_passenger: {
    id: 'additional_passenger',
    index: 8,
    title: 'The Additional Passenger',
    psychClass: 'II',
    tierIndex: 1,
    caseFileNote:
      'A silent rider sat at the far end. They didn’t board at any stop you remember.',
    closeUpRead: false,
  },
  warped_copy: {
    id: 'warped_copy',
    index: 9,
    title: 'Warped Copy',
    psychClass: 'III',
    tierIndex: 2,
    caseFileNote: 'An ad rearranged itself into words that were meant for you.',
    closeUpRead: true,
  },
  woman_on_bench: {
    id: 'woman_on_bench',
    index: 10,
    title: 'The Woman on Your Bench',
    psychClass: 'III',
    tierIndex: 2,
    caseFileNote:
      'Her head turned further than a neck allows. She wanted to see your reaction.',
    closeUpRead: false,
  },
  mom_fixed: {
    id: 'mom_fixed',
    index: 11,
    title: 'Mom, Fixed',
    psychClass: 'IV',
    tierIndex: 3,
    caseFileNote:
      'Her face set into an expression that wasn’t hers, pupils wide. She kept talking as if nothing had changed.',
    closeUpRead: false,
  },
  dad_answering: {
    id: 'dad_answering',
    index: 12,
    title: 'Dad, Answering',
    psychClass: 'IV',
    tierIndex: 3,
    caseFileNote: 'He replied to something you only thought.',
    closeUpRead: false,
  },
  empty_car: {
    id: 'empty_car',
    index: 13,
    title: 'The Empty Car',
    psychClass: 'IV',
    tierIndex: 3,
    caseFileNote: 'Every stranger was gone at once. Your parents didn’t mention it.',
    closeUpRead: false,
  },
};

/**
 * Canonical single-letter swap pairs for "The Misprint":
 * E↔F, O↔Q, N↔M, C↔G, I↔L, R↔P
 */
const MISPRINT_SWAP_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['E', 'F'],
  ['O', 'Q'],
  ['N', 'M'],
  ['C', 'G'],
  ['I', 'L'],
  ['R', 'P'],
];

/**
 * Swaps a single uppercase letter in an ad headline using the canonical letter swap pairs.
 */
export function createMisprintHeadline(headline: string): string {
  for (const [a, b] of MISPRINT_SWAP_PAIRS) {
    const idxA = headline.indexOf(a);
    if (idxA >= 0) {
      return headline.slice(0, idxA) + b + headline.slice(idxA + 1);
    }
    const idxB = headline.indexOf(b);
    if (idxB >= 0) {
      return headline.slice(0, idxB) + a + headline.slice(idxB + 1);
    }
  }
  return `${headline.slice(0, -1)}F`;
}

/**
 * Canonical Dad unspoken thought answers for Anomaly #12 ("Dad, Answering").
 */
export const DAD_ANSWERING_ANOMALY_LINES: readonly string[] = [
  'No, I didn’t hear it either.',
  'Because you didn’t ask.',
  'Two more. Don’t count them.',
];

/**
 * Formats the verbatim report description for any of the 13 canonical anomalies.
 */
export function formatAnomalyReportDescription(params: {
  id: AnomalyId;
  adHeadline?: string;
  adSwappedHeadline?: string;
  adWarpedHeadline?: string;
  windowResidueVariant?: 'sticker' | 'stain';
  routeMapVariant?: 'hollow_st' | 'wrong_color';
  dadLine?: string;
}): string {
  switch (params.id) {
    case 'misprint': {
      const ad = params.adHeadline ?? 'GREENPOINT SAVINGS';
      const swapped = params.adSwappedHeadline ?? createMisprintHeadline(ad);
      return `The ${ad} ad had a typo: "${swapped}"`;
    }
    case 'window_residue':
      return params.windowResidueVariant === 'stain'
        ? 'A grimy liquid drip stain formed on a window'
        : 'A bright yellow smiley sticker appeared on a window';
    case 'cold_panel':
      return 'One ceiling fluorescent light turned cold sterile blue';
    case 'man_across_aisle':
      return 'The man sitting across the aisle stared directly at you without blinking';
    case 'route_map_error':
      return params.routeMapVariant === 'wrong_color'
        ? 'The G train line on the route map shifted to the wrong color'
        : 'The route map showed an impossible station: "Hollow St"';
    case 'color_drift': {
      const ad = params.adHeadline ?? 'GREENPOINT SAVINGS';
      return `The ${ad} advertisement shifted its background color`;
    }
    case 'relocated_passenger':
      return 'The standing passenger was abruptly standing at the far doors';
    case 'additional_passenger':
      return 'An unrecognized silent passenger was suddenly seated at the far end';
    case 'warped_copy': {
      const ad = params.adHeadline ?? 'GREENPOINT SAVINGS';
      const warp = params.adWarpedHeadline ?? 'GREENPOINT SAVES US';
      return `The ${ad} ad warped into disturbing words: "${warp}"`;
    }
    case 'woman_on_bench':
      return 'The woman on your bench twisted her neck beyond anatomical limits to look at you';
    case 'mom_fixed':
      return 'Mom’s face froze into an uncanny expression with unnervingly dilated eyes';
    case 'dad_answering': {
      const line = params.dadLine ?? DAD_ANSWERING_ANOMALY_LINES[0];
      return `Dad answered an unspoken thought aloud: "${line}"`;
    }
    case 'empty_car':
      return 'Every single stranger vanished; the train car was completely empty';
  }
}

export interface PsychLogResolvedEntry {
  definition: PsychLogEntryDefinition;
  status: EvidenceStatusChip; // 'DOCUMENTED' | 'UNCONFIRMED' | 'NOTHING'
  caughtThisRide: boolean;
  seenThisRide: boolean;
}

export function resolvePsychLogCatalog(
  archive: ProgressArchive,
  rideAnomalies: readonly RideAnomalyRecord[] = []
): {
  entries: PsychLogResolvedEntry[];
  documentedCount: number;
  unconfirmedCount: number;
} {
  const documentedSet = new Set(archive.documentedAnomalies);
  const unconfirmedSet = new Set(archive.unconfirmedAnomalies);

  for (const r of rideAnomalies) {
    if (r.caught) {
      documentedSet.add(r.id);
    } else {
      unconfirmedSet.add(r.id);
    }
  }

  let documentedCount = 0;
  let unconfirmedCount = 0;

  const entries: PsychLogResolvedEntry[] = PSYCH_IDS.map((id) => {
    const def = PSYCH_LOG_CATALOG[id];
    const isDoc = documentedSet.has(id);
    const isUnconf = !isDoc && unconfirmedSet.has(id);
    if (isDoc) documentedCount += 1;
    if (isUnconf) unconfirmedCount += 1;

    const status: EvidenceStatusChip = isDoc
      ? 'DOCUMENTED'
      : isUnconf
        ? 'UNCONFIRMED'
        : 'NOTHING';

    const caughtThisRide = rideAnomalies.some((r) => r.id === id && r.caught);
    const seenThisRide = rideAnomalies.some((r) => r.id === id);

    return {
      definition: def,
      status,
      caughtThisRide,
      seenThisRide,
    };
  });

  return {
    entries,
    documentedCount,
    unconfirmedCount,
  };
}
