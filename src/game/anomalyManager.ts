import {
  ADS_ACROSS_AISLE,
  ANOMALY_CLOSE_UP_MAX_DIST_M,
  ANOMALY_GAZE_THRESHOLD_8S_RAD,
  ANOMALY_GAZE_THRESHOLD_FINAL_3S_RAD,
  ANOMALY_GAZE_THRESHOLD_INITIAL_RAD,
  CAMERA_FAR,
  CAMERA_FOV_LANDSCAPE,
  CAMERA_NEAR,
  FLAG_HOLD_DURATION_SEC,
  PLAYER_SEAT_X,
  PLAYER_SEAT_Z,
  POLAROID_GAZE_THRESHOLD_RAD,
  POLAROID_MAX_DIST_M,
} from '../constants';
import type {
  ActiveAnomalyInstance,
  AnomalyId,
  SanityTier,
  SegmentRule,
} from '../types';
import {
  createMisprintHeadline,
  DAD_ANSWERING_ANOMALY_LINES,
  formatAnomalyReportDescription,
  PSYCH_IDS,
  PSYCH_LOG_CATALOG,
} from './psychLog';

/**
 * Pure, testable anomaly scheduling, off-gaze manifestation, and 0.7s Flag detection logic.
 */

const SHIFTED_AD_BG_COLORS: readonly string[] = [
  '#3b182e',
  '#193632',
  '#3d2b14',
  '#251b3d',
  '#1d3319',
];

/**
 * Maps SanityTier to 0..3 tier index.
 */
export function sanityTierToIndex(tier: SanityTier): 0 | 1 | 2 | 3 {
  switch (tier) {
    case 'High':
      return 0;
    case 'Medium':
      return 1;
    case 'Low':
      return 2;
    case 'Critical':
      return 3;
  }
}

/**
 * Returns the minimum off-gaze angle (in radians) required for an anomaly to manifest:
 * - > 0.7 rad initially
 * - > 0.35 rad after 8 s into the stretch
 * - > 0.2 rad in the last 3 s of the stretch
 */
export function computeManifestationAngleThreshold(
  stretchElapsedSec: number,
  stretchDurationSec: number
): number {
  const remainingSec = stretchDurationSec - stretchElapsedSec;
  if (remainingSec <= 3.0) {
    return ANOMALY_GAZE_THRESHOLD_FINAL_3S_RAD;
  }
  if (stretchElapsedSec >= 8.0) {
    return ANOMALY_GAZE_THRESHOLD_8S_RAD;
  }
  return ANOMALY_GAZE_THRESHOLD_INITIAL_RAD;
}

/**
 * Computes the 3D angle (in radians) between the player's camera forward direction
 * (yaw = 0, pitch = 0 points along (0, 0, -1)) and the vector from camera to target.
 */
export function computeCameraAngleToTarget(
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  yaw: number,
  pitch: number,
  targetX: number,
  targetY: number,
  targetZ: number
): number {
  const dx = targetX - cameraX;
  const dy = targetY - cameraY;
  const dz = targetZ - cameraZ;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-5) return 0;

  // Camera forward vector for Euler(pitch, yaw, 0, 'YXZ') applied to (0, 0, -1):
  const cosPitch = Math.cos(pitch);
  const fwdX = -Math.sin(yaw) * cosPitch;
  const fwdY = Math.sin(pitch);
  const fwdZ = -Math.cos(yaw) * cosPitch;

  const dot = (dx * fwdX + dy * fwdY + dz * fwdZ) / dist;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  return Math.acos(clampedDot);
}

/**
 * Checks whether an unmanifested anomaly should manifest on this frame:
 * 1. Must only appear while the player is NOT looking at it (angle > threshold).
 * 2. Small, read-up-close ones (typo, warped words, sticker, cold light, color drift, route map)
 *    only happen within 5 m of your seat (and within 5 m of the player).
 */
