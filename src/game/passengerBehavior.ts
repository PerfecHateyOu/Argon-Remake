import {
  HEAD_WHIP_MOUSE_RAD_S,
  HEAD_WHIP_TOUCH_MIN_TURN_RAD,
  HEAD_WHIP_TOUCH_RAD_S,
  SANITY_DELTAS,
  SUSPICION_DELTAS,
  SUSPICION_INTERVENTION_RESET,
  SUSPICION_INTERVENTION_THRESHOLD,
} from '../constants';
import type { ParentSpeakerId } from '../types';

export interface HeadWhipInput {
  angularSpeedRadS: number;
  cumulativeTouchTurnRad: number;
  isTouchDrag: boolean;
  watchingParentLabel: 'Mom' | 'Dad' | null;
  cooldownRemainingSec: number;
}

export interface HeadWhipResult {
  triggered: boolean;
  reason: string | null;
  suspicionDelta: number;
  nextCooldownSec: number;
}

/**
 * Pure helper evaluating whether the player's camera angular velocity triggers a head-whip reaction
 * while a parent is watching.
 * - Mouse/Keyboard: > 5.5 rad/s
 * - Touch drag: > 8.0 rad/s over at least 75 deg cumulative turn
 */
export function evaluateHeadWhipReaction(input: HeadWhipInput): HeadWhipResult {
  if (!input.watchingParentLabel || input.cooldownRemainingSec > 0) {
    return {
      triggered: false,
      reason: null,
      suspicionDelta: 0,
      nextCooldownSec: Math.max(0, input.cooldownRemainingSec),
    };
  }

  const exceededThreshold = input.isTouchDrag
    ? input.angularSpeedRadS > HEAD_WHIP_TOUCH_RAD_S &&
      input.cumulativeTouchTurnRad >= HEAD_WHIP_TOUCH_MIN_TURN_RAD
    : input.angularSpeedRadS > HEAD_WHIP_MOUSE_RAD_S;

  if (!exceededThreshold) {
    return {
      triggered: false,
      reason: null,
      suspicionDelta: 0,
      nextCooldownSec: 0,
    };
  }

  return {
    triggered: true,
    reason: `Snapped your head around while ${input.watchingParentLabel} was watching`,
    suspicionDelta: SUSPICION_DELTAS.VISIBLE_REACTION,
    nextCooldownSec: 1.8,
  };
}

export interface InterventionCheckResult {
  intervened: boolean;
  nextSuspicion: number;
  sanityDelta: number;
  eventLabel: string | null;
}

/**
 * Pure helper checking whether Suspicion has reached 60 (Concerned Intervention).
 * Resets suspicion to 40 and drops Sanity by -5.
 */
export function evaluateSuspicionIntervention(suspicion: number): InterventionCheckResult {
  if (suspicion >= SUSPICION_INTERVENTION_THRESHOLD) {
    return {
      intervened: true,
      nextSuspicion: SUSPICION_INTERVENTION_RESET,
      sanityDelta: SANITY_DELTAS.INTERVENTION,
      eventLabel: 'Concerned Intervention (suspicion reset to 40)',
    };
  }
  return {
    intervened: false,
    nextSuspicion: Math.max(0, Math.round(suspicion)),
    sanityDelta: 0,
    eventLabel: null,
  };
}

/**
 * Computes target head yaw/pitch (in local character space) for Mom and Dad
 * so their heads turn smoothly toward the player when watching or speaking.
 */
export function computeParentTargetHeadAngles(
  parentId: ParentSpeakerId,
  parentWorldX: number,
  parentWorldZ: number,
  playerWorldX: number,
  playerWorldZ: number,
  isWatchingPlayer: boolean
): { yaw: number; pitch: number } {
  if (!isWatchingPlayer) {
    return { yaw: 0, pitch: 0 };
  }

  // Parents sit on the +Z bench facing -Z (base forward vector is (0, 0, -1))
  const dx = playerWorldX - parentWorldX;
  const dz = playerWorldZ - parentWorldZ;
  // Angle relative to -Z forward direction: atan2(-dx, -dz)
  const rawYaw = Math.atan2(-dx, Math.max(0.18, -dz));
  const clampedYaw = Math.max(-1.25, Math.min(1.25, rawYaw));
  const pitch = parentId === 'mom' ? 0.04 : 0.02;

  return {
    yaw: clampedYaw,
    pitch,
  };
}
