import { useEffect, useRef, useState } from 'react';
import { AnalogRollsign } from './components/AnalogRollsign';
import { MoveStick } from './components/MoveStick';
import { RouteSelector } from './components/RouteSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { StartScreen } from './components/StartScreen';
import { ROUTE_METADATA } from './constants';
import { gameEngine } from './game/gameState';
import { PSYCH_IDS, resolvePsychLogCatalog } from './game/psychLog';
import { SceneRenderer } from './graphics/sceneRenderer';
import { playerController } from './input/keyLook';
import { pointerLock, type PointerLockState } from './input/pointerLock';
import { settingsStore } from './settings';
import type { EngineSnapshot, ProgressArchive, SettingsState } from './types';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);

  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => gameEngine.getSnapshot());
  const [settings, setSettings] = useState<SettingsState>(() => settingsStore.get());
  const [archive, setArchive] = useState<ProgressArchive>(() => settingsStore.getArchive());
  const [lockState, setLockState] = useState<PointerLockState>(() => pointerLock.getState());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [caseFilesOpen, setCaseFilesOpen] = useState(false);
  const [routeSelectorOpen, setRouteSelectorOpen] = useState(false);

  // Subscribe to engine, settings, and pointerLock stores first
  useEffect(() => {
    const unsubEngine = gameEngine.subscribe(setSnapshot);
    const unsubSettings = settingsStore.subscribe(setSettings);
    const unsubArchive = settingsStore.subscribeArchive(setArchive);
    const unsubLock = pointerLock.subscribe(setLockState);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      gameEngine.startRide();
    }

    return () => {
      unsubEngine();
      unsubSettings();
      unsubArchive();
      unsubLock();
    };
  }, []);

  // Mount Three.js WebGLRenderer once in an isolated container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const sceneRenderer = new SceneRenderer(container);
    rendererRef.current = sceneRenderer;
    sceneRenderer.start();

    return () => {
      sceneRenderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Global keyboard shortcuts (P/Esc pause, M mute, L route selector, E step off at stop, F flag hold, 1/2/3 mask check, ` debug overlay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen || caseFilesOpen || routeSelectorOpen) {
        if (e.key === 'Escape') {
          setSettingsOpen(false);
          setCaseFilesOpen(false);
          setRouteSelectorOpen(false);
        }
        return;
      }

      if (e.key === '`') {
        settingsStore.update({ debugOverlay: !settingsStore.get().debugOverlay });
        return;
      }

      if (
        (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') &&
        snapshot.phase === 'ride' &&
        !snapshot.paused
      ) {
        e.preventDefault();
        gameEngine.setFlagHolding(true);
        return;
      }

      // 1 / 2 / 3 keys for Mask Check responses (or final stop Court Sq choice)
      if (!snapshot.paused && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const idx = (Number(e.key) - 1) as 0 | 1 | 2;
        if (snapshot.activeMaskCheck) {
          e.preventDefault();
          gameEngine.answerMaskCheck(idx);
          return;
        }
        const seg = gameEngine.getCurrentSegmentRule();
        if (snapshot.phase === 'stop' && seg.stopType === 'final') {
          e.preventDefault();
          const exitChoices = ['escalators', 'lower_level', 'surface_hatch'] as const;
          gameEngine.chooseCourtSqExit(exitChoices[idx]);
          return;
        }
        if (snapshot.phase === 'ride') {
          gameEngine.answerMaskCheck(idx);
          return;
        }
      }

      if (e.key === 'm' || e.key === 'M') {
        gameEngine.toggleMute();
      } else if (
        (e.key === 'l' || e.key === 'L') &&
        snapshot.phase !== 'menu' &&
        snapshot.phase !== 'end'
      ) {
        pointerLock.unlock({ quiet: true });
        setRouteSelectorOpen(true);
      } else if (
        (e.key === 'e' || e.key === 'E') &&
        snapshot.phase === 'stop' &&
        !snapshot.paused
      ) {
        gameEngine.stepOffTrain();
      } else if (
        (e.key === 'p' || e.key === 'P' || e.key === 'Escape') &&
        snapshot.phase !== 'menu' &&
        snapshot.phase !== 'end'
      ) {
        gameEngine.togglePause();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') {
        gameEngine.setFlagHolding(false);
      }
    };

    const handleBlur = () => {
      gameEngine.setFlagHolding(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    settingsOpen,
    caseFilesOpen,
    routeSelectorOpen,
    snapshot.phase,
    snapshot.paused,
    snapshot.activeMaskCheck,
  ]);

  const handleCanvasClick = () => {
    if (
      snapshot.phase === 'menu' ||
      snapshot.phase === 'end' ||
      snapshot.paused ||
      settingsOpen ||
      caseFilesOpen ||
      routeSelectorOpen
    ) {
      return;
    }
    const canvas = rendererRef.current?.getCanvas();
    if (canvas && !pointerLock.isLocked()) {
      void pointerLock.lock(canvas);
    }
  };

  const currentRoute = ROUTE_METADATA[snapshot.activeRoute];
  const currentSegment = gameEngine.getCurrentSegmentRule();
  const isFinalStop = snapshot.phase === 'stop' && currentSegment.stopType === 'final';

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#040504] text-[#e6e2d8]">
      {/* Dedicated Three.js Canvas Mount (isolated from React HUD re-renders) */}
      <div
        ref={canvasMountRef}
        onClick={handleCanvasClick}
        className="fixed inset-0 z-0 w-full h-full cursor-crosshair"
      />

      {/* Start Screen Overlay */}
      {snapshot.phase === 'menu' && (
        <StartScreen
          snapshot={snapshot}
          archive={archive}
          onBoard={() => {
            gameEngine.startRide();
            const canvas = rendererRef.current?.getCanvas();
            if (canvas) {
              void pointerLock.lock(canvas);
            }
          }}
          onToggleNightmare={(enabled) => gameEngine.setNightmareMode(enabled)}
          onSelectChapter={(chapter) => gameEngine.setStartChapter(chapter)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCaseFiles={() => setCaseFilesOpen(true)}
        />
      )}

      {/* Analog Rollsign Chapter Banner */}
      {snapshot.phase !== 'menu' && snapshot.phase !== 'end' && (
        <AnalogRollsign rollsign={snapshot.rollsign} activeRoute={snapshot.activeRoute} />
      )}

      {/* Paranoid UI Word Flash (Low/Critical Sanity) */}
      {snapshot.paranoidFlashText && snapshot.phase !== 'menu' && snapshot.phase !== 'end' && (
        <div
          data-testid="paranoid-flash-banner"
          className="fixed inset-x-0 top-1/3 z-20 flex justify-center pointer-events-none select-none"
        >
          <span className="px-4 py-1 bg-[#080a08]/85 border border-[#ffcf8a]/40 text-sm font-mono uppercase tracking-[0.25em] text-[#ffcf8a]">
            {snapshot.paranoidFlashText}
          </span>
        </div>
      )}

      {/* In-Ride & Station Stop HUD */}
      {snapshot.phase !== 'menu' && snapshot.phase !== 'end' && (
        <div className="fixed inset-0 z-10 flex flex-col justify-between p-5 pointer-events-none select-none">
          {/* Top Bar: Route & Station Status Chip + Parent Watching / Suspicion + Utility Buttons */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                data-testid="route-status-chip"
                aria-label={`${currentRoute.id} train, next stop ${snapshot.nextStationName}. Switch route line`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  pointerLock.unlock({ quiet: true });
                  setRouteSelectorOpen(true);
                }}
                className="text-left border border-[#e6e2d8]/20 bg-[#080a08]/90 px-3.5 py-2 space-y-0.5 hover:border-[#fff0d4] pointer-events-auto cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#fff0d4]">
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-[#040504]"
                    style={{ backgroundColor: currentRoute.bulletColor }}
                  >
                    {currentRoute.id}
                  </span>
                  <span>
                    {snapshot.phase === 'stop'
                      ? `At station: ${snapshot.currentStationName}`
                      : `Next approaching station: ${snapshot.nextStationName}`}
                  </span>
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

              {snapshot.watchingParentLabel && (
                <div
                  data-testid="parent-watching-chip"
                  className="border border-[#ffcf8a]/45 bg-[#080a08]/92 px-3 py-1 text-[11px] font-mono tracking-wider text-[#ffcf8a] self-start"
                >
                  {snapshot.watchingParentLabel.toUpperCase()} IS LOOKING AT YOU · ACT NORMAL
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  pointerLock.unlock({ quiet: true });
                  setRouteSelectorOpen(true);
                }}
                className="px-3 py-1.5 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
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
                className="px-3 py-1.5 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
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
                className="px-3 py-1.5 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
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
                onClick={handleCanvasClick}
                className="border border-[#e6e2d8]/25 bg-[#080a08]/90 px-4 py-2 text-xs text-[#fff0d4] hover:border-[#ffcf8a] pointer-events-auto cursor-pointer"
              >
                {lockState.errorHint}
              </button>
            )}
          </div>

          {/* Bottom Controls: WALK Stick, Mask Check Prompt, Station Stop Decision, Subtitles, Debug Overlay, Hint Strip, and FLAG Button */}
          <div className="flex items-end justify-between gap-4">
            <MoveStick onMove={(x, y) => playerController.setMoveStickInput(x, y)} />

            <div className="flex flex-col items-center gap-2.5 mx-auto max-w-2xl w-full">
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
                        className="w-full py-1.5 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] hover:text-[#fff0d4] text-left cursor-pointer"
                      >
                        <span className="font-mono text-[#ffcf8a] mr-2">{idx + 1}.</span>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                        className="w-full py-2 px-3 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] text-left cursor-pointer"
                      >
                        1. Follow Mom and Dad to the escalators
                      </button>
                      <button
                        type="button"
                        data-testid="exit-lower-level"
                        onClick={() => gameEngine.chooseCourtSqExit('lower_level')}
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
                      >
                        2. Follow the static down the side stairs
                      </button>
                      <button
                        type="button"
                        data-testid="exit-surface-hatch"
                        onClick={() => gameEngine.chooseCourtSqExit('surface_hatch')}
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
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
                        className="flex-1 py-2 px-3 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] cursor-pointer whitespace-nowrap"
                      >
                        Stay on train
                      </button>
                      <button
                        type="button"
                        data-testid="step-off-button"
                        onClick={() => gameEngine.stepOffTrain()}
                        className="flex-1 py-2 px-3 border border-[#e6e2d8]/35 text-xs text-[#e6e2d8] hover:border-[#ffcf8a] cursor-pointer whitespace-nowrap"
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

            {/* On-screen FLAG button (touch & mouse accessible, holds for 0.7 s) */}
            <div className="flex flex-col items-end gap-1 shrink-0 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                data-testid="flag-button"
                aria-label="Flag: hold to catch"
                onPointerDown={() => gameEngine.setFlagHolding(true)}
                onPointerUp={() => gameEngine.setFlagHolding(false)}
                onPointerLeave={() => gameEngine.setFlagHolding(false)}
                onPointerCancel={() => gameEngine.setFlagHolding(false)}
                className="relative overflow-hidden px-3.5 py-2.5 border border-[#e6e2d8]/30 bg-[#080a08]/92 text-xs font-mono uppercase tracking-wider text-[#fff0d4] hover:border-[#ffcf8a] cursor-pointer select-none whitespace-nowrap"
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
      )}

      {/* End of Ride Summary Overlay (Milestone 3 arrival; expanded to full ReportScreen in Milestone 8) */}
      {snapshot.phase === 'end' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ride Complete"
          data-testid="end-screen"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#040504]/90 pointer-events-auto"
        >
          <div className="w-full max-w-lg border border-[#e6e2d8]/25 bg-[#0b0d0b] p-6 space-y-4">
            <div className="text-xs font-mono uppercase tracking-widest text-[#ffcf8a]">
              [TERMINUS REACHED · {snapshot.currentStationName.toUpperCase()}]
            </div>
            <h2 className="text-xl font-bold text-[#fff0d4]">
              Here we are. {snapshot.currentStationName}.
            </h2>
            {snapshot.subtitle && (
              <p className="text-sm italic text-[#c8c3b8]">{snapshot.subtitle.text}</p>
            )}
            <div className="border-t border-[#e6e2d8]/15 pt-3 text-xs font-mono text-[#9e9a90] space-y-1">
              <div>Route Line: {currentRoute.name}</div>
              <div>
                Final Sanity: {snapshot.sanity} ({snapshot.sanityTier})
              </div>
              <div>Peak Suspicion: {snapshot.peakSuspicion}</div>
              <div>
                Anomalies Caught: {snapshot.anomaliesCaughtCount} of{' '}
                {snapshot.anomaliesSpawnedCount}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="play-again-button"
                onClick={() => gameEngine.startRide()}
                className="flex-1 py-2.5 bg-[#fff0d4] text-[#040504] text-sm font-semibold hover:bg-[#ffcf8a] cursor-pointer"
              >
                Ride again
              </button>
              <button
                type="button"
                data-testid="return-title-button"
                onClick={() => gameEngine.returnToMenu()}
                className="flex-1 py-2.5 border border-[#e6e2d8]/30 text-sm text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
              >
                Return to title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {snapshot.paused && snapshot.phase !== 'menu' && snapshot.phase !== 'end' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Paused"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#040504]/85 pointer-events-auto"
        >
          <div className="w-full max-w-sm border border-[#e6e2d8]/25 bg-[#0b0d0b] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#fff0d4]">Ride Paused</h2>
            <p className="text-xs text-[#9e9a90]">
              {currentRoute.name} · {snapshot.carLocation} · Next stop: {snapshot.nextStationName}
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  gameEngine.togglePause(false);
                  const canvas = rendererRef.current?.getCanvas();
                  if (canvas) {
                    void pointerLock.lock(canvas);
                  }
                }}
                className="w-full py-2.5 bg-[#fff0d4] text-[#040504] text-sm font-semibold hover:bg-[#ffcf8a] cursor-pointer"
              >
                Resume ride
              </button>
              <button
                type="button"
                onClick={() => setRouteSelectorOpen(true)}
                className="w-full py-2.5 border border-[#e6e2d8]/30 text-sm text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
              >
                Switch route line (L)
              </button>
              <button
                type="button"
                onClick={() => setCaseFilesOpen(true)}
                className="w-full py-2.5 border border-[#e6e2d8]/30 text-sm text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
              >
                Case Files
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="w-full py-2.5 border border-[#e6e2d8]/30 text-sm text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => gameEngine.returnToMenu()}
                className="w-full py-2.5 border border-[#e6e2d8]/30 text-sm text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
              >
                Return to title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Selector Modal */}
      {routeSelectorOpen && (
        <RouteSelector
          activeRoute={snapshot.activeRoute}
          onSelectRoute={(route) => {
            gameEngine.setActiveRoute(route);
            setRouteSelectorOpen(false);
          }}
          onClose={() => setRouteSelectorOpen(false)}
        />
      )}

      {/* Case Files Modal (Psych Log Anomalies Catalog) */}
      {caseFilesOpen &&
        (() => {
          const psychCatalog = resolvePsychLogCatalog(archive, snapshot.rideAnomalies);
          const hasAnyWitnessed =
            psychCatalog.documentedCount > 0 || psychCatalog.unconfirmedCount > 0;
          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Case Files"
              data-testid="case-files-modal"
              className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#040504]/90 pointer-events-auto"
            >
              <div className="w-full max-w-2xl max-h-[85vh] flex flex-col border border-[#e6e2d8]/25 bg-[#0b0d0b] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#e6e2d8]/15 pb-3 shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold text-[#fff0d4]">Case Files</h2>
                    <div className="text-xs font-mono text-[#ffcf8a]">
                      {psychCatalog.documentedCount} of {PSYCH_IDS.length} documented,{' '}
                      {psychCatalog.unconfirmedCount} unconfirmed
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="close-case-files-button"
                    onClick={() => setCaseFilesOpen(false)}
                    className="px-3 py-1.5 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
                  >
                    Close Case Files
                  </button>
                </div>

                {!hasAnyWitnessed && (
                  <p className="text-sm text-[#c8c3b8]">
                    Nothing witnessed yet. Anomalies you see on a ride are filed here.
                  </p>
                )}

                <div className="overflow-y-auto space-y-2.5 pr-1">
                  {psychCatalog.entries.map((entry) => {
                    const { definition, status } = entry;
                    const isDoc = status === 'DOCUMENTED';
                    const isUnconf = status === 'UNCONFIRMED';
                    return (
                      <div
                        key={definition.id}
                        data-testid={`psych-entry-${definition.id}`}
                        className="border border-[#e6e2d8]/15 bg-[#080a08] p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-[#fff0d4]">
                            {isDoc || isUnconf ? (
                              <>
                                #{definition.index} · {definition.title}{' '}
                                <span className="font-mono text-[#9e9a90]">
                                  (Class {definition.psychClass})
                                </span>
                              </>
                            ) : (
                              <span className="text-[#9e9a90]">
                                #{definition.index} · Class {definition.psychClass}, not yet
                                witnessed
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${
                              isDoc
                                ? 'border-[#ffcf8a]/60 text-[#ffcf8a] bg-[#ffcf8a]/10'
                                : isUnconf
                                  ? 'border-[#e6e2d8]/30 text-[#c8c3b8]'
                                  : 'border-[#e6e2d8]/15 text-[#78746c]'
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        {isDoc && (
                          <p className="text-xs text-[#c8c3b8] leading-relaxed">
                            {definition.caseFileNote}
                          </p>
                        )}
                        {isUnconf && (
                          <p className="text-xs italic text-[#9e9a90]">
                            Seen, not flagged in time.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Settings Panel Modal */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          archive={archive}
          onUpdate={(patch) => settingsStore.update(patch)}
          onEraseProgress={() => settingsStore.eraseSavedProgress()}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