export function shouldAnomalyManifest(params: {
  anomaly: ActiveAnomalyInstance;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  yaw: number;
  pitch: number;
  stretchElapsedSec: number;
  stretchDurationSec: number;
}): boolean {
  const {
    anomaly,
    cameraX,
    cameraY,
    cameraZ,
    yaw,
    pitch,
    stretchElapsedSec,
    stretchDurationSec,
  } = params;

  if (anomaly.manifested) return false;

  if (anomaly.closeUpRead) {
    const distFromSeat = Math.hypot(
      anomaly.targetX - PLAYER_SEAT_X,
      anomaly.targetZ - PLAYER_SEAT_Z
    );
    const distFromPlayer = Math.hypot(
      anomaly.targetX - cameraX,
      anomaly.targetZ - cameraZ
    );
    if (
      distFromSeat > ANOMALY_CLOSE_UP_MAX_DIST_M ||
      distFromPlayer > ANOMALY_CLOSE_UP_MAX_DIST_M
    ) {
      return false;
    }
  }

  const thresholdRad = computeManifestationAngleThreshold(
    stretchElapsedSec,
    stretchDurationSec
  );
  const angleRad = computeCameraAngleToTarget(
    cameraX,
    cameraY,
    cameraZ,
    yaw,
    pitch,
    anomaly.targetX,
    anomaly.targetY,
    anomaly.targetZ
  );

  return angleRad > thresholdRad;
}

/**
 * Checks whether a 3D world point lies inside the player's camera frustum.
 */
export function isPointInsideCameraFrustum(
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  yaw: number,
  pitch: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  aspect = 16 / 9
): boolean {
  const dx = targetX - cameraX;
  const dy = targetY - cameraY;
  const dz = targetZ - cameraZ;

  // Inverse yaw (-yaw around Y), then inverse pitch (-pitch around X) for YXZ Euler
  const cosY = Math.cos(-yaw);
  const sinY = Math.sin(-yaw);
  const rx = dx * cosY + dz * sinY;
  const ry = dy;
  const rz = -dx * sinY + dz * cosY;

  const cosP = Math.cos(-pitch);
  const sinP = Math.sin(-pitch);
  const camX = rx;
  const camY = ry * cosP - rz * sinP;
  const camZ = ry * sinP + rz * cosP;

  const depth = -camZ;
  if (depth < CAMERA_NEAR || depth > CAMERA_FAR) {
    return false;
  }

  const tanHalfV = Math.tan((CAMERA_FOV_LANDSCAPE * Math.PI) / 360);
  const tanHalfH = tanHalfV * Math.max(1, aspect);
  const ndcX = camX / (depth * tanHalfH);
  const ndcY = camY / (depth * tanHalfV);

  return Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1;
}

/**
 * Checks whether an active manifested anomaly is framed for a Polaroid shot:
 * - Full-screen/lighting anomalies with no object ('empty_car', 'cold_panel') are framed by any shot.
 * - Object anomalies are framed if within 18 m, under 0.65 rad from view center, and inside the camera frustum.
 */
export function isAnomalyFramed(
  anomaly: ActiveAnomalyInstance | null,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  yaw: number,
  pitch: number,
  maxAngleRad = POLAROID_GAZE_THRESHOLD_RAD
): boolean {
  if (!anomaly || !anomaly.manifested) {
    return false;
  }

  // Full-screen / lighting anomalies with no object are framed by any shot
  if (anomaly.id === 'empty_car' || anomaly.id === 'cold_panel') {
    return true;
  }

  const dist = Math.hypot(
    anomaly.targetX - cameraX,
    anomaly.targetY - cameraY,
    anomaly.targetZ - cameraZ
  );
  if (dist > POLAROID_MAX_DIST_M) {
    return false;
  }

  const angleRad = computeCameraAngleToTarget(
    cameraX,
    cameraY,
    cameraZ,
    yaw,
    pitch,
    anomaly.targetX,
    anomaly.targetY,
    anomaly.targetZ
  );
  if (angleRad >= maxAngleRad) {
    return false;
  }

  return isPointInsideCameraFrustum(
    cameraX,
    cameraY,
    cameraZ,
    yaw,
    pitch,
    anomaly.targetX,
    anomaly.targetY,
    anomaly.targetZ
  );
}

