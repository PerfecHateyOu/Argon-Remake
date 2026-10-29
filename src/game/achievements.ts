import type {
  AchievementDefinition,
  AchievementId,
  EndingResult,
  EvpTapeRecord,
  PolaroidPhotoRecord,
  ProgressArchive,
  RideAnomalyRecord,
} from '../types';

export const ACHIEVEMENT_IDS: readonly AchievementId[] = [
  'first_contact',
  'silver_halide_evidence',
  'signal_hunter',
  'phantom_broadcaster',
  'the_unbroken_mask',
  'night_watch',
  'loop_breaker',
  'chief_archivist',
] as const;

export const ACHIEVEMENT_CATALOG: Record<AchievementId, AchievementDefinition> = {
  first_contact: {
    id: 'first_contact',
    name: 'First Contact',
    description: 'Catch your first anomaly with a flag or Polaroid photo.',
  },
  silver_halide_evidence: {
    id: 'silver_halide_evidence',
    name: 'Silver Halide Evidence',
    description: 'Successfully photograph an active car anomaly with the Polaroid 600.',
  },
  signal_hunter: {
    id: 'signal_hunter',
    name: 'Signal Hunter',
    description: 'Record at least 3 distinct radio signals on the microcassette recorder.',
  },
  phantom_broadcaster: {
    id: 'phantom_broadcaster',
    name: 'Phantom Broadcaster',
    description: 'Discover and record a secret station broadcaster frequency.',
  },
  the_unbroken_mask: {
    id: 'the_unbroken_mask',
    name: 'The Unbroken Mask',
    description: 'Complete a full ride with 0 peak suspicion from your parents.',
  },
  night_watch: {
    id: 'night_watch',
    name: 'Night Watch',
    description: 'Witness the Newtown Creek trestle crossing into the night sky.',
  },
  loop_breaker: {
    id: 'loop_breaker',
    name: 'Loop Breaker',
    description: 'Unlock any alternative escape ending beyond standard Civilian Extraction.',
  },
  chief_archivist: {
    id: 'chief_archivist',
    name: 'Chief Archivist',
    description: 'Catalog and document at least 6 distinct anomaly types in your case files.',
  },
};

export interface EvaluateAchievementsInput {
  existingUnlockedIds: readonly string[];
  documentedAnomaliesCount: number;
  anomaliesCaughtCount: number;
  rideAnomalies: readonly RideAnomalyRecord[];
  photos: readonly PolaroidPhotoRecord[];
  tapes: readonly EvpTapeRecord[];
  hasSecretBroadcasterEvp: boolean;
  trestleWitnessed: boolean;
  rideCompleted: boolean;
  steppedOffAtBait: boolean;
  peakSuspicion: number;
  resolvedEnding: EndingResult | null;
}

/**
 * Evaluates which of the 8 canonical achievements are satisfied and returns the merged list of unlocked achievement IDs.
 */
export function evaluateUnlockedAchievements(input: EvaluateAchievementsInput): string[] {
  const unlocked = new Set<string>(input.existingUnlockedIds);

  if (input.anomaliesCaughtCount >= 1 || input.documentedAnomaliesCount >= 1) {
    unlocked.add('first_contact');
  }

  const caughtByPhoto =
    input.photos.some((p) => p.anomalyId !== null) ||
    input.rideAnomalies.some((a) => a.caught && Boolean(a.caughtByPhoto));
  if (caughtByPhoto) {
    unlocked.add('silver_halide_evidence');
  }

  const distinctRadioSignals = new Set(input.tapes.map((t) => t.id));
  if (distinctRadioSignals.size >= 3) {
    unlocked.add('signal_hunter');
  }

  if (
    input.hasSecretBroadcasterEvp ||
    input.tapes.some((t) => t.isSecretBroadcaster)
  ) {
    unlocked.add('phantom_broadcaster');
  }

  if (
    input.rideCompleted &&
    !input.steppedOffAtBait &&
    input.peakSuspicion === 0
  ) {
    unlocked.add('the_unbroken_mask');
  }

  if (input.trestleWitnessed) {
    unlocked.add('night_watch');
  }

  if (input.rideCompleted && input.resolvedEnding?.isAlternativeEscape) {
    unlocked.add('loop_breaker');
  }

  if (input.documentedAnomaliesCount >= 6) {
    unlocked.add('chief_archivist');
  }

  return ACHIEVEMENT_IDS.filter((id) => unlocked.has(id));
}

export interface ResolvedAchievementEntry {
  definition: AchievementDefinition;
  unlocked: boolean;
}

export function resolveAchievementsCatalog(archive: ProgressArchive): {
  entries: ResolvedAchievementEntry[];
  unlockedCount: number;
} {
  const unlockedSet = new Set(archive.unlockedAchievements);
  let unlockedCount = 0;

  const entries: ResolvedAchievementEntry[] = ACHIEVEMENT_IDS.map((id) => {
    const def = ACHIEVEMENT_CATALOG[id];
    const unlocked = unlockedSet.has(id);
    if (unlocked) unlockedCount += 1;
    return {
      definition: def,
      unlocked,
    };
  });

  return {
    entries,
    unlockedCount,
  };
}

