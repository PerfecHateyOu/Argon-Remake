import React, { useEffect } from 'react';
import { UI_STRINGS } from '../constants';
import type { ChapterStartOption, EngineSnapshot, ProgressArchive } from '../types';

interface StartScreenProps {
  snapshot: EngineSnapshot;
  archive: ProgressArchive;
  onBoard: () => void;
  onPracticeStretch: () => void;
  onToggleNightmare: (enabled: boolean) => void;
  onSelectChapter: (chapter: ChapterStartOption) => void;
  onOpenSettings: () => void;
  onOpenCaseFiles: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  snapshot,
  archive,
  onBoard,
  onPracticeStretch,
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
      className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 md:p-10 pointer-events-none select-none overflow-hidden"
      style={{
        background:
          'linear-gradient(90deg, rgba(7,9,7,0.92) 0%, rgba(7,9,7,0.74) 50%, rgba(7,9,7,0.28) 100%)',
      }}
    >
      {/* Responsive Two-Column Start Card (.start-card, .start-actions, .start-brief) */}
      <div className="start-card max-w-6xl w-full mx-auto my-auto pointer-events-auto">
        {/* Left column on ≥640px: Title & Action Buttons (.start-actions) */}
        <div className="start-actions">
          <div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#fff0d4] mb-1">
              {UI_STRINGS.TITLE}
            </h1>
            <p className="text-xs sm:text-sm text-[#c8c3b8] leading-snug max-w-md">
              {UI_STRINGS.DESCRIPTION}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onBoard();
              }}
              className="min-h-[44px] min-w-[44px] px-4 sm:px-6 py-2.5 bg-[#fff0d4] text-[#070907] font-semibold text-sm sm:text-base tracking-wide hover:bg-[#ffcf8a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf8a] transition-colors cursor-pointer whitespace-nowrap"
            >
              Board train
            </button>

            <button
              type="button"
              data-testid="practice-stretch-button"
              onClick={(e) => {
                e.currentTarget.blur();
                onPracticeStretch();
              }}
              className="min-h-[44px] min-w-[44px] px-3.5 sm:px-4 py-2.5 border border-[#ffcf8a]/40 bg-[#0a0d0b] text-[#ffcf8a] text-xs sm:text-sm font-medium hover:border-[#ffcf8a] hover:text-[#fff0d4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf8a] transition-colors cursor-pointer whitespace-nowrap"
            >
              Practice stretch
            </button>

            <button
              type="button"
              data-testid="settings-button"
              onClick={onOpenSettings}
              className="min-h-[44px] min-w-[44px] px-3.5 sm:px-4 py-2.5 border border-[#ece7db]/30 bg-[#0a0d0b] text-[#ece7db] text-xs sm:text-sm font-medium hover:border-[#fff0d4] hover:text-[#fff0d4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf8a] transition-colors cursor-pointer whitespace-nowrap"
            >
              Settings
            </button>

            <button
              type="button"
              data-testid="case-files-button"
              onClick={onOpenCaseFiles}
              className="min-h-[44px] min-w-[44px] px-3.5 sm:px-4 py-2.5 border border-[#ece7db]/30 bg-[#0a0d0b] text-[#ece7db] text-xs sm:text-sm font-medium hover:border-[#fff0d4] hover:text-[#fff0d4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcf8a] transition-colors cursor-pointer whitespace-nowrap"
            >
              Case Files
            </button>
          </div>

          {/* Nightmare Mode & Chapter Select */}
          <div className="border border-[#ece7db]/15 bg-[#070907]/90 p-2.5 sm:p-3.5 space-y-2">
            {!unlockedExtras && (
              <p className="text-[11px] text-[#9e9a90] leading-tight">
                {UI_STRINGS.UNLOCK_HINT}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="nightmare-toggle"
                  className="text-xs sm:text-sm font-medium text-[#ece7db] block leading-tight"
                >
                  {UI_STRINGS.NIGHTMARE_LABEL}
                </label>
                <p className="text-[11px] text-[#9e9a90] leading-tight">
                  {UI_STRINGS.NIGHTMARE_DESC}
                </p>
              </div>
              <input
                id="nightmare-toggle"
                type="checkbox"
                disabled={!unlockedExtras}
                checked={snapshot.nightmareMode}
                onChange={(e) => onToggleNightmare(e.target.checked)}
                className="h-5 w-5 accent-[#ffcf8a] disabled:opacity-40 cursor-pointer shrink-0"
              />
            </div>

            <div className="pt-1.5 border-t border-[#ece7db]/10 flex items-center justify-between gap-2">
              <label
                htmlFor="start-chapter-select"
                className="text-xs sm:text-sm font-medium text-[#ece7db] whitespace-nowrap"
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
                className="min-h-[36px] bg-[#121512] border border-[#ece7db]/25 text-xs text-[#ece7db] px-2 py-1 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#ffcf8a]"
              >
                <option value={1}>Chapter I — Hoyt–Schermerhorn</option>
                <option value={2}>Chapter II — Bedford–Nostrand (Practice)</option>
                <option value={3}>Chapter III — Nassau Av (Practice)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right column on ≥640px: Station Plaque & Briefing Text (.start-brief) */}
        <div className="start-brief border border-[#ece7db]/15 bg-[#070907]/90 p-3 sm:p-4">
          <div className="inline-flex items-center gap-2.5 border border-[#ece7db]/20 bg-[#0a0d0b] px-3 py-1.5 self-start">
            <svg
              width="24"
              height="24"
              viewBox="0 0 28 28"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="14" cy="14" r="13" fill="#6cbe45" />
              <text
                x="14"
                y="19"
                textAnchor="middle"
                fill="#070907"
                fontFamily="sans-serif"
                fontWeight="800"
                fontSize="16"
              >
                G
              </text>
            </svg>
            <div className="flex flex-col">
              <span className="text-[10px] tracking-[0.16em] text-[#ffcf8a] font-mono leading-tight">
                {UI_STRINGS.SUBTITLE_GENRE}
              </span>
              <span className="text-xs font-semibold tracking-wider text-[#ece7db] leading-tight">
                {UI_STRINGS.SUBTITLE_DEST}
              </span>
            </div>
          </div>

          <div className="space-y-0.5 pt-1 border-t border-[#ece7db]/10">
            <h2 className="text-xs sm:text-sm font-semibold text-[#fff0d4]">
              {UI_STRINGS.HOW_TO_PLAY_1_TITLE}
            </h2>
            <p className="text-[11px] sm:text-xs text-[#c8c3b8] leading-snug">
              {UI_STRINGS.HOW_TO_PLAY_1_BODY}{' '}
              <span className="text-[#ffcf8a] font-mono">F</span>. Flags are private.
            </p>
          </div>

          <div className="space-y-0.5 pt-1.5 border-t border-[#ece7db]/10">
            <h2 className="text-xs sm:text-sm font-semibold text-[#fff0d4]">
              {UI_STRINGS.HOW_TO_PLAY_2_TITLE}
            </h2>
            <p className="text-[11px] sm:text-xs text-[#c8c3b8] leading-snug">
              {UI_STRINGS.HOW_TO_PLAY_2_BODY}
            </p>
          </div>

          <div className="space-y-0.5 pt-1.5 border-t border-[#ece7db]/10">
            <h2 className="text-xs sm:text-sm font-semibold text-[#fff0d4]">
              {UI_STRINGS.HOW_TO_PLAY_3_TITLE}
            </h2>
            <p className="text-[11px] sm:text-xs text-[#c8c3b8] leading-snug">
              {UI_STRINGS.HOW_TO_PLAY_3_BODY}{' '}
              <span className="text-[#fff0d4] font-medium">
                {UI_STRINGS.DOORS_NEVER_LIE}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Flat inline control hint footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9e9a90] border-t border-[#ece7db]/10 pt-2">
        <span className="truncate max-w-full">
          {UI_STRINGS.CONTROLS_BADGE} · Click in the train, then move the mouse (or use the
          arrow keys) · WASD Walk · F Flag · Esc or P Pause
        </span>
        <span className="font-mono tabular-nums hidden sm:inline">
          Hoyt–Schermerhorn → Court Sq · 13 Stops
        </span>
      </div>
    </div>
  );
};