/**
 * Checks whether the player is currently looking at a manifested anomaly
 * (used for 0.7 s Flag catching and staring-while-watched suspicion).
 */
export function isLookingAtAnomaly(
  anomaly: ActiveAnomalyInstance | null,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  yaw: number,
  pitch: number,
  maxAngleRad = POLAROID_GAZE_THRESHOLD_RAD
): boolean {
  if (!anomaly || !anomaly.manifested || anomaly.caught) {
    return false;
  }

  // "The Empty Car" encompasses the entire car interior
  if (anomaly.id === 'empty_car') {
    return Math.abs(pitch) < 0.68 && Math.abs(cameraX) < 8.5;
  }

  const dist = Math.hypot(anomaly.targetX - cameraX, anomaly.targetZ - cameraZ);
  if (anomaly.closeUpRead && dist > ANOMALY_CLOSE_UP_MAX_DIST_M + 0.5) {
    return false;
  }
  if (dist > POLAROID_MAX_DIST_M) {
    return false;
  }

  const angleRad = computeCameraAngleToTarget(
    cameraX,
    cameraY,
    cameraZ,
    yaw,
    pitch,
    anomaly.targetX,
    anomaly.targetY,
    anomaly.targetZ
  );

  return (
    angleRad < maxAngleRad &&
    isPointInsideCameraFrustum(
      cameraX,
      cameraY,
      cameraZ,
      yaw,
      pitch,
      anomaly.targetX,
      anomaly.targetY,
      anomaly.targetZ
    )
  );
}

/**
 * Selects which anomaly ID to schedule for a given ride stretch:
 * - Returns null if segmentRule.anomaliesCount === 0.
 * - Enforces forced categories:
 *   - 'route_map_error' -> 'route_map_error' (Stop 6b)
 *   - 'parent' -> 'mom_fixed' or 'dad_answering' (Stop 10)
 *   - 'critical' -> Class IV ('mom_fixed', 'dad_answering', 'empty_car') (Stop 12)
 * - Otherwise draws 70% from the current sanity tier's pool, 30% from a lower tier's pool.
 * - Critical (tier 3 / Class IV) anomalies cannot appear before Stop 10 unless forced.
 */
export function selectAnomalyIdForStretch(params: {
  segmentRule: SegmentRule;
  sanityTier: SanityTier;
  alreadyUsedIds?: readonly AnomalyId[];
  randomFn?: () => number;
}): AnomalyId | null {
  const {
    segmentRule,
    sanityTier,
    alreadyUsedIds = [],
    randomFn = Math.random,
  } = params;

  const usedSet = new Set(alreadyUsedIds);

  const pickFromPool = (pool: readonly AnomalyId[]): AnomalyId => {
    const unused = pool.filter((id) => !usedSet.has(id));
    const activePool = unused.length > 0 ? unused : pool;
    const idx = Math.min(
      activePool.length - 1,
      Math.floor(randomFn() * activePool.length)
    );
    return activePool[idx] ?? 'misprint';
  };

  if (segmentRule.forcedAnomalyCategory === 'route_map_error') {
    return 'route_map_error';
  }

  if (segmentRule.forcedAnomalyCategory === 'parent') {
    return pickFromPool(['mom_fixed', 'dad_answering']);
  }

  if (segmentRule.forcedAnomalyCategory === 'critical') {
    return pickFromPool(['mom_fixed', 'dad_answering', 'empty_car']);
  }

  if (segmentRule.anomaliesCount <= 0) {
    return null;
  }

  let maxAllowedTier = sanityTierToIndex(sanityTier);
  // Critical (tier 3) anomalies cannot appear before Stop 10 unless forced
  if (segmentRule.stopNumber < 10 && maxAllowedTier >= 3) {
    maxAllowedTier = 2;
  }

  const useCurrentTier = maxAllowedTier === 0 || randomFn() < 0.7;
  const chosenTier: 0 | 1 | 2 | 3 = useCurrentTier
    ? (maxAllowedTier as 0 | 1 | 2 | 3)
    : (Math.floor(randomFn() * maxAllowedTier) as 0 | 1 | 2 | 3);

  const tierPool = PSYCH_IDS.filter(
    (id) => PSYCH_LOG_CATALOG[id].tierIndex === chosenTier
  );

  return pickFromPool(tierPool.length > 0 ? tierPool : ['misprint']);
}

