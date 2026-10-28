import React from 'react';
import { Play, Square } from 'lucide-react';
import type { EvpSignalId, EvpTapeRecord } from '../types';

interface TapePlayButtonProps {
  tape: EvpTapeRecord;
  isPlaying: boolean;
  onTogglePlay: (tapeId: EvpSignalId) => void;
}

export const TapePlayButton: React.FC<TapePlayButtonProps> = ({
  tape,
  isPlaying,
  onTogglePlay,
}) => {
  const label = isPlaying ? `Stop tape: ${tape.title}` : `Play tape: ${tape.title}`;

  return (
    <button
      type="button"
      data-testid={`tape-play-button-${tape.id}`}
      aria-label={label}
      onClick={() => onTogglePlay(tape.id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.12em] border transition-colors cursor-pointer ${
        isPlaying
          ? 'bg-[#ffcf8a] text-[#0a0c0a] border-[#ffcf8a] font-semibold'
          : 'bg-[#121613] hover:bg-[#1a201c] text-[#ffcf8a] border-[#ffcf8a]/40'
      }`}
    >
      {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
      <span>{label}</span>
    </button>
  );
};
