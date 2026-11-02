import React from 'react';
import { gameEngine } from '../game/gameState';
import { formatRouteText } from '../game/routeText';
import type { EngineSnapshot, SegmentRule, SettingsState } from '../types';
import { TutorialCoach } from './TutorialCoach';

interface RidePromptsPanelProps {
  snapshot: EngineSnapshot;
  settings: SettingsState;
  currentSegment: SegmentRule;
}

export const RidePromptsPanel: React.FC<RidePromptsPanelProps> = ({
  snapshot,
  settings,
  currentSegment,
}) => {
  const isFinalStop = snapshot.phase === 'stop' && currentSegment.stopType === 'final';

  return (
    <div className="flex flex-col items-center gap-2.5 mx-auto max-w-2xl w-full">
      {/* Interactive Practice Stretch Tutorial Coach */}
      {snapshot.phase === 'intro' && snapshot.tutorialState && !snapshot.paused && (
        <TutorialCoach
          tutorialState={snapshot.tutorialState}
          onAdvanceStep={() => gameEngine.advanceTutorialStep()}
          onFinishTutorial={() => gameEngine.finishPracticeStretch()}
        />
      )}

      {/* Stop 11 Greenpoint Av Restraint Moment */}
      {snapshot.activeRestraint?.active && !snapshot.paused && (
        <div
          data-testid="restraint-panel"
          className="border border-[#ffcf8a]/60 bg-[#080a08]/95 px-5 py-4 max-w-md w-full space-y-3 pointer-events-auto"
        >
          <div className="flex items-center justify-between gap-4 text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]">
            <span>Restraint · Stop 11 (Greenpoint Av)</span>
            <span>
              {snapshot.activeRestraint.isHolding
                ? `Holding ${Math.round(snapshot.activeRestraint.holdProgress * 100)}%`
                : snapshot.activeRestraint.graceRemainingSec > 0
                  ? `Grace ${snapshot.activeRestraint.graceRemainingSec.toFixed(1)}s`
                  : `${Math.max(0, 5.0 - snapshot.activeRestraint.elapsedSec).toFixed(1)}s`}
            </span>
          </div>
          <div className="text-sm font-semibold text-[#fff0d4]">
            Hold Space. Don’t let go. Don’t react.
          </div>
          <div className="w-full h-1.5 bg-[#e6e2d8]/15 overflow-hidden">
            <div
              className="h-full bg-[#ffcf8a] transition-all duration-75"
              style={{
                width: `${Math.round(snapshot.activeRestraint.holdProgress * 100)}%`,
              }}
            />
          </div>
          <button
            type="button"
            data-testid="restraint-hold-button"
            onPointerDown={() => gameEngine.setRestraintHolding(true)}
            onPointerUp={() => gameEngine.setRestraintHolding(false)}
            onPointerLeave={() => gameEngine.setRestraintHolding(false)}
            onPointerCancel={() => gameEngine.setRestraintHolding(false)}
            className="min-h-[44px] min-w-[44px] w-full py-2.5 px-4 bg-[#fff0d4] text-[#040504] text-xs font-semibold uppercase tracking-wider hover:bg-[#ffcf8a] cursor-pointer select-none"
          >
            Hold steady (Space)
          </button>
        </div>
      )}

      {/* Stop 6 Safe Haven Panel */}
      {snapshot.phase === 'haven' && !snapshot.paused && (
        <div
          data-testid="safe-haven-panel"
          className="border border-[#ffcf8a]/50 bg-[#080a08]/95 px-5 py-4 max-w-md w-full space-y-3 pointer-events-auto"
        >
          <div className="flex items-center justify-between gap-4 text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]">
            <span>Safe Haven · {snapshot.currentStationName}</span>
            <span>+15 Sanity Restored</span>
          </div>
          <div className="text-xs text-[#e6e2d8] leading-relaxed">
            Dad hands you your grandfather’s microcassette recorder on the platform.{' '}
            <span className="text-[#ffcf8a] font-mono">
              Dad gave you a tape recorder. Press R to raise it.
            </span>
          </div>
          <button
            type="button"
            data-testid="haven-board-button"
            onClick={() => gameEngine.completeSafeHaven()}
            className="min-h-[44px] min-w-[44px] w-full py-2.5 px-4 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] cursor-pointer"
          >
            Get back on with them
          </button>
        </div>
      )}

      {/* False Stop Trial Room Panel (3-stage puzzle) */}
      {snapshot.phase === 'trial' && snapshot.trialState && !snapshot.paused && (
        <div
          data-testid="trial-room-panel"
          className="border border-[#ffcf8a]/55 bg-[#080a08]/95 px-5 py-4 max-w-md w-full space-y-3 pointer-events-auto"
        >
          <div className="flex items-center justify-between gap-4 text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]">
            <span>False Stop Trial · Stage {snapshot.trialState.stage}/3</span>
            <span>{snapshot.trialState.depth} loops deep</span>
          </div>
          <div className="text-xs text-[#c8c3b8]">
            Find the way back. The signs lie. Watch the lights when the chime plays.
          </div>
          {snapshot.trialState.feedbackText && (
            <div className="text-xs italic text-[#fff0d4]">
              {snapshot.trialState.feedbackText}
            </div>
          )}

          {snapshot.trialState.stage === 1 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                data-testid="trial-sign-terminus"
                onClick={() => gameEngine.chooseTrialOption('terminus_sign')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                1. {formatRouteText('To {terminusSign} trains', snapshot.activeRoute)}
              </button>
              <button
                type="button"
                data-testid="trial-sign-opposite"
                onClick={() => gameEngine.chooseTrialOption('opposite_sign')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                2. {formatRouteText('To {opposite} trains', snapshot.activeRoute)}
              </button>
            </div>
          )}

          {snapshot.trialState.stage === 2 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                data-testid="trial-stairs-left"
                onClick={() => gameEngine.chooseTrialOption('left_stairs')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                1. Left stairs
              </button>
              <button
                type="button"
                data-testid="trial-stairs-middle"
                onClick={() => gameEngine.chooseTrialOption('middle_stairs')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                2. Middle stairs
              </button>
              <button
                type="button"
                data-testid="trial-stairs-right"
                onClick={() => gameEngine.chooseTrialOption('right_stairs')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                3. Right stairs
              </button>
            </div>
          )}

          {snapshot.trialState.stage === 3 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                data-testid="trial-train-left"
                onClick={() => gameEngine.chooseTrialOption('left_train')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                1. Board the left train
              </button>
              <button
                type="button"
                data-testid="trial-train-right"
                onClick={() => gameEngine.chooseTrialOption('right_train')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                2. Board the right train
              </button>
            </div>
          )}
        </div>
      )}

      {/* Parent Mask Check Prompt (1 / 2 / 3) */}
      {snapshot.activeMaskCheck && !snapshot.paused && (
        <div
          data-testid="mask-check-panel"
          className="border border-[#ffcf8a]/50 bg-[#080a08]/95 px-5 py-3.5 max-w-md w-full space-y-2.5 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]">
            <span>{snapshot.activeMaskCheck.speakerLabel} asks you</span>
            <span>
              {Math.ceil(snapshot.activeMaskCheck.remainingSec)}s · Press 1, 2, or 3
            </span>
          </div>
          <div className="text-sm font-semibold text-[#fff0d4]">
            “{snapshot.activeMaskCheck.question}”
          </div>
          <div className="w-full h-1 bg-[#e6e2d8]/15 overflow-hidden">
            <div
              className="h-full bg-[#ffcf8a] transition-all duration-100"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (snapshot.activeMaskCheck.remainingSec /
                      snapshot.activeMaskCheck.totalSec) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-0.5">
            {snapshot.activeMaskCheck.options.map((opt, idx) => (
              <button
                key={opt.text}
                type="button"
                data-testid={`mask-option-${idx + 1}`}
                onClick={() => gameEngine.answerMaskCheck(idx as 0 | 1 | 2)}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] hover:text-[#fff0d4] text-left cursor-pointer"
              >
                <span className="font-mono text-[#ffcf8a] mr-2">{idx + 1}.</span>
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Station Stop Panel */}
      {snapshot.phase === 'stop' && !snapshot.paused && (
        <div
          data-testid="station-stop-panel"
          className="border border-[#e6e2d8]/30 bg-[#080a08]/92 px-5 py-3.5 max-w-md w-full space-y-2.5 pointer-events-auto"
        >
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]">
            <span>
              {snapshot.chimePlaying ? 'DOOR CHIME PLAYING' : 'PLATFORM DOORS OPEN'}
            </span>
            <span>
              {snapshot.isOpenAirStation
                ? 'ELEVATED PLATFORM'
                : `STOP ${currentSegment.stopNumber} OF 13`}
            </span>
          </div>

          <div className="text-sm font-semibold text-[#fff0d4]">
            {snapshot.currentStationName}
          </div>

          {isFinalStop ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="text-xs text-[#c8c3b8]">
                Here we are. {snapshot.currentStationName}. This is us. Come on, get up.
              </div>
              <button
                type="button"
                data-testid="exit-escalators"
                onClick={() => gameEngine.chooseCourtSqExit('escalators')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] text-left cursor-pointer"
              >
                1. Follow Mom and Dad to the escalators
              </button>
              <button
                type="button"
                data-testid="exit-lower-level"
                onClick={() => gameEngine.chooseCourtSqExit('lower_level')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                2. Follow the static down the side stairs
              </button>
              <button
                type="button"
                data-testid="exit-surface-hatch"
                onClick={() => gameEngine.chooseCourtSqExit('surface_hatch')}
                className="min-h-[44px] min-w-[44px] w-full py-2 px-3 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
              >
                3. Push through the emergency door
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-0.5">
              <button
                type="button"
                data-testid="stay-on-button"
                onClick={() => gameEngine.stayOnTrain()}
                className="min-h-[44px] min-w-[44px] flex-1 py-2 px-3 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] cursor-pointer whitespace-nowrap"
              >
                Stay on train
              </button>
              <button
                type="button"
                data-testid="step-off-button"
                onClick={() => gameEngine.stepOffTrain()}
                className="min-h-[44px] min-w-[44px] flex-1 py-2 px-3 border border-[#e6e2d8]/35 text-xs text-[#e6e2d8] hover:border-[#ffcf8a] cursor-pointer whitespace-nowrap"
              >
                Step off
              </button>
            </div>
          )}
        </div>
      )}

      {snapshot.subtitle && (
        <div
          data-testid="subtitle-banner"
          className="border border-[#e6e2d8]/25 bg-[#080a08]/92 px-4 py-2 text-sm text-[#f4f1ea] text-center space-x-1.5"
        >
          {snapshot.subtitle.stageDirection && (
            <em className="text-[#a8a398] italic">{snapshot.subtitle.stageDirection}</em>
          )}
          {snapshot.subtitle.speaker && (
            <b className="font-semibold text-[#ffcf8a]">{snapshot.subtitle.speaker}:</b>
          )}
          <span>{snapshot.subtitle.text}</span>
        </div>
      )}

      {settings.debugOverlay && (
        <div
          data-testid="debug-overlay"
          className="border border-[#ffcf8a]/40 bg-[#080a08]/95 px-3 py-1.5 text-[11px] font-mono tabular-nums text-[#ffcf8a]"
        >
          DEBUG RUN (NO SAVE) · Seg {snapshot.segmentId} ({snapshot.rideSubPhase}) · Tell:{' '}
          {snapshot.activeDoorTell} · Anom:{' '}
          {snapshot.activeAnomaly
            ? `${snapshot.activeAnomaly.id} (${
                snapshot.activeAnomaly.caught
                  ? 'caught'
                  : snapshot.activeAnomaly.manifested
                    ? 'manifested'
                    : 'waiting'
              })`
            : 'none'}{' '}
          · Caught: {snapshot.anomaliesCaughtCount}/{snapshot.anomaliesSpawnedCount} ·
          Sanity: {snapshot.sanity} ({snapshot.sanityTier}) · Susp: {snapshot.suspicion} (
          {snapshot.watchingParentLabel ?? 'none'})
        </div>
      )}

      {settings.showHints && (
        <div className="border border-[#e6e2d8]/15 bg-[#080a08]/85 px-4 py-1.5 text-xs text-[#c8c3b8]">
          Move the mouse to look. Hold F while looking at anything that changes. · 1/2/3
          Answer parents · WASD Walk between cars · L Switch route line · Esc or P Pause
        </div>
      )}
    </div>
  );
};
