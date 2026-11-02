import {
  DEFAULT_SETTINGS,
  LOOK_SPEED_MAX,
  LOOK_SPEED_MIN,
  STORAGE_KEYS,
} from './constants';
import type {
  EvpTapeRecord,
  PolaroidPhotoRecord,
  ProgressArchive,
  ScreenEffectsMode,
  SettingsState,
} from './types';

type SettingsListener = (settings: SettingsState) => void;
type ArchiveListener = (archive: ProgressArchive) => void;

const DEFAULT_ARCHIVE: ProgressArchive = {
  finishedRides: 0,
  documentedAnomalies: [],
  unconfirmedAnomalies: [],
  documentedEndings: [],
  unlockedAchievements: [],
};

export const vibrationLog: number[] = [];

export function triggerHapticPulse(durationMs = 35): void {
  if (!(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD) {
    vibrationLog.push(durationMs);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.HAPTICS, JSON.stringify({ lastPulseMs: durationMs }));
    } catch {
      // Ignore storage errors
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs);
    } catch {
      // Ignore vibrate errors in restricted contexts
    }
  }
}

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

export function sanitizeSettings(
  raw: Partial<Record<keyof SettingsState, unknown>> | null | undefined
): SettingsState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    lookSpeed: Number(
      clampNumber(raw.lookSpeed, LOOK_SPEED_MIN, LOOK_SPEED_MAX, DEFAULT_SETTINGS.lookSpeed).toFixed(
        2
      )
    ),
    invertY: typeof raw.invertY === 'boolean' ? raw.invertY : DEFAULT_SETTINGS.invertY,
    gameVolume: Number(clampNumber(raw.gameVolume, 0, 1, DEFAULT_SETTINGS.gameVolume).toFixed(2)),
    musicVolume: Number(
      clampNumber(raw.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume).toFixed(2)
    ),
    screenEffects: parseScreenEffects(raw.screenEffects),
    fullscreenOnBoard:
      typeof raw.fullscreenOnBoard === 'boolean'
        ? raw.fullscreenOnBoard
        : DEFAULT_SETTINGS.fullscreenOnBoard,
    startMuted: typeof raw.startMuted === 'boolean' ? raw.startMuted : DEFAULT_SETTINGS.startMuted,
    showHints: typeof raw.showHints === 'boolean' ? raw.showHints : DEFAULT_SETTINGS.showHints,
    vibrateOnCatch:
      typeof raw.vibrateOnCatch === 'boolean'
        ? raw.vibrateOnCatch
        : DEFAULT_SETTINGS.vibrateOnCatch,
    rawMouse: typeof raw.rawMouse === 'boolean' ? raw.rawMouse : DEFAULT_SETTINGS.rawMouse,
    smoothWalking:
      typeof raw.smoothWalking === 'boolean' ? raw.smoothWalking : DEFAULT_SETTINGS.smoothWalking,
    debugOverlay:
      typeof raw.debugOverlay === 'boolean' ? raw.debugOverlay : DEFAULT_SETTINGS.debugOverlay,
  };
}

function readJsonList(key: string): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

class SettingsStore {
  private state: SettingsState;
  private archive: ProgressArchive;
  private listeners = new Set<SettingsListener>();
  private archiveListeners = new Set<ArchiveListener>();

  constructor() {
    this.state = this.loadSettingsFromStorage();
    this.archive = this.loadArchiveFromStorage();
    this.ensureAllCanonicalKeysInitialized();
  }

  private ensureAllCanonicalKeysInitialized(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const defaults: ReadonlyArray< readonly [string, string]> = [
        [STORAGE_KEYS.SETTINGS, JSON.stringify(this.state)],
        [STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(this.archive.unlockedAchievements)],
        [STORAGE_KEYS.ENDINGS, JSON.stringify(this.archive.documentedEndings)],
        [STORAGE_KEYS.ENDINGS_ARCHIVE, JSON.stringify(this.archive.documentedEndings)],
        [STORAGE_KEYS.RUNS, JSON.stringify(this.archive.finishedRides)],
        [STORAGE_KEYS.POLAROIDS, JSON.stringify([])],
        [STORAGE_KEYS.TAPES, JSON.stringify([])],
        [
          STORAGE_KEYS.PSYCHLOG,
          JSON.stringify({
            documented: this.archive.documentedAnomalies,
            unconfirmed: this.archive.unconfirmedAnomalies,
          }),
        ],
        [STORAGE_KEYS.TUTORIAL, JSON.stringify({ completed: false })],
        [STORAGE_KEYS.HAPTICS, JSON.stringify({ enabled: this.state.vibrateOnCatch })],
        [STORAGE_KEYS.ANNOUNCEMENT, JSON.stringify({ lastText: '' })],
      ];
      for (const [k, fallback] of defaults) {
        if (window.localStorage.getItem(k) === null) {
          window.localStorage.setItem(k, fallback);
        }
      }
    } catch {
      // Ignore storage quota errors
    }
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
      const parsed = stored ? (JSON.parse(stored) as Partial<ProgressArchive>) : {};
      const runsRaw = window.localStorage.getItem(STORAGE_KEYS.RUNS);
      const runsCount = runsRaw ? Number(JSON.parse(runsRaw)) : 0;
      const achievementsList = readJsonList(STORAGE_KEYS.ACHIEVEMENTS);
      const endingsList = readJsonList(STORAGE_KEYS.ENDINGS);
      const courtSqEndings = readJsonList(STORAGE_KEYS.ENDINGS_ARCHIVE);

