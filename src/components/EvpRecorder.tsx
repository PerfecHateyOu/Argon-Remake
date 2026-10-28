import React from 'react';
import { ChevronLeft, ChevronRight, Disc, Radio, X } from 'lucide-react';
import type { EvpSignalId } from '../types';

interface EvpRecorderProps {
  open: boolean;
  frequencyMhz: number;
  signalStrength: number;
  lockedSignalId: EvpSignalId | null;
  lockedTitle: string | null;
  liveTranscript: string | null;
  isRecording: boolean;
  recordProgress: number;
  lastSavedTitle: string | null;
  trainSpeedMps: number;
  onStepFrequency: (deltaSteps: number) => void;
  onSetRecording: (recording: boolean) => void;
  onLower: () => void;
}

export const EvpRecorder: React.FC<EvpRecorderProps> = ({
  open,
  frequencyMhz,
  signalStrength,
  lockedSignalId,
  lockedTitle,
  liveTranscript,
  isRecording,
  recordProgress,
  lastSavedTitle,
  trainSpeedMps,
  onStepFrequency,
  onSetRecording,
  onLower,
}) => {
  if (!open) return null;

  const atStandstill = trainSpeedMps <= 0.5;
  const isLocked = lockedSignalId !== null;
  const strengthPct = Math.round(signalStrength * 100);

  let statusLine = 'Tune slowly. Something is out there.';
  if (atStandstill) {
    statusLine = 'Nothing comes through at a standstill.';
  } else if (isLocked && liveTranscript) {
    statusLine = liveTranscript;
  } else if (isRecording) {
    statusLine = 'Recording hiss…';
  }

  return (
    <div
      data-testid="evp-recorder-panel"
      onWheel={(e) => {
        e.stopPropagation();
        onStepFrequency(e.deltaY < 0 ? 1 : -1);
      }}
      className="fixed bottom-24 right-4 z-30 w-full max-w-sm bg-[#0b0e0c]/95 border border-[#ffcf8a]/45 p-4 text-[#f2efe9] shadow-2xl pointer-events-auto"
    >
      {/* Top header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-[#ffcf8a]">
          <Radio className="w-3.5 h-3.5" />
          <span>MICROCASSETTE EVP RECORDER</span>
        </div>
        <button
          type="button"
          data-testid="evp-lower-button"
          onClick={onLower}
          aria-label="Lower recorder"
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.12em] bg-[#141815] hover:bg-[#1f2621] text-[#f2efe9]/80 border border-[#f2efe9]/20 cursor-pointer"
        >
          <X className="w-3 h-3" />
          <span>Lower recorder</span>
        </button>
      </div>

      {/* Frequency readout & tuning buttons */}
      <div className="flex items-center justify-between bg-[#070907] border border-[#f2efe9]/15 px-3 py-2.5 mb-3">
        <button
          type="button"
          data-testid="evp-tune-down"
          aria-label="Tune down 5 kHz"
          title="Tune down 5 kHz"
          onClick={() => onStepFrequency(-1)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#141815] hover:bg-[#202622] border border-[#f2efe9]/20 text-xs font-mono text-[#f2efe9] cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Tune down</span>
        </button>

        <div className="text-center">
          <div
            data-testid="evp-frequency-readout"
            className="text-xl font-mono font-bold tracking-[0.1em] text-[#ffcf8a]"
          >
            {frequencyMhz.toFixed(2)} <span className="text-xs font-normal text-[#f2efe9]/65">MHz</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#f2efe9]/55">
            {isLocked ? (
              <span data-testid="evp-locked-badge" className="text-[#8ad4a4] font-semibold">
                Locked on · {lockedTitle}
              </span>
            ) : (
              <span>{ isRecording ? 'Recording' : 'Not recording' }</span>
            )}
          </div>
        </div>

        <button
          type="button"
          data-testid="evp-tune-up"
          aria-label="Tune up 5 kHz"
          title="Tune up 5 kHz"
          onClick={() => onStepFrequency(1)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#141815] hover:bg-[#202622] border border-[#f2efe9]/20 text-xs font-mono text-[#f2efe9] cursor-pointer"
        >
          <span>Tune up</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Signal meter */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-[#f2efe9]/65 mb-1">
          <span>Signal meter</span>
          <span>{strengthPct}%</span>
        </div>
        <div className="w-full h-2 bg-[#141815] border border-[#f2efe9]/15 overflow-hidden">
          <div
            data-testid="evp-signal-bar"
            style={{ width: `${strengthPct}%` }}
            className={`h-full transition-all duration-75 ${
              isLocked ? 'bg-[#8ad4a4]' : 'bg-[#ffcf8a]/75'
            }`}
          />
        </div>
      </div>

      {/* Live transcript / status box */}
      <div
        data-testid="evp-status-box"
        className="min-h-[3.25rem] bg-[#070907] border border-[#f2efe9]/15 px-3 py-2 mb-3 text-xs leading-relaxed text-[#f2efe9]/90 italic"
      >
        {statusLine}
      </div>

      {/* Saved toast if just recorded */}
      {lastSavedTitle && (
        <div
          data-testid="evp-saved-toast"
          className="mb-3 px-2.5 py-1.5 bg-[#173628]/80 border border-[#8ad4a4]/45 text-[11px] font-mono text-[#8ad4a4]"
        >
          Saved to tape: {lastSavedTitle}
        </div>
      )}

      {/* Hold Record button */}
      <button
        type="button"
        data-testid="evp-record-button"
        onMouseDown={() => onSetRecording(true)}
        onMouseUp={() => onSetRecording(false)}
        onMouseLeave={() => onSetRecording(false)}
        onTouchStart={(e) => {
          e.preventDefault();
          onSetRecording(true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onSetRecording(false);
        }}
        className={`relative w-full py-2.5 px-3 border text-xs font-mono uppercase tracking-[0.14em] font-semibold overflow-hidden transition-colors cursor-pointer ${
          isRecording
            ? 'bg-[#3a1818] border-[#ff8a7a] text-[#ffcf8a]'
            : 'bg-[#141815] hover:bg-[#1d241f] border-[#ffcf8a]/40 text-[#ffcf8a]'
        }`}
      >
        <div
          style={{ width: `${Math.round(recordProgress * 100)}%` }}
          className="absolute inset-y-0 left-0 bg-[#ffcf8a]/25 pointer-events-none transition-all duration-75"
        />
        <span className="relative z-10 flex items-center justify-center gap-2">
          <Disc className={`w-3.5 h-3.5 ${isRecording ? 'animate-spin text-[#ff8a7a]' : ''}`} />
          <span>
            {isRecording
              ? `RECORDING (${Math.round(recordProgress * 100)}%)`
              : 'HOLD SPACE TO RECORD'}
          </span>
        </span>
      </button>

      <div className="mt-2.5 text-[10px] font-mono text-center text-[#f2efe9]/55">
        [ ] or wheel to tune · hold Space to record · R to lower
      </div>
    </div>
  );
};