/**
 * Builds a complete ActiveAnomalyInstance with 3D target coordinates (< 5 m from seat for close-up ones)
 * and canonical report description.
 */
export function buildActiveAnomalyInstance(
  id: AnomalyId,
  randomFn: () => number = Math.random
): ActiveAnomalyInstance {
  const def = PSYCH_LOG_CATALOG[id];

  // Across-the-aisle ads in Car B sit at x in [-3.2, 0, 3.2], y = 2.15, z = -1.405 (all < 4.1 m from seat)
  const closeAdSlots: ReadonlyArray<{ meshSlotIndex: number; worldX: number }> = [
    { meshSlotIndex: 1, worldX: -3.2 },
    { meshSlotIndex: 2, worldX: 0 },
    { meshSlotIndex: 3, worldX: 3.2 },
  ];
  const chosenAdSlot =
    closeAdSlots[Math.floor(randomFn() * closeAdSlots.length)] ?? closeAdSlots[1]!;
  const chosenAd =
    ADS_ACROSS_AISLE[chosenAdSlot.meshSlotIndex % ADS_ACROSS_AISLE.length] ??
    ADS_ACROSS_AISLE[0]!;

  switch (id) {
    case 'misprint': {
      const swapped = createMisprintHeadline(chosenAd.headline);
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: chosenAdSlot.worldX,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: `ad_${chosenAdSlot.meshSlotIndex}`,
        adIndex: chosenAdSlot.meshSlotIndex,
        adSwappedHeadline: swapped,
        reportDescription: formatAnomalyReportDescription({
          id: 'misprint',
          adHeadline: chosenAd.headline,
          adSwappedHeadline: swapped,
        }),
      };
    }

    case 'window_residue': {
      const variant: 'sticker' | 'stain' = randomFn() < 0.5 ? 'sticker' : 'stain';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: -0.95,
        targetY: 1.44,
        targetZ: -1.41,
        manifested: false,
        caught: false,
        variantKey: variant,
        reportDescription: formatAnomalyReportDescription({
          id: 'window_residue',
          windowResidueVariant: variant,
        }),
      };
    }

    case 'cold_panel': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: -2.1,
        targetY: 2.38,
        targetZ: -0.96,
        manifested: false,
        caught: false,
        variantKey: 'cold_blue',
        reportDescription: formatAnomalyReportDescription({ id: 'cold_panel' }),
      };
    }

    case 'man_across_aisle': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -0.38,
        targetY: 1.16,
        targetZ: -1.08,
        manifested: false,
        caught: false,
        variantKey: 'staring',
        reportDescription: formatAnomalyReportDescription({ id: 'man_across_aisle' }),
      };
    }

    case 'route_map_error': {
      const variant: 'hollow_st' | 'wrong_color' =
        randomFn() < 0.65 ? 'hollow_st' : 'wrong_color';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: -1.6,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: variant,
        reportDescription: formatAnomalyReportDescription({
          id: 'route_map_error',
          routeMapVariant: variant,
        }),
      };
    }

    case 'color_drift': {
      const shiftedBg =
        SHIFTED_AD_BG_COLORS[
          Math.floor(randomFn() * SHIFTED_AD_BG_COLORS.length)
        ] ?? '#3b182e';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: chosenAdSlot.worldX,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: `color_${chosenAdSlot.meshSlotIndex}`,
        adIndex: chosenAdSlot.meshSlotIndex,
        adShiftedBgColor: shiftedBg,
        reportDescription: formatAnomalyReportDescription({
          id: 'color_drift',
          adHeadline: chosenAd.headline,
        }),
      };
    }

    case 'relocated_passenger': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -5.0,
        targetY: 1.35,
        targetZ: -0.82,
        manifested: false,
        caught: false,
        variantKey: 'far_doors',
        reportDescription: formatAnomalyReportDescription({
          id: 'relocated_passenger',
        }),
      };
    }

    case 'additional_passenger': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -4.05,
        targetY: 1.16,
        targetZ: -1.08,
        manifested: false,
        caught: false,
        variantKey: 'far_seat',
        reportDescription: formatAnomalyReportDescription({
          id: 'additional_passenger',
        }),
      };
    }

    case 'warped_copy': {
      const warped = chosenAd.warpedHeadline ?? 'GREENPOINT SAVES US';
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: true,
        targetX: chosenAdSlot.worldX,
        targetY: 2.15,
        targetZ: -1.4,
        manifested: false,
        caught: false,
        variantKey: `warp_${chosenAdSlot.meshSlotIndex}`,
        adIndex: chosenAdSlot.meshSlotIndex,
        adSwappedHeadline: warped,
        reportDescription: formatAnomalyReportDescription({
          id: 'warped_copy',
          adHeadline: chosenAd.headline,
          adWarpedHeadline: warped,
        }),
      };
    }

    case 'woman_on_bench': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -1.65,
        targetY: 1.16,
        targetZ: 1.08,
        manifested: false,
        caught: false,
        variantKey: 'neck_twist',
        reportDescription: formatAnomalyReportDescription({ id: 'woman_on_bench' }),
      };
    }

    case 'mom_fixed': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -0.76,
        targetY: 1.16,
        targetZ: 1.08,
        manifested: false,
        caught: false,
        variantKey: 'dilated_eyes',
        reportDescription: formatAnomalyReportDescription({ id: 'mom_fixed' }),
      };
    }

    case 'dad_answering': {
      const dadLine =
        DAD_ANSWERING_ANOMALY_LINES[
          Math.floor(randomFn() * DAD_ANSWERING_ANOMALY_LINES.length)
        ] ?? DAD_ANSWERING_ANOMALY_LINES[0]!;
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: 0.76,
        targetY: 1.16,
        targetZ: 1.08,
        manifested: false,
        caught: false,
        variantKey: 'unspoken_reply',
        dadLine,
        reportDescription: formatAnomalyReportDescription({
          id: 'dad_answering',
          dadLine,
        }),
      };
    }

    case 'empty_car': {
      return {
        id,
        title: def.title,
        psychClass: def.psychClass,
        tierIndex: def.tierIndex,
        caseFileNote: def.caseFileNote,
        closeUpRead: false,
        targetX: -0.38,
        targetY: 1.16,
        targetZ: -1.08,
        manifested: false,
        caught: false,
        variantKey: 'vanished',
        reportDescription: formatAnomalyReportDescription({ id: 'empty_car' }),
      };
    }
  }
}

/**
 * Steps the 0.7 s Flag hold progress.
 */
export function stepFlagHoldProgress(params: {
  isHolding: boolean;
  currentProgress: number;
  dtSec: number;
  lookingAtActiveAnomaly: boolean;
}): {
  nextProgress: number;
  completedCatch: boolean;
  completedFalseFlag: boolean;
} {
  const { isHolding, currentProgress, dtSec, lookingAtActiveAnomaly } = params;

  if (!isHolding) {
    const decayed = Math.max(0, currentProgress - dtSec * 3.0);
    return {
      nextProgress: decayed,
      completedCatch: false,
      completedFalseFlag: false,
    };
  }

  const next = Math.min(1, currentProgress + dtSec / FLAG_HOLD_DURATION_SEC);
  if (next >= 1) {
    return {
      nextProgress: 0,
      completedCatch: lookingAtActiveAnomaly,
      completedFalseFlag: !lookingAtActiveAnomaly,
    };
  }

  return {
    nextProgress: next,
    completedCatch: false,
    completedFalseFlag: false,
  };
}
