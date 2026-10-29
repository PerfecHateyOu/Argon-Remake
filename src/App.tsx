import { useEffect, useRef, useState } from 'react';
import { AnalogRollsign } from './components/AnalogRollsign';
import { CaseFilesModal } from './components/CaseFilesModal';
import { EvpRecorder } from './components/EvpRecorder';
import { HeartbeatTrace } from './components/HeartbeatTrace';
import { MoveStick } from './components/MoveStick';
import { PolaroidAlbum } from './components/PolaroidAlbum';
import { PolaroidViewfinder } from './components/PolaroidViewfinder';
import { ReportScreen } from './components/ReportScreen';
import { RouteSelector } from './components/RouteSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { StartScreen } from './components/StartScreen';
import { TutorialCoach } from './components/TutorialCoach';
import { ROUTE_METADATA } from './constants';
import { gameEngine } from './game/gameState';
import { formatRouteText } from './game/routeText';
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

  // Global keyboard shortcuts (P/Esc pause, M mute, L route selector, E step off at stop, F flag hold, Space restraint hold, 1/2/3 mask check/trial/exit, ` debug overlay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen || caseFilesOpen || routeSelectorOpen || snapshot.albumOpen) {
        if (e.key === 'Escape' || (e.key === 'Tab' && snapshot.albumOpen)) {
          e.preventDefault();
          setSettingsOpen(false);
          setCaseFilesOpen(false);
          setRouteSelectorOpen(false);
          if (snapshot.albumOpen) {
            gameEngine.toggleAlbum(false);
          }
        }
        return;
      }

      if (e.key === '`') {
        settingsStore.update({ debugOverlay: !settingsStore.get().debugOverlay });
        return;
      }

      if (e.key === 'Tab' && snapshot.phase !== 'menu') {
        e.preventDefault();
        gameEngine.toggleAlbum();
        return;
      }

      if (
        (e.code === 'Space' || e.key === ' ') &&
        snapshot.activeRestraint?.active &&
        !snapshot.paused
      ) {
        e.preventDefault();
        gameEngine.setRestraintHolding(true);
        return;
      }

      if ((e.code === 'Space' || e.key === ' ') && snapshot.evpOpen && !snapshot.paused) {
        e.preventDefault();
        gameEngine.setEvpRecording(true);
        return;
      }

      if ((e.code === 'Space' || e.key === ' ') && snapshot.cameraOpen && !snapshot.paused) {
        e.preventDefault();
        if (!e.repeat) {
          gameEngine.snapPolaroidPhoto(rendererRef.current?.getCanvas());
        }
        return;
      }

      if (snapshot.evpOpen && !snapshot.paused) {
        if (e.key === '[') {
          e.preventDefault();
          gameEngine.stepEvpFrequency(-1);
          return;
        }
        if (e.key === ']') {
          e.preventDefault();
          gameEngine.stepEvpFrequency(1);
          return;
        }
      }

      if (
        (e.key === 'c' || e.key === 'C' || e.code === 'KeyC') &&
        snapshot.phase !== 'menu' &&
        snapshot.phase !== 'end' &&
        !snapshot.paused &&
        !e.repeat
      ) {
        e.preventDefault();
        gameEngine.toggleCamera();
        return;
      }

      if (
        (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') &&
        snapshot.phase !== 'menu' &&
        snapshot.phase !== 'end' &&
        !snapshot.paused &&
        !e.repeat
      ) {
        e.preventDefault();
        gameEngine.toggleEvpRecorder();
        return;
      }

      if (
        (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') &&
        (snapshot.phase === 'ride' || snapshot.phase === 'intro') &&
        !snapshot.paused
      ) {
        e.preventDefault();
        if (snapshot.activeRestraint?.active) {
          gameEngine.showSubtitle({ text: 'Not now. Keep holding.' }, 2.0);
          return;
        }
        if (snapshot.activeMaskCheck) {
          gameEngine.showSubtitle({ text: 'Answer first.' }, 2.0);
          return;
        }
        gameEngine.setFlagHolding(true);
        return;
      }

      if (e.key === 'Enter' && snapshot.phase === 'intro' && !snapshot.paused) {
        e.preventDefault();
        if (snapshot.tutorialState?.stepId === 'ready') {
          gameEngine.finishPracticeStretch();
        } else {
          gameEngine.advanceTutorialStep();
        }
        return;
      }

      // 1 / 2 / 3 keys for Mask Check responses, False Stop Trial choices, or final stop Court Sq choice
      if (!snapshot.paused && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const idx = (Number(e.key) - 1) as 0 | 1 | 2;
        if (snapshot.activeMaskCheck) {
          e.preventDefault();
          gameEngine.answerMaskCheck(idx);
          return;
        }
        if (snapshot.phase === 'trial' && snapshot.trialState) {
          e.preventDefault();
          const st = snapshot.trialState.stage;
          if (st === 1 && idx <= 1) {
            gameEngine.chooseTrialOption(idx === 0 ? 'terminus_sign' : 'opposite_sign');
          } else if (st === 2) {
            const stairChoices = ['left_stairs', 'middle_stairs', 'right_stairs'] as const;
            gameEngine.chooseTrialOption(stairChoices[idx]);
          } else if (st === 3 && idx <= 1) {
            gameEngine.chooseTrialOption(idx === 0 ? 'left_train' : 'right_train');
          }
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
        if (snapshot.cameraOpen) {
          gameEngine.toggleCamera(false);
          return;
        }
        if (snapshot.evpOpen) {
          gameEngine.toggleEvpRecorder(false);
          return;
        }
        gameEngine.togglePause();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') {
        gameEngine.setFlagHolding(false);
      }
      if (e.code === 'Space' || e.key === ' ') {
        gameEngine.setRestraintHolding(false);
        gameEngine.setEvpRecording(false);
      }
    };

    const handleBlur = () => {
      gameEngine.setFlagHolding(false);
      gameEngine.notifyFocusLoss();
      gameEngine.setEvpRecording(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    settingsOpen,
    caseFilesOpen,
    routeSelectorOpen,
    snapshot.albumOpen,
    snapshot.cameraOpen,
    snapshot.evpOpen,
    snapshot.phase,
    snapshot.paused,
    snapshot.activeMaskCheck,
    snapshot.activeRestraint,
    snapshot.trialState,
  ]);

  const handleCanvasClick = () => {
    if (
      snapshot.phase === 'menu' ||
      snapshot.phase === 'end' ||
      snapshot.phase === 'trial' ||
      snapshot.phase === 'haven' ||
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
          onPracticeStretch={() => {
            gameEngine.startPracticeStretch();
          }}
          onToggleNightmare={(enabled) => gameEngine.setNightmareMode(enabled)}
          onSelectChapter={(chapter) => gameEngine.setStartChapter(chapter)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCaseFiles={() => setCaseFilesOpen(true)}
        />
      )}

      {/* Stop 11 Restraint Screen Dim Overlay (dims toward 0.4 over first 6s) */}
      {snapshot.activeRestraint?.active && snapshot.activeRestraint.dimOpacity > 0 && (
        <div
          data-testid="restraint-dim-overlay"
          className="fixed inset-0 z-[5] bg-black pointer-events-none"
          style={{ opacity: snapshot.activeRestraint.dimOpacity }}
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
                className={`px-3 py-1.5 border text-xs font-mono cursor-pointer whitespace-nowrap ${
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
                  className={`px-3 py-1.5 border text-xs font-mono cursor-pointer whitespace-nowrap ${
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
                className="px-3 py-1.5 border border-[#e6e2d8]/25 bg-[#080a08]/90 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
              >
                Evidence log (Tab)
              </button>
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

          {/* Bottom Controls: WALK Stick, Restraint Prompt, Trial Room, Safe Haven, Mask Check, Station Stop, Subtitles, Debug Overlay, Hint Strip, and FLAG Button */}
          <div className="flex items-end justify-between gap-4">
            <MoveStick onMove={(x, y) => playerController.setMoveStickInput(x, y)} />

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
                    className="w-full py-2 px-4 bg-[#fff0d4] text-[#040504] text-xs font-semibold uppercase tracking-wider hover:bg-[#ffcf8a] cursor-pointer select-none"
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
                    className="w-full py-2 px-4 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] cursor-pointer"
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
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
                      >
                        1. {formatRouteText('To {terminusSign} trains', snapshot.activeRoute)}
                      </button>
                      <button
                        type="button"
                        data-testid="trial-sign-opposite"
                        onClick={() => gameEngine.chooseTrialOption('opposite_sign')}
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
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
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
                      >
                        1. Left stairs
                      </button>
                      <button
                        type="button"
                        data-testid="trial-stairs-middle"
                        onClick={() => gameEngine.chooseTrialOption('middle_stairs')}
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
                      >
                        2. Middle stairs
                      </button>
                      <button
                        type="button"
                        data-testid="trial-stairs-right"
                        onClick={() => gameEngine.chooseTrialOption('right_stairs')}
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
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
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
                      >
                        1. Board the left train
                      </button>
                      <button
                        type="button"
                        data-testid="trial-train-right"
                        onClick={() => gameEngine.chooseTrialOption('right_train')}
                        className="w-full py-2 px-3 border border-[#e6e2d8]/30 bg-[#0e110e] text-xs text-[#e6e2d8] hover:border-[#fff0d4] text-left cursor-pointer"
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

      {/* Polaroid 600 Square Viewfinder & Flash Overlay */}
      <PolaroidViewfinder
        open={snapshot.cameraOpen}
        shotsRemaining={snapshot.polaroidShotsRemaining}
        flashIntensity={snapshot.polaroidFlashIntensity}
        onSnap={() => {
          gameEngine.snapPolaroidPhoto(rendererRef.current?.getCanvas());
        }}
        onLower={() => gameEngine.toggleCamera(false)}
      />

      {/* EVP Microcassette Recorder Overlay */}
      <EvpRecorder
        open={snapshot.evpOpen}
        frequencyMhz={snapshot.evpFrequencyMhz}
        signalStrength={snapshot.evpSignalStrength}
        lockedSignalId={snapshot.evpLockedSignalId}
        lockedTitle={snapshot.evpLockedTitle}
        liveTranscript={snapshot.evpTranscriptLive}
        isRecording={snapshot.evpIsRecording}
        recordProgress={snapshot.evpRecordProgress}
        lastSavedTitle={snapshot.evpLastSavedTitle}
        trainSpeedMps={snapshot.trainSpeedMps}
        onStepFrequency={(steps) => gameEngine.stepEvpFrequency(steps)}
        onSetRecording={(rec) => gameEngine.setEvpRecording(rec)}
        onLower={() => gameEngine.toggleEvpRecorder(false)}
      />

      {/* Evidence Log Modal (Polaroids & EVP Tapes) */}
      <PolaroidAlbum
        open={snapshot.albumOpen}
        photos={snapshot.photos}
        tapes={snapshot.tapes}
        hasRecorder={snapshot.hasRecorder}
        playingTapeId={snapshot.playingTapeId}
        onClose={() => gameEngine.toggleAlbum(false)}
        onOpenCamera={() => gameEngine.toggleCamera(true)}
        onTogglePlayTape={(tapeId) => gameEngine.toggleTapePlayback(tapeId)}
      />

      {/* Post-Ride Report Screen */}
      {snapshot.phase === 'end' && (
        <ReportScreen
          snapshot={snapshot}
          archive={archive}
          onPlayAgain={() => gameEngine.startRide()}
          onOpenCaseFiles={() => setCaseFilesOpen(true)}
          onReturnToTitle={() => gameEngine.returnToMenu()}
        />
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

      {/* Case Files Modal (Anomalies, Polaroids & Tapes, Endings, Achievements) */}
      <CaseFilesModal
        open={caseFilesOpen}
        archive={archive}
        rideAnomalies={snapshot.rideAnomalies}
        photos={snapshot.photos}
        tapes={snapshot.tapes}
        activeRoute={snapshot.activeRoute}
        playingTapeId={snapshot.playingTapeId}
        onClose={() => setCaseFilesOpen(false)}
        onOpenCamera={() => gameEngine.toggleCamera(true)}
        onTogglePlayTape={(tapeId) => gameEngine.toggleTapePlayback(tapeId)}
      />

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
