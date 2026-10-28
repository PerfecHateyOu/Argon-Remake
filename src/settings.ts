import {
  DEFAULT_SETTINGS,
  LOOK_SPEED_MAX,
  LOOK_SPEED_MIN,
  STORAGE_KEYS,
} from './constants';
import type { ProgressArchive, ScreenEffectsMode, SettingsState } from './types';

type SettingsListener = (settings: SettingsState) => void;
type ArchiveListener = (archive: ProgressArchive) => void;

const DEFAULT_ARCHIVE: ProgressArchive = {
  finishedRides: 0,
  documentedAnomalies: [],
  unconfirmedAnomalies: [],
  documentedEndings: [],
  unlockedAchievements: [],
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function parseScreenEffects(value: unknown): ScreenEffectsMode {
  if (value === 'system' || value === 'full' || value === 'reduced') {
    return value;
  }
  return DEFAULT_SETTINGS.screenEffects;
}

export function sanitizeSettings(raw: Partial<Record<keyof SettingsState, unknown>> | null | undefined): SettingsState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    lookSpeed: Number(
      clampNumber(raw.lookSpeed, LOOK_SPEED_MIN, LOOK_SPEED_MAX, DEFAULT_SETTINGS.lookSpeed).toFixed(2)
    ),
    invertY: typeof raw.invertY === 'boolean' ? raw.invertY : DEFAULT_SETTINGS.invertY,
    gameVolume: Number(clampNumber(raw.gameVolume, 0, 1, DEFAULT_SETTINGS.gameVolume).toFixed(2)),
    musicVolume: Number(clampNumber(raw.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume).toFixed(2)),
    screenEffects: parseScreenEffects(raw.screenEffects),
    fullscreenOnBoard:
      typeof raw.fullscreenOnBoard === 'boolean'
        ? raw.fullscreenOnBoard
        : DEFAULT_SETTINGS.fullscreenOnBoard,
    startMuted: typeof raw.startMuted === 'boolean' ? raw.startMuted : DEFAULT_SETTINGS.startMuted,
    showHints: typeof raw.showHints === 'boolean' ? raw.showHints : DEFAULT_SETTINGS.showHints,
    vibrateOnCatch:
      typeof raw.vibrateOnCatch === 'boolean' ? raw.vibrateOnCatch : DEFAULT_SETTINGS.vibrateOnCatch,
    rawMouse: typeof raw.rawMouse === 'boolean' ? raw.rawMouse : DEFAULT_SETTINGS.rawMouse,
    smoothWalking:
      typeof raw.smoothWalking === 'boolean' ? raw.smoothWalking : DEFAULT_SETTINGS.smoothWalking,
    debugOverlay:
      typeof raw.debugOverlay === 'boolean' ? raw.debugOverlay : DEFAULT_SETTINGS.debugOverlay,
  };
}

class SettingsStore {
  private state: SettingsState;
  private archive: ProgressArchive;
  private listeners = new Set<SettingsListener>();
  private archiveListeners = new Set<ArchiveListener>();

  constructor() {
    this.state = this.loadSettingsFromStorage();
    this.archive = this.loadArchiveFromStorage();
  }

  private loadSettingsFromStorage(): SettingsState {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!stored) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(stored) as Partial<Record<keyof SettingsState, unknown>>;
      return sanitizeSettings(parsed);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private loadArchiveFromStorage(): ProgressArchive {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_ARCHIVE };
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.ARCHIVE);
      if (!stored) return { ...DEFAULT_ARCHIVE };
      const parsed = JSON.parse(stored) as Partial<ProgressArchive>;
      return {
        finishedRides:
          typeof parsed.finishedRides === 'number' && parsed.finishedRides >= 0
            ? Math.floor(parsed.finishedRides)
            : 0,
        documentedAnomalies: Array.isArray(parsed.documentedAnomalies)
          ? parsed.documentedAnomalies.filter((x): x is string => typeof x === 'string')
          : [],
        unconfirmedAnomalies: Array.isArray(parsed.unconfirmedAnomalies)
          ? parsed.unconfirmedAnomalies.filter((x): x is string => typeof x === 'string')
          : [],
        documentedEndings: Array.isArray(parsed.documentedEndings)
          ? parsed.documentedEndings.filter((x): x is string => typeof x === 'string')
          : [],
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
          ? parsed.unlockedAchievements.filter((x): x is string => typeof x === 'string')
          : [],
      };
    } catch {
      return { ...DEFAULT_ARCHIVE };
    }
  }

  private persistSettings(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors in restricted sandboxes
    }
  }

  private persistArchive(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.ARCHIVE, JSON.stringify(this.archive));
    } catch {
      // Ignore storage errors
    }
  }

  public get(): SettingsState {
    return this.state;
  }

  public getArchive(): ProgressArchive {
    return this.archive;
  }

  public update(patch: Partial<SettingsState>): SettingsState {
    this.state = sanitizeSettings({ ...this.state, ...patch });
    this.persistSettings();
    for (const listener of this.listeners) {
      listener(this.state);
    }
    return this.state;
  }

  public updateArchive(patch: Partial<ProgressArchive>): ProgressArchive {
    this.archive = {
      ...this.archive,
      ...patch,
    };
    this.persistArchive();
    for (const listener of this.archiveListeners) {
      listener(this.archive);
    }
    return this.archive;
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeArchive(listener: ArchiveListener): () => void {
    this.archiveListeners.add(listener);
    return () => {
      this.archiveListeners.delete(listener);
    };
  }

  public isReducedEffectsActive(prefersReducedMotionOverride?: boolean): boolean {
    if (this.state.screenEffects === 'reduced') return true;
    if (this.state.screenEffects === 'full') return false;
    if (typeof prefersReducedMotionOverride === 'boolean') {
      return prefersReducedMotionOverride;
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }

  public hasSavedProgress(): boolean {
    return (
      this.archive.finishedRides > 0 ||
      this.archive.documentedAnomalies.length > 0 ||
      this.archive.unconfirmedAnomalies.length > 0 ||
      this.archive.documentedEndings.length > 0 ||
      this.archive.unlockedAchievements.length > 0
    );
  }

  /**
   * Erases all saved ride progress, case files, endings, and achievements.
   * Settings are explicitly preserved ("Your settings are kept.").
   */
  public eraseSavedProgress(): void {
    this.archive = { ...DEFAULT_ARCHIVE };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEYS.ARCHIVE);
      } catch {
        // Ignore storage errors
      }
    }
    for (const listener of this.archiveListeners) {
      listener(this.archive);
    }
  }
}

export const settingsStore = new SettingsStore();
