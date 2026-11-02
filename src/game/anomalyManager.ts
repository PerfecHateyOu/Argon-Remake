import {
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
import { buildActiveAnomalyInstance } from './anomalyBuilder';
import {
  PSYCH_IDS,
  PSYCH_LOG_CATALOG,
} from './psychLog';

export { buildActiveAnomalyInstance };

/**
 * Pure, testable anomaly scheduling, off-gaze manifestation, and 0.7s Flag detection logic.
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

  const cosPitch = Math.cos(pitch);
  const fwdX = -Math.sin(yaw) * cosPitch;
  const fwdY = Math.sin(pitch);
  const fwdZ = -Math.cos(yaw) * cosPitch;

  const dot = (dx * fwdX + dy * fwdY + dz * fwdZ) / dist;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  return Math.acos(clampedDot);
}

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
