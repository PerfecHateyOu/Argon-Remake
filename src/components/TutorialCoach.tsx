import React from 'react';
import { TUTORIAL_STRINGS } from '../game/tutorial';
import type { TutorialState } from '../types';

interface TutorialCoachProps {
  tutorialState: TutorialState | null;
  onAdvanceStep: () => void;
  onFinishTutorial: () => void;
}

export const TutorialCoach: React.FC<TutorialCoachProps> = ({
  tutorialState,
  onAdvanceStep,
  onFinishTutorial,
}) => {
  if (!tutorialState) return null;

  return (
    <div
      data-testid="tutorial-coach-panel"
      className="border border-[#ffcf8a]/55 bg-[#080a08]/95 px-5 py-4 max-w-lg w-full space-y-3 pointer-events-auto select-none"
    >
      <div className="flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]">
        <span>
          Practice stretch · {tutorialState.stepNumber}/4 · {tutorialState.title}
        </span>
        <button
          type="button"
          data-testid="tutorial-skip-button"
          onClick={onFinishTutorial}
          className="text-[11px] font-mono text-[#c8c3b8] hover:text-[#fff0d4] underline cursor-pointer"
        >
          Start the ride
        </button>
      </div>

      <div className="text-sm font-semibold text-[#fff0d4] leading-snug">
        {tutorialState.body}
      </div>

      {tutorialState.stepId === 'read_the_doors' && (
        <div className="space-y-1.5 border-t border-[#e6e2d8]/15 pt-2 text-xs text-[#c8c3b8]">
          <div>
            <strong className="text-[#fff0d4]">{TUTORIAL_STRINGS.STEP_3_REAL_TITLE}:</strong>{' '}
            {TUTORIAL_STRINGS.STEP_3_REAL_BODY}
          </div>
          <div>
            <strong className="text-[#ffcf8a]">{TUTORIAL_STRINGS.STEP_3_FALSE_TITLE}:</strong>{' '}
            {TUTORIAL_STRINGS.STEP_3_FALSE_EARLY_BODY}{' '}
            {TUTORIAL_STRINGS.STEP_3_FALSE_FLICKER_BODY}
          </div>
          <div>
            <strong className="text-[#fff0d4]">{TUTORIAL_STRINGS.STEP_3_SUMMARY_TITLE}:</strong>{' '}
            {TUTORIAL_STRINGS.STEP_3_SUMMARY_BODY}
          </div>
        </div>
      )}

      {tutorialState.feedbackText && (
        <div
          data-testid="tutorial-feedback"
          className="text-xs italic text-[#8ad4a4] border-l-2 border-[#8ad4a4] pl-2.5"
        >
          {tutorialState.feedbackText}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] font-mono text-[#9e9a90]">{tutorialState.coachHint}</span>
        {tutorialState.stepId === 'ready' ? (
          <button
            type="button"
            data-testid="tutorial-start-ride-button"
            onClick={onFinishTutorial}
            className="px-4 py-2 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] cursor-pointer whitespace-nowrap"
          >
            Start the ride (or press Enter)
          </button>
        ) : (
          <button
            type="button"
            data-testid="tutorial-next-step-button"
            onClick={onAdvanceStep}
            className="px-3.5 py-1.5 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#fff0d4] hover:border-[#ffcf8a] cursor-pointer whitespace-nowrap"
          >
            Next step →
          </button>
        )}
      </div>
    </div>
  );
};

