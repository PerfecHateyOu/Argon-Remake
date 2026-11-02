import { useEffect, useRef, useState } from 'react';
import { AnalogRollsign } from './components/AnalogRollsign';
import { CaseFilesModal } from './components/CaseFilesModal';
import { EvpRecorder } from './components/EvpRecorder';
import { PolaroidAlbum } from './components/PolaroidAlbum';
import { PolaroidViewfinder } from './components/PolaroidViewfinder';
import { ReportScreen } from './components/ReportScreen';
import { RideHudOverlay } from './components/RideHudOverlay';
import { RouteSelector } from './components/RouteSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { StartScreen } from './components/StartScreen';
import { ROUTE_METADATA } from './constants';
import { gameEngine } from './game/gameState';
import { SceneRenderer } from './graphics/sceneRenderer';
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
  const restraintDim = snapshot.activeRestraint?.active ? snapshot.activeRestraint.dimOpacity : 0;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070907] text-[#ece7db]">
      {/* Dedicated Three.js Canvas Mount (with screen-space color grading during Restraint) */}
      <div
        ref={canvasMountRef}
        onClick={handleCanvasClick}
        style={
          restraintDim > 0
            ? {
                filter: `saturate(${Math.max(0.25, 1 - restraintDim * 1.6).toFixed(2)}) contrast(${(1 + restraintDim * 0.45).toFixed(2)})`,
              }
            : undefined
        }
        className="fixed inset-0 z-0 w-full h-full cursor-crosshair transition-[filter] duration-150"
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

      {/* Stop 11 Restraint Screen-Space Post-Processing: Vignette Expansion & Color Grading (G.dim) */}
      {restraintDim > 0 && (
        <div
          data-testid="restraint-dim-overlay"
          className="fixed inset-0 z-[5] pointer-events-none"
          style={{
            opacity: restraintDim,
            background:
              'radial-gradient(circle at 50% 50%, rgba(7,9,7,0.18) 15%, rgba(4,6,5,0.88) 68%, rgba(2,3,2,0.98) 100%)',
          }}
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
        <RideHudOverlay
          snapshot={snapshot}
          settings={settings}
          lockState={lockState}
          currentSegment={currentSegment}
          onOpenRouteSelector={() => setRouteSelectorOpen(true)}
          onCanvasClick={handleCanvasClick}
        />
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
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070907]/85 pointer-events-auto"
        >
          <div className="w-full max-w-sm border border-[#ece7db]/25 bg-[#0a0d0b] p-6 space-y-4">
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
                className="min-h-[44px] min-w-[44px] w-full py-2.5 bg-[#fff0d4] text-[#070907] text-sm font-semibold hover:bg-[#ffcf8a] cursor-pointer"
              >
                Resume ride
              </button>
              <button
                type="button"
                onClick={() => setRouteSelectorOpen(true)}
                className="min-h-[44px] min-w-[44px] w-full py-2.5 border border-[#ece7db]/30 text-sm text-[#ece7db] hover:border-[#fff0d4] cursor-pointer"
              >
                Switch route line (L)
              </button>
              <button
                type="button"
                onClick={() => setCaseFilesOpen(true)}
                className="min-h-[44px] min-w-[44px] w-full py-2.5 border border-[#ece7db]/30 text-sm text-[#ece7db] hover:border-[#fff0d4] cursor-pointer"
              >
                Case Files
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="min-h-[44px] min-w-[44px] w-full py-2.5 border border-[#ece7db]/30 text-sm text-[#ece7db] hover:border-[#fff0d4] cursor-pointer"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => gameEngine.returnToMenu()}
                className="min-h-[44px] min-w-[44px] w-full py-2.5 border border-[#ece7db]/30 text-sm text-[#ece7db] hover:border-[#fff0d4] cursor-pointer"
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
