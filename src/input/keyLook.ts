import {
  CAR_HALF_LENGTH,
  GANGWAY_CENTERS_X,
  GANGWAY_DOOR_TRIGGER_DIST_X,
  KEY_PITCH_SPEED_RAD,
  KEY_YAW_SPEED_RAD,
  MOUSE_SENSITIVITY_RAD_PER_PX,
  PITCH_MAX_RAD,
  PITCH_MIN_RAD,
  PLAYER_EYE_HEIGHT_SEATED,
  PLAYER_EYE_HEIGHT_STANDING,
  PLAYER_SEAT_X,
  PLAYER_SEAT_Z,
  TOUCH_LOOK_SENSITIVITY_RAD_PER_PX,
  TRIAL_YAW_LIMIT_RAD,
  WALK_CAR_HALF_Z,
  WALK_GANGWAY_HALF_Z,
  WALK_MAX_X,
  WALK_MIN_X,
  WALK_SMOOTH_ACCEL,
  WALK_SMOOTH_DECEL,
  WALK_SPEED_MPS,
} from '../constants';
import { settingsStore } from '../settings';
import type { ConsistLocationLabel, GamePhase } from '../types';
import { pointerLock } from './pointerLock';

/**
 * Pure helper determining which car or gangway coupling the player is currently inside.
 * Car A (lead, x ≈ -19.5), Car B (mid, x ≈ 0), Car C (rear, x ≈ +19.5).
 */
export function resolveConsistLocation(x: number): ConsistLocationLabel {
  if (x < -10.7) return 'CAR A (LEAD)';
  if (x <= -CAR_HALF_LENGTH) return 'GANGWAY COUPLING';
  if (x < CAR_HALF_LENGTH) return 'CAR B (MID)';
  if (x <= 10.7) return 'GANGWAY COUPLING';
  return 'CAR C (REAR)';
}

/**
 * Pure helper checking whether the player is within interaction/opening range of a gangway door.
 */
export function isNearGangwayDoor(x: number): boolean {
  for (const gx of GANGWAY_CENTERS_X) {
    if (Math.abs(x - gx) <= GANGWAY_DOOR_TRIGGER_DIST_X) {
      return true;
    }
  }
  return false;
}

/**
 * Pure helper updating walking velocity for a single axis.
 * When `smoothWalking` is off (default), starts and stops instantly.
 * When `smoothWalking` is on, accelerates and decelerates gradually to the same top speed.
 */
export function stepWalkAxisVelocity(
  currentVel: number,
  targetInput: number,
  smoothWalking: boolean,
  dtSec: number,
  topSpeed = WALK_SPEED_MPS
): number {
  const desiredVel = targetInput * topSpeed;
  if (!smoothWalking) {
    return desiredVel;
  }

  const rate = Math.abs(desiredVel) > Math.abs(currentVel) ? WALK_SMOOTH_ACCEL : WALK_SMOOTH_DECEL;
  const maxStep = rate * dtSec;
  const diff = desiredVel - currentVel;
  if (Math.abs(diff) <= maxStep) {
    return desiredVel;
  }
  return currentVel + Math.sign(diff) * maxStep;
}

/**
 * Pure helper clamping player (x, z) inside the 3-car consist and narrower gangway corridors.
 */
export function clampPlayerConsistPosition(x: number, z: number): { x: number; z: number } {
  const clampedX = Math.max(WALK_MIN_X, Math.min(WALK_MAX_X, x));
  const loc = resolveConsistLocation(clampedX);
  const maxAbsZ = loc === 'GANGWAY COUPLING' ? WALK_GANGWAY_HALF_Z : WALK_CAR_HALF_Z;
  const clampedZ = Math.max(-maxAbsZ, Math.min(maxAbsZ, z));
  return { x: clampedX, z: clampedZ };
}

export interface PlayerKinematicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  seated: boolean;
  angularSpeedRadS: number;
  lastInputSource: 'mouse' | 'touch' | 'key' | 'none';
  touchTurnAccumRad: number;
}

export class PlayerController {
  private keysHeld = new Set<string>();
  private stickInput = { x: 0, y: 0 }; // x: strafe right+, y: forward+
  private pendingMouseDelta = { dx: 0, dy: 0 };
  private pendingTouchDelta = { dx: 0, dy: 0 };
  private activeTouchId: number | null = null;
  private lastTouchPos = { x: 0, y: 0 };

