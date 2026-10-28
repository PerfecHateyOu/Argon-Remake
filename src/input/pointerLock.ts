import { UI_STRINGS } from '../constants';
import { settingsStore } from '../settings';

/**
 * Pointer lock singleton (`src/input/pointerLock.ts`):
 * - Tracks lock state from `pointerlockchange`; components subscribe to it.
 * - `lock(canvas)`: if `rawMouse` is on, calls `requestPointerLock({ unadjustedMovement: true })`;
 *   if unsupported or rejects, falls back to plain `requestPointerLock()`.
 *   Handles both promise and non-promise return forms.
 * - On `pointerlockerror`, shows a short hint telling the player to click the game to capture the mouse;
 *   clears it once locked.
 * - `unlock({ quiet })`: quiet unlocks (opening the evidence album or route selector) do NOT trigger auto-pause.
 *   A non-quiet loss of lock mid-ride (Esc) auto-pauses.
 * - Only treat mouse movement as look input while locked.
 */

export interface PointerLockState {
  locked: boolean;
  errorHint: string | null;
}

type PointerLockListener = (state: PointerLockState) => void;
type UnexpectedUnlockHandler = () => void;

export interface PointerLockTarget {
  requestPointerLock?: (options?: { unadjustedMovement?: boolean }) => Promise<void> | void;
}

/**
 * Pure helper for requesting pointer lock with rawMouse option and fallback.
 * Exported so unit tests can verify both promise rejection and synchronous throw fallbacks.
 */
export async function requestPointerLockWithFallback(
  target: PointerLockTarget,
  rawMouse: boolean
): Promise<boolean> {
  if (!target || typeof target.requestPointerLock !== 'function') {
    return false;
  }

  if (rawMouse) {
    try {
      const maybePromise = target.requestPointerLock({ unadjustedMovement: true });
      if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
        await maybePromise;
      }
      return true;
    } catch {
      // Fallback to standard requestPointerLock() when unadjustedMovement is unsupported or rejected
      try {
        const fallbackPromise = target.requestPointerLock();
        if (fallbackPromise && typeof (fallbackPromise as Promise<void>).then === 'function') {
          await fallbackPromise;
        }
        return true;
      } catch {
        return false;
      }
    }
  }

  try {
    const res = target.requestPointerLock();
    if (res && typeof (res as Promise<void>).then === 'function') {
      await res;
    }
    return true;
  } catch {
    return false;
  }
}

export class PointerLockManager {
  private state: PointerLockState = {
    locked: false,
    errorHint: null,
  };
  private quietUnlockPending = false;
  private targetElement: Element | null = null;
  private listeners = new Set<PointerLockListener>();
  private unexpectedUnlockHandlers = new Set<UnexpectedUnlockHandler>();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', this.handlePointerLockChange);
      document.addEventListener('pointerlockerror', this.handlePointerLockError);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public getState(): PointerLockState {
    return this.state;
  }

  public isLocked(): boolean {
    return this.state.locked;
  }

  public subscribe(listener: PointerLockListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onUnexpectedUnlock(handler: UnexpectedUnlockHandler): () => void {
    this.unexpectedUnlockHandlers.add(handler);
    return () => {
      this.unexpectedUnlockHandlers.delete(handler);
    };
  }

  public async lock(canvas: HTMLElement): Promise<boolean> {
    this.targetElement = canvas;
    this.quietUnlockPending = false;
    const rawMouse = settingsStore.get().rawMouse;
    const ok = await requestPointerLockWithFallback(canvas as PointerLockTarget, rawMouse);
    if (!ok) {
      this.triggerErrorHint();
    }
    return ok;
  }

  public unlock(options?: { quiet?: boolean }): void {
    const quiet = Boolean(options?.quiet);
    if (quiet) {
      this.quietUnlockPending = true;
    }
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // Ignore exitPointerLock errors
      }
    } else if (!this.state.locked) {
      // Already unlocked: clear pending quiet flag
      this.quietUnlockPending = false;
    }
  }

  public clearErrorHint(): void {
    if (this.state.errorHint !== null) {
      this.state = { ...this.state, errorHint: null };
      this.emit();
    }
  }

  public triggerErrorHint(): void {
    if (this.state.errorHint !== UI_STRINGS.POINTER_LOCK_HINT) {
      this.state = {
        ...this.state,
        errorHint: UI_STRINGS.POINTER_LOCK_HINT,
      };
      this.emit();
    }
  }

  /**
   * Handles pointerlockchange transitions. Also exposed for deterministic unit testing.
   */
  public notifyLockStateChanged(isNowLocked: boolean): void {
    const wasLocked = this.state.locked;

    if (isNowLocked) {
      this.quietUnlockPending = false;
      this.state = {
        locked: true,
        errorHint: null, // Clear error hint once locked
      };
      this.emit();
      return;
    }

    this.state = {
      ...this.state,
      locked: false,
    };
    this.emit();

    if (wasLocked) {
      const wasQuiet = this.quietUnlockPending;
      this.quietUnlockPending = false;
      if (!wasQuiet) {
        for (const handler of this.unexpectedUnlockHandlers) {
          handler();
        }
      }
    } else {
      this.quietUnlockPending = false;
    }
  }

  private handlePointerLockChange = (): void => {
    if (typeof document === 'undefined') return;
    const activeEl = document.pointerLockElement;
    const isNowLocked = Boolean(
      activeEl && (!this.targetElement || activeEl === this.targetElement)
    );
    this.notifyLockStateChanged(isNowLocked);
  };

  private handlePointerLockError = (): void => {
    this.triggerErrorHint();
  };
}

export const pointerLock = new PointerLockManager();
