import React, { useEffect } from 'react';
import { UI_STRINGS } from '../constants';
import type { ChapterStartOption, EngineSnapshot, ProgressArchive } from '../types';

interface StartScreenProps {
  snapshot: EngineSnapshot;
  archive: ProgressArchive;
  onBoard: () => void;
  onToggleNightmare: (enabled: boolean) => void;
  onSelectChapter: (chapter: ChapterStartOption) => void;
  onOpenSettings: () => void;
  onOpenCaseFiles: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  snapshot,
  archive,
  onBoard,
  onToggleNightmare,
  onSelectChapter,
  onOpenSettings,
  onOpenCaseFiles,
}) => {
  const unlockedExtras = archive.finishedRides > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBoard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBoard]);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none select-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(4,5,4,0.92) 0%, rgba(4,5,4,0.74) 48%, rgba(4,5,4,0.28) 100%)',
      }}
    >
      {/* Top Rollsign & Title Lockup */}
      <div className="max-w-xl pointer-events-auto">
        <div className="inline-flex items-center gap-3 border border-[#e6e2d8]/20 bg-[#0b0d0b] px-3.5 py-2 mb-5">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="14" cy="14" r="13" fill="#6cbe45" />
            <text
              x="14"
              y="19"
              textAnchor="middle"
              fill="#040504"
              fontFamily="sans-serif"
              fontWeight="800"
              fontSize="16"
            >
              G
            </text>
          </svg>
          <div className="flex flex-col">
            <span className="text-[11px] tracking-[0.18em] text-[#ffcf8a] font-mono">
              {UI_STRINGS.SUBTITLE_GENRE}
            </span>
            <span className="text-sm font-semibold tracking-wider text-[#f5f2eb]">
              {UI_STRINGS.SUBTITLE_DEST}
            </span>
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#fff0d4] mb-3">
          {UI_STRINGS.TITLE}
        </h1>
        <p className="text-sm md:text-base text-[#c8c3b8] leading-relaxed max-w-lg">
          {UI_STRINGS.DESCRIPTION}
        </p>
      </div>

      {/* Middle Action & How-To-Play Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end my-auto py-6">
        {/* Left column: Boarding & Ride Options */}
        <div className="lg:col-span-6 max-w-md space-y-5 pointer-events-auto">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onBoard();
              }}
              className="px-7 py-3.5 bg-[#fff0d4] text-[#040504] font-semibold text-base tracking-wide hover:bg-[#ffcf8a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf8a] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Board train
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="px-5 py-3.5 border border-[#e6e2d8]/30 bg-[#0d100d] text-[#e6e2d8] text-sm font-medium hover:border-[#fff0d4] hover:text-[#fff0d4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf8a] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Settings
            </button>

            <button
              type="button"
              onClick={onOpenCaseFiles}
              className="px-5 py-3.5 border border-[#e6e2d8]/30 bg-[#0d100d] text-[#e6e2d8] text-sm font-medium hover:border-[#fff0d4] hover:text-[#fff0d4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf8a] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Case Files
            </button>
          </div>

          {/* Nightmare Mode & Chapter Select */}
          <div className="border border-[#e6e2d8]/15 bg-[#090b09] p-4 space-y-3">
            {!unlockedExtras && (
              <p className="text-xs text-[#9e9a90]">{UI_STRINGS.UNLOCK_HINT}</p>
            )}

            <div className="flex items-start justify-between gap-4">
              <div>
                <label
                  htmlFor="nightmare-toggle"
                  className="text-sm font-medium text-[#e6e2d8] block"
                >
                  {UI_STRINGS.NIGHTMARE_LABEL}
                </label>
                <p className="text-xs text-[#9e9a90] mt-0.5">{UI_STRINGS.NIGHTMARE_DESC}</p>
              </div>
              <input
                id="nightmare-toggle"
                type="checkbox"
                disabled={!unlockedExtras}
                checked={snapshot.nightmareMode}
                onChange={(e) => onToggleNightmare(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#ffcf8a] disabled:opacity-40 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-[#e6e2d8]/10 flex items-center justify-between gap-4">
              <label
                htmlFor="start-chapter-select"
                className="text-sm font-medium text-[#e6e2d8] whitespace-nowrap"
              >
                {UI_STRINGS.START_FROM_LABEL}
              </label>
              <select
                id="start-chapter-select"
                disabled={!unlockedExtras}
                value={snapshot.startChapter}
                onChange={(e) =>
                  onSelectChapter(Number(e.target.value) as ChapterStartOption)
                }
                className="bg-[#121512] border border-[#e6e2d8]/25 text-xs text-[#e6e2d8] px-2.5 py-1.5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#ffcf8a]"
              >
                <option value={1}>Chapter I — Hoyt–Schermerhorn</option>
                <option value={2}>Chapter II — Bedford–Nostrand (Practice)</option>
                <option value={3}>Chapter III — Nassau Av (Practice)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right column: Canonical How to Play Rules */}
        <div className="lg:col-span-6 max-w-lg border border-[#e6e2d8]/15 bg-[#090b09] p-5 space-y-3 pointer-events-auto">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-[#fff0d4]">
              {UI_STRINGS.HOW_TO_PLAY_1_TITLE}
            </h2>
            <p className="text-xs text-[#c8c3b8] leading-relaxed">
              {UI_STRINGS.HOW_TO_PLAY_1_BODY}{' '}
              <span className="text-[#ffcf8a] font-mono">F</span>. Flags are private.
            </p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#e6e2d8]/10">
            <h2 className="text-sm font-semibold text-[#fff0d4]">
              {UI_STRINGS.HOW_TO_PLAY_2_TITLE}
            </h2>
            <p className="text-xs text-[#c8c3b8] leading-relaxed">
              {UI_STRINGS.HOW_TO_PLAY_2_BODY}
            </p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#e6e2d8]/10">
            <h2 className="text-sm font-semibold text-[#fff0d4]">
              {UI_STRINGS.HOW_TO_PLAY_3_TITLE}
            </h2>
            <p className="text-xs text-[#c8c3b8] leading-relaxed">
              {UI_STRINGS.HOW_TO_PLAY_3_BODY}{' '}
              <span className="text-[#fff0d4] font-medium">
                {UI_STRINGS.DOORS_NEVER_LIE}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Flat inline control hint footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#9e9a90] border-t border-[#e6e2d8]/10 pt-3">
        <span>
          {UI_STRINGS.CONTROLS_BADGE} · Click in the train, then move the mouse (or use the
          arrow keys) · WASD Walk · F Flag · Esc or P Pause
        </span>
        <span className="font-mono tabular-nums">
          Hoyt–Schermerhorn → Court Sq · 13 Stops
        </span>
      </div>
    </div>
  );
};