  private state: PlayerKinematicsState = {
    x: PLAYER_SEAT_X,
    y: PLAYER_EYE_HEIGHT_SEATED,
    z: PLAYER_SEAT_Z,
    vx: 0,
    vz: 0,
    yaw: 0, // 0 faces -Z across the aisle from the +Z bench
    pitch: -0.03,
    seated: true,
    angularSpeedRadS: 0,
    lastInputSource: 'none',
    touchTurnAccumRad: 0,
  };

  public attach(canvas: HTMLElement): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      this.keysHeld.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };

    const onBlur = () => {
      this.keysHeld.clear();
      this.stickInput = { x: 0, y: 0 };
      this.activeTouchId = null;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        onBlur();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      // Only treat mouse movement as look input while locked (Section 4)
      if (!pointerLock.isLocked()) return;
      this.pendingMouseDelta.dx += e.movementX || 0;
      this.pendingMouseDelta.dy += e.movementY || 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (this.activeTouchId !== null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      this.activeTouchId = touch.identifier;
      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
      this.state.touchTurnAccumRad = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (this.activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t && t.identifier === this.activeTouchId) {
          this.pendingTouchDelta.dx += t.clientX - this.lastTouchPos.x;
          this.pendingTouchDelta.dy += t.clientY - this.lastTouchPos.y;
          this.lastTouchPos = { x: t.clientX, y: t.clientY };
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (this.activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t && t.identifier === this.activeTouchId) {
          this.activeTouchId = null;
          this.state.touchTurnAccumRad = 0;
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }

  public setMoveStickInput(x: number, y: number): void {
    this.stickInput = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    };
  }

  public resetToSeat(): void {
    this.keysHeld.clear();
    this.stickInput = { x: 0, y: 0 };
    this.pendingMouseDelta = { dx: 0, dy: 0 };
    this.pendingTouchDelta = { dx: 0, dy: 0 };
    this.state = {
      x: PLAYER_SEAT_X,
      y: PLAYER_EYE_HEIGHT_SEATED,
      z: PLAYER_SEAT_Z,
      vx: 0,
      vz: 0,
      yaw: 0,
      pitch: -0.03,
      seated: true,
      angularSpeedRadS: 0,
      lastInputSource: 'none',
      touchTurnAccumRad: 0,
    };
  }

  public getState(): PlayerKinematicsState {
    return this.state;
  }

  public step(dtSec: number, phase: GamePhase): PlayerKinematicsState {
    if (dtSec <= 0) return this.state;

    const settings = settingsStore.get();
    const lookSpeedMult = settings.lookSpeed;
    const invertSign = settings.invertY ? -1 : 1;

    let dYaw = 0;
    let dPitch = 0;
    let source: PlayerKinematicsState['lastInputSource'] = 'none';

    // 1. Mouse look (only when pointerLock.isLocked())
    if (pointerLock.isLocked() && (this.pendingMouseDelta.dx !== 0 || this.pendingMouseDelta.dy !== 0)) {
      dYaw -= this.pendingMouseDelta.dx * MOUSE_SENSITIVITY_RAD_PER_PX * lookSpeedMult;
      dPitch -=
        this.pendingMouseDelta.dy * MOUSE_SENSITIVITY_RAD_PER_PX * lookSpeedMult * invertSign;
      source = 'mouse';
    }
    this.pendingMouseDelta.dx = 0;
    this.pendingMouseDelta.dy = 0;

    // 2. Touch drag look
    if (this.pendingTouchDelta.dx !== 0 || this.pendingTouchDelta.dy !== 0) {
      const touchYaw = -this.pendingTouchDelta.dx * TOUCH_LOOK_SENSITIVITY_RAD_PER_PX * lookSpeedMult;
      const touchPitch =
        -this.pendingTouchDelta.dy * TOUCH_LOOK_SENSITIVITY_RAD_PER_PX * lookSpeedMult * invertSign;
      dYaw += touchYaw;
      dPitch += touchPitch;
      this.state.touchTurnAccumRad += Math.hypot(touchYaw, touchPitch);
      source = 'touch';
    }
    this.pendingTouchDelta.dx = 0;
    this.pendingTouchDelta.dy = 0;

    // 3. Arrow key look (yaw 1.8 rad/s, pitch 1.2 rad/s per Section 4)
    let keyYawDir = 0;
    let keyPitchDir = 0;
    if (this.keysHeld.has('ArrowLeft')) keyYawDir += 1;
    if (this.keysHeld.has('ArrowRight')) keyYawDir -= 1;
    if (this.keysHeld.has('ArrowUp')) keyPitchDir += 1;
    if (this.keysHeld.has('ArrowDown')) keyPitchDir -= 1;

    if (keyYawDir !== 0 || keyPitchDir !== 0) {
      dYaw += keyYawDir * KEY_YAW_SPEED_RAD * lookSpeedMult * dtSec;
      dPitch += keyPitchDir * KEY_PITCH_SPEED_RAD * lookSpeedMult * invertSign * dtSec;
      if (source === 'none') source = 'key';
    }

    const nextYaw = this.state.yaw + dYaw;
    this.state.yaw =
      phase === 'trial'
        ? Math.max(-TRIAL_YAW_LIMIT_RAD, Math.min(TRIAL_YAW_LIMIT_RAD, nextYaw))
        : nextYaw;
    this.state.pitch = Math.max(PITCH_MIN_RAD, Math.min(PITCH_MAX_RAD, this.state.pitch + dPitch));

    this.state.angularSpeedRadS = Math.hypot(dYaw, dPitch) / Math.max(0.001, dtSec);
    this.state.lastInputSource = source;

    // 4. Walking (WASD or touch WALK stick)
    let moveForward = this.stickInput.y;
    let moveRight = this.stickInput.x;
    if (this.keysHeld.has('KeyW')) moveForward += 1;
    if (this.keysHeld.has('KeyS')) moveForward -= 1;
    if (this.keysHeld.has('KeyD')) moveRight += 1;
    if (this.keysHeld.has('KeyA')) moveRight -= 1;

    const inputMag = Math.hypot(moveForward, moveRight);
    if (inputMag > 1) {
      moveForward /= inputMag;
      moveRight /= inputMag;
    }

    // Transform local walk intent by camera yaw (where yaw = 0 faces -Z)
    const sinY = Math.sin(this.state.yaw);
    const cosY = Math.cos(this.state.yaw);
    const worldInputX = -sinY * moveForward + cosY * moveRight;
    const worldInputZ = -cosY * moveForward - sinY * moveRight;

    // Stand up from seat when walking input is given
    if (inputMag > 0.05 && this.state.seated) {
      this.state.seated = false;
      this.state.z = Math.min(this.state.z, 0.35);
    }

    this.state.vx = stepWalkAxisVelocity(
      this.state.vx,
      worldInputX,
      settings.smoothWalking,
      dtSec
    );
    this.state.vz = stepWalkAxisVelocity(
      this.state.vz,
      worldInputZ,
      settings.smoothWalking,
      dtSec
    );

    if (!this.state.seated) {
      const nextX = this.state.x + this.state.vx * dtSec;
      const nextZ = this.state.z + this.state.vz * dtSec;
      const clamped = clampPlayerConsistPosition(nextX, nextZ);
      this.state.x = clamped.x;
      this.state.z = clamped.z;

      // Smoothly transition eye height to standing height with subtle walk bob
      const speed = Math.hypot(this.state.vx, this.state.vz);
      const targetY = PLAYER_EYE_HEIGHT_STANDING;
      this.state.y += (targetY - this.state.y) * Math.min(1, dtSec * 10);

      // Return to seat if player walks right back to their bench spot and stops
      if (
        speed < 0.05 &&
        inputMag < 0.05 &&
        Math.abs(this.state.x - PLAYER_SEAT_X) < 0.48 &&
        this.state.z > 0.48
      ) {
        this.state.seated = true;
        this.state.x = PLAYER_SEAT_X;
        this.state.z = PLAYER_SEAT_Z;
      }
    } else {
      this.state.y += (PLAYER_EYE_HEIGHT_SEATED - this.state.y) * Math.min(1, dtSec * 10);
    }

    return this.state;
  }
}

export const playerController = new PlayerController();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__playerController = playerController;
}

