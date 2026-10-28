import React, { useEffect, useState } from 'react';
import { LOOK_SPEED_MAX, LOOK_SPEED_MIN, LOOK_SPEED_STEP } from '../constants';
import { settingsStore } from '../settings';
import type { ProgressArchive, ScreenEffectsMode, SettingsState } from '../types';

interface SettingsPanelProps {
  settings: SettingsState;
  archive: ProgressArchive;
  onUpdate: (patch: Partial<SettingsState>) => void;
  onEraseProgress: () => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  archive,
  onUpdate,
  onEraseProgress,
  onClose,
}) => {
  const [confirmErase, setConfirmErase] = useState(false);
  const [erasedNotice, setErasedNotice] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const systemReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hasSaved = settingsStore.hasSavedProgress();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-8 bg-[#040504]/85 pointer-events-auto"
    >
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto border border-[#e6e2d8]/25 bg-[#0b0d0b] p-6 md:p-8 text-[#e6e2d8] space-y-6">
        <div className="flex items-center justify-between border-b border-[#e6e2d8]/15 pb-4">
          <h2 className="text-xl font-semibold text-[#fff0d4]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-[#e6e2d8]/30 text-xs font-medium text-[#e6e2d8] hover:border-[#fff0d4] hover:text-[#fff0d4] focus-visible:outline-2 focus-visible:outline-[#ffcf8a] cursor-pointer whitespace-nowrap"
          >
            Close settings
          </button>
        </div>

        {/* Look & Movement Controls */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="setting-look-speed" className="text-sm font-medium">
                Look speed
              </label>
              <span className="text-xs font-mono tabular-nums text-[#ffcf8a]">
                {settings.lookSpeed.toFixed(1)}×
              </span>
            </div>
            <input
              id="setting-look-speed"
              type="range"
              min={LOOK_SPEED_MIN}
              max={LOOK_SPEED_MAX}
              step={LOOK_SPEED_STEP}
              value={settings.lookSpeed}
              onChange={(e) => onUpdate({ lookSpeed: Number(e.target.value) })}
              className="w-full accent-[#ffcf8a] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <label htmlFor="setting-invert-y" className="text-sm font-medium">
              Invert vertical look
            </label>
            <input
              id="setting-invert-y"
              type="checkbox"
              checked={settings.invertY}
              onChange={(e) => onUpdate({ invertY: e.target.checked })}
              className="h-4 w-4 accent-[#ffcf8a] cursor-pointer"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <div>
              <label htmlFor="setting-raw-mouse" className="text-sm font-medium block">
                Raw mouse input
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                Uses your mouse&apos;s movement without the system&apos;s pointer acceleration,
                where the browser supports it. Applies the next time the mouse is captured.
              </p>
            </div>
            <input
              id="setting-raw-mouse"
              type="checkbox"
              checked={settings.rawMouse}
              onChange={(e) => onUpdate({ rawMouse: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#ffcf8a] cursor-pointer shrink-0"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <div>
              <label htmlFor="setting-smooth-walking" className="text-sm font-medium block">
                Smooth walking
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                Walking speeds up and slows down gradually instead of starting and stopping at
                once. Same top speed.
              </p>
            </div>
            <input
              id="setting-smooth-walking"
              type="checkbox"
              checked={settings.smoothWalking}
              onChange={(e) => onUpdate({ smoothWalking: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#ffcf8a] cursor-pointer shrink-0"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <div>
              <label htmlFor="setting-show-hints" className="text-sm font-medium block">
                Show control hints
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                The key strip along the bottom: all through your first ride, then for the first
                minute of each ride after.
              </p>
            </div>
            <input
              id="setting-show-hints"
              type="checkbox"
              checked={settings.showHints}
              onChange={(e) => onUpdate({ showHints: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#ffcf8a] cursor-pointer shrink-0"
            />
          </div>
        </div>

        {/* Audio Controls */}
        <div className="space-y-4 pt-4 border-t border-[#e6e2d8]/15">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="setting-game-volume" className="text-sm font-medium">
                Game sounds
              </label>
              <span className="text-xs font-mono tabular-nums text-[#ffcf8a]">
                {Math.round(settings.gameVolume * 100)}%
              </span>
            </div>
            <input
              id="setting-game-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.gameVolume}
              onChange={(e) => onUpdate({ gameVolume: Number(e.target.value) })}
              className="w-full accent-[#ffcf8a] cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="setting-music-volume" className="text-sm font-medium">
                Speaker music
              </label>
              <span className="text-xs font-mono tabular-nums text-[#ffcf8a]">
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
            <input
              id="setting-music-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => onUpdate({ musicVolume: Number(e.target.value) })}
              className="w-full accent-[#ffcf8a] cursor-pointer"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <div>
              <label htmlFor="setting-start-muted" className="text-sm font-medium block">
                Start rides muted
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                Tap the sound button to turn it on. M turns sound on and off at any time.
              </p>
            </div>
            <input
              id="setting-start-muted"
              type="checkbox"
              checked={settings.startMuted}
              onChange={(e) => onUpdate({ startMuted: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#ffcf8a] cursor-pointer shrink-0"
            />
          </div>
        </div>

        {/* Display, Haptics & Debug */}
        <div className="space-y-4 pt-4 border-t border-[#e6e2d8]/15">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="setting-screen-effects" className="text-sm font-medium block">
                Screen effects
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                {settings.screenEffects === 'system'
                  ? systemReduced
                    ? 'Following your device: Off.'
                    : 'Following your device: On.'
                  : settings.screenEffects === 'full'
                  ? 'Always on.'
                  : 'Reduced.'}
              </p>
            </div>
            <select
              id="setting-screen-effects"
              value={settings.screenEffects}
              onChange={(e) =>
                onUpdate({ screenEffects: e.target.value as ScreenEffectsMode })
              }
              className="bg-[#121512] border border-[#e6e2d8]/25 text-xs text-[#e6e2d8] px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-[#ffcf8a]"
            >
              <option value="system">Match device</option>
              <option value="full">Full</option>
              <option value="reduced">Reduced</option>
            </select>
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <div>
              <label htmlFor="setting-vibrate" className="text-sm font-medium block">
                Vibrate for catches
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                At each stop, a soft pulse for every anomaly you caught on the way in.
              </p>
            </div>
            <input
              id="setting-vibrate"
              type="checkbox"
              checked={settings.vibrateOnCatch}
              onChange={(e) => onUpdate({ vibrateOnCatch: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#ffcf8a] cursor-pointer shrink-0"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <div>
              <label htmlFor="setting-fullscreen" className="text-sm font-medium block">
                Full screen when boarding
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                Hides the browser&apos;s bars during the ride. Press Esc (or use the pause
                menu) to leave.
              </p>
            </div>
            <input
              id="setting-fullscreen"
              type="checkbox"
              checked={settings.fullscreenOnBoard}
              onChange={(e) => onUpdate({ fullscreenOnBoard: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#ffcf8a] cursor-pointer shrink-0"
            />
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-[#e6e2d8]/10">
            <div>
              <label htmlFor="setting-debug-overlay" className="text-sm font-medium block">
                Debug overlay (spoilers)
              </label>
              <p className="text-xs text-[#9e9a90] mt-0.5">
                Spoiler warning: shows hidden anomalies, sanity and suspicion. It shows during
                rides while this is on (` hides or shows it on a keyboard). Rides where
                it&apos;s shown are debug runs and save nothing.
              </p>
            </div>
            <input
              id="setting-debug-overlay"
              type="checkbox"
              checked={settings.debugOverlay}
              onChange={(e) => onUpdate({ debugOverlay: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#ffcf8a] cursor-pointer shrink-0"
            />
          </div>
        </div>

        {/* Saved Progress Management */}
        <div className="pt-4 border-t border-[#e6e2d8]/15 space-y-2">
          {!hasSaved ? (
            <p className="text-xs text-[#9e9a90]">
              {erasedNotice
                ? 'Saved progress erased. Your settings are kept.'
                : 'Nothing saved on this device yet.'}
            </p>
          ) : !confirmErase ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#c8c3b8] font-mono tabular-nums">
                {archive.finishedRides} finished ride{archive.finishedRides === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setConfirmErase(true)}
                className="px-3.5 py-1.5 border border-[#d9534f]/50 text-xs text-[#d9534f] hover:bg-[#d9534f]/10 cursor-pointer whitespace-nowrap"
              >
                Erase saved progress
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-[#d9534f]/40 bg-[#1a0d0d] p-3">
              <div className="text-xs text-[#f5f2eb]">
                <p>Erase everything saved on this device? This can’t be undone.</p>
                <p className="text-[#9e9a90] mt-0.5">Your settings are kept.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onEraseProgress();
                    setConfirmErase(false);
                    setErasedNotice(true);
                  }}
                  className="px-3 py-1 bg-[#d9534f] text-[#040504] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Confirm erase
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmErase(false)}
                  className="px-3 py-1 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