      let psychDoc: string[] = [];
      let psychUnconf: string[] = [];
      const psychRaw = window.localStorage.getItem(STORAGE_KEYS.PSYCHLOG);
      if (psychRaw) {
        const psychParsed = JSON.parse(psychRaw) as {
          documented?: unknown;
          unconfirmed?: unknown;
        };
        if (Array.isArray(psychParsed?.documented)) {
          psychDoc = psychParsed.documented.filter((x): x is string => typeof x === 'string');
        }
        if (Array.isArray(psychParsed?.unconfirmed)) {
          psychUnconf = psychParsed.unconfirmed.filter((x): x is string => typeof x === 'string');
        }
      }

      const finishedRides = Math.max(
        typeof parsed.finishedRides === 'number' && parsed.finishedRides >= 0
          ? Math.floor(parsed.finishedRides)
          : 0,
        Number.isFinite(runsCount) && runsCount >= 0 ? Math.floor(runsCount) : 0
      );

      const documentedAnomalies = Array.from(
        new Set([
          ...(Array.isArray(parsed.documentedAnomalies)
            ? parsed.documentedAnomalies.filter((x): x is string => typeof x === 'string')
            : []),
          ...psychDoc,
        ])
      );
      const unconfirmedAnomalies = Array.from(
        new Set([
          ...(Array.isArray(parsed.unconfirmedAnomalies)
            ? parsed.unconfirmedAnomalies.filter((x): x is string => typeof x === 'string')
            : []),
          ...psychUnconf,
        ])
      ).filter((id) => !documentedAnomalies.includes(id));

      const documentedEndings = Array.from(
        new Set([
          ...(Array.isArray(parsed.documentedEndings)
            ? parsed.documentedEndings.filter((x): x is string => typeof x === 'string')
            : []),
          ...endingsList,
          ...courtSqEndings,
        ])
      );

      const unlockedAchievements = Array.from(
        new Set([
          ...(Array.isArray(parsed.unlockedAchievements)
            ? parsed.unlockedAchievements.filter((x): x is string => typeof x === 'string')
            : []),
          ...achievementsList,
        ])
      );

      return {
        finishedRides,
        documentedAnomalies,
        unconfirmedAnomalies,
        documentedEndings,
        unlockedAchievements,
      };
    } catch {
      return { ...DEFAULT_ARCHIVE };
    }
  }

  private persistSettings(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.state));
      window.localStorage.setItem(
        STORAGE_KEYS.HAPTICS,
        JSON.stringify({ enabled: this.state.vibrateOnCatch })
      );
    } catch {
      // Ignore quota errors in restricted sandboxes
    }
  }

  private persistArchive(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.ARCHIVE, JSON.stringify(this.archive));
      window.localStorage.setItem(
        STORAGE_KEYS.ACHIEVEMENTS,
        JSON.stringify(this.archive.unlockedAchievements)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.ENDINGS,
        JSON.stringify(this.archive.documentedEndings)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.ENDINGS_ARCHIVE,
        JSON.stringify(this.archive.documentedEndings)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.RUNS,
        JSON.stringify(this.archive.finishedRides)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.PSYCHLOG,
        JSON.stringify({
          documented: this.archive.documentedAnomalies,
          unconfirmed: this.archive.unconfirmedAnomalies,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }

  public savePolaroidsToStorage(photos: readonly PolaroidPhotoRecord[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.POLAROIDS, JSON.stringify(photos));
    } catch {
      // Ignore storage errors
    }
  }

  public saveTapesToStorage(tapes: readonly EvpTapeRecord[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.TAPES, JSON.stringify(tapes));
    } catch {
      // Ignore storage errors
    }
  }

  public saveTutorialCompleted(completed: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.TUTORIAL, JSON.stringify({ completed }));
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
        window.localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
        window.localStorage.removeItem(STORAGE_KEYS.ENDINGS);
        window.localStorage.removeItem(STORAGE_KEYS.ENDINGS_ARCHIVE);
        window.localStorage.removeItem(STORAGE_KEYS.RUNS);
        window.localStorage.removeItem(STORAGE_KEYS.POLAROIDS);
        window.localStorage.removeItem(STORAGE_KEYS.TAPES);
        window.localStorage.removeItem(STORAGE_KEYS.PSYCHLOG);
        window.localStorage.removeItem(STORAGE_KEYS.TUTORIAL);
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

if (
  typeof window !== 'undefined' &&
  !(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD
) {
  const win = window as unknown as Record<string, unknown>;
  win.__S = settingsStore;
  win.__vib = vibrationLog;
}
