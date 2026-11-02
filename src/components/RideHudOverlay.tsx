import React from 'react';
import { ROUTE_METADATA } from '../constants';
import { gameEngine } from '../game/gameState';
import { playerController } from '../input/keyLook';
import { pointerLock, type PointerLockState } from '../input/pointerLock';
import type { EngineSnapshot, SegmentRule, SettingsState } from '../types';
import { HeartbeatTrace } from './HeartbeatTrace';
import { MoveStick } from './MoveStick';
import { RidePromptsPanel } from './RidePromptsPanel';

interface RideHudOverlayProps {
  snapshot: EngineSnapshot;
  settings: SettingsState;
  lockState: PointerLockState;
  currentSegment: SegmentRule;
  onOpenRouteSelector: () => void;
  onCanvasClick: () => void;
}

export const RideHudOverlay: React.FC<RideHudOverlayProps> = ({
  snapshot,
  settings,
  lockState,
  currentSegment,
  onOpenRouteSelector,
  onCanvasClick,
}) => {
  const currentRoute = ROUTE_METADATA[snapshot.activeRoute];

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-5 pointer-events-none select-none">
      {/* Top Bar: Route & Station Status Chip + Parent Watching / Suspicion + Utility Buttons */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            data-testid="route-status-chip"
            aria-label={`${currentRoute.id} train, next stop ${snapshot.nextStationName}. Switch route line`}
            onClick={(e) => {
              e.currentTarget.blur();
              pointerLock.unlock({ quiet: true });
              onOpenRouteSelector();
            }}
            className="min-h-[44px] min-w-[44px] text-left border border-[#e6e2d8]/20 bg-[#080a08]/90 px-3.5 py-2 space-y-0.5 hover:border-[#fff0d4] pointer-events-auto cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#fff0d4]">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-[#040504]"
                style={{ backgroundColor: currentRoute.bulletColor }}
              >
                {currentRoute.id}
              </span>
              <span>
                {snapshot.phase === 'stop' || snapshot.phase === 'haven'
                  ? `At station: ${snapshot.currentStationName}`
                  : snapshot.phase === 'trial'
                    ? `False Stop Trial · Loop ${snapshot.trialState?.depth ?? 1}`
                    : `Next approaching station: ${snapshot.nextStationName}`}
              </span>
              {snapshot.isOnTrestle && (
                <span
                  data-testid="trestle-badge"
                  className="text-[10px] font-mono text-[#9ec4e8]"
                >
                  · NEWTOWN CREEK TRESTLE
                </span>
              )}
              {snapshot.nightmareMode && (
                <span className="text-[10px] font-mono text-[#ffcf8a]">· NIGHTMARE MODE</span>
              )}
            </div>
            <div
              data-testid="car-location-chip"
              className="text-[11px] text-[#9e9a90] font-mono tabular-nums"
            >
              {snapshot.carLocation} · Stop {currentSegment.stopNumber}/13 · Sanity Tier:{' '}
              {snapshot.sanityTier} · Suspicion: {snapshot.suspicion}/60 · {snapshot.fps} FPS
            </div>
          </button>

          <HeartbeatTrace sanityTier={snapshot.sanityTier} sanity={snapshot.sanity} />

          {snapshot.watchingParentLabel && (
            <div
              data-testid="parent-watching-chip"
              className="border border-[#ffcf8a]/45 bg-[#080a08]/92 px-3 py-1 text-[11px] font-mono tracking-wider text-[#ffcf8a] self-start"
            >
              {snapshot.watchingParentLabel.toUpperCase()} IS LOOKING AT YOU · ACT NORMAL
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            data-testid="camera-hud-button"
            aria-label="Polaroid Camera"
            onClick={(e) => {
              e.currentTarget.blur();
              gameEngine.toggleCamera();
            }}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 border text-xs font-mono cursor-pointer whitespace-nowrap ${
              snapshot.cameraOpen
                ? 'border-[#ffcf8a] bg-[#ffcf8a] text-[#080a08] font-semibold'
                : 'border-[#e6e2d8]/25 bg-[#080a08]/90 text-[#e6e2d8] hover:border-[#fff0d4]'
            }`}
          >
            Camera (C) · {snapshot.polaroidShotsRemaining}
          </button>
          {snapshot.hasRecorder && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="recorder-hud-badge"
              onClick={(e) => {
                e.currentTarget.blur();
                gameEngine.toggleEvpRecorder();
              }}
              className={`min-h-[44px] min-w-[44px] px-3 py-2 border text-xs font-mono cursor-pointer whitespace-nowrap ${
                snapshot.evpOpen
                  ? 'border-[#ffcf8a] bg-[#ffcf8a] text-[#080a08] font-semibold'
                  : 'border-[#ffcf8a]/40 bg-[#080a08]/90 text-[#ffcf8a] hover:border-[#ffcf8a]'
              }`}
            >
              Tape recorder (R)
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            data-testid="evidence-log-hud-button"
            aria-label="Evidence Log"
            onClick={(e) => {
              e.currentTarget.blur();
              gameEngine.toggleAlbum();
            }}
            className="min-h-[44px] min-w-[44px] px-3 py-2 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
          >
            Evidence log (Tab)
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              pointerLock.unlock({ quiet: true });
              onOpenRouteSelector();
            }}
            className="min-h-[44px] min-w-[44px] px-3 py-2 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
          >
            Route lines (L)
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              gameEngine.toggleMute();
            }}
            className="min-h-[44px] min-w-[44px] px-3 py-2 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
          >
            {snapshot.muted ? 'Sound off (M)' : 'Sound on (M)'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              gameEngine.togglePause();
            }}
            className="min-h-[44px] min-w-[44px] px-3 py-2 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
          >
            Pause (Esc or P)
          </button>
        </div>
      </div>

      {/* Center Prompts: Gangway Door, Flag Hold Progress & Pointer Lock Capture Hint */}
      <div className="flex flex-col items-center gap-3 my-auto">
        {snapshot.nearGangwayDoor && (
          <div
            data-testid="gangway-door-prompt"
            className="border border-[#ffcf8a]/40 bg-[#080a08]/90 px-3.5 py-1 text-xs font-mono tracking-wider text-[#ffcf8a]"
          >
            PUSH GANGWAY DOOR · GANGWAY COUPLING
          </div>
        )}

        {snapshot.flagHoldProgress > 0 && (
          <div
            data-testid="flag-hold-indicator"
            className="border border-[#ffcf8a]/60 bg-[#080a08]/92 px-4 py-1.5 space-y-1 min-w-44"
          >
            <div className="flex items-center justify-between gap-4 text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]">
              <span>Flag: hold to catch</span>
              <span>{Math.round(snapshot.flagHoldProgress * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#e6e2d8]/15 overflow-hidden">
              <div
                className="h-full bg-[#ffcf8a]"
                style={{ width: `${Math.round(snapshot.flagHoldProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {lockState.errorHint && !snapshot.paused && snapshot.phase === 'ride' && (
          <button
            type="button"
            data-testid="pointer-lock-hint"
            onClick={onCanvasClick}
            className="min-h-[44px] min-w-[44px] border border-[#e6e2d8]/25 bg-[#080a08]/90 px-4 py-2 text-xs text-[#fff0d4] hover:border-[#ffcf8a] pointer-events-auto cursor-pointer"
          >
            {lockState.errorHint}
          </button>
        )}
      </div>

      {/* Bottom Controls: WALK Stick, Prompts Panel, and FLAG Button */}
      <div className="flex items-end justify-between gap-4">
        <MoveStick onMove={(x, y) => playerController.setMoveStickInput(x, y)} />

        <RidePromptsPanel
          snapshot={snapshot}
          settings={settings}
          currentSegment={currentSegment}
        />

        {/* On-screen FLAG button (touch & mouse accessible, holds for 0.7 s, ≥44x44px) */}
        <div className="flex flex-col items-end gap-1 shrink-0 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            data-testid="flag-button"
            aria-label="Flag: hold to catch"
            onPointerDown={(e) => {
              e.stopPropagation();
              gameEngine.setFlagHolding(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              gameEngine.setFlagHolding(false);
            }}
            onPointerLeave={() => gameEngine.setFlagHolding(false)}
            onPointerCancel={() => gameEngine.setFlagHolding(false)}
            className="min-h-[44px] min-w-[44px] relative overflow-hidden px-3.5 py-2.5 border border-[#e6e2d8]/30 bg-[#080a08]/92 text-xs font-mono uppercase tracking-wider text-[#fff0d4] hover:border-[#ffcf8a] cursor-pointer select-none whitespace-nowrap"
          >
            <span
              className="absolute inset-y-0 left-0 bg-[#ffcf8a]/25 pointer-events-none"
              style={{ width: `${Math.round(snapshot.flagHoldProgress * 100)}%` }}
            />
            <span className="relative z-10">Flag (F) · hold to catch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
