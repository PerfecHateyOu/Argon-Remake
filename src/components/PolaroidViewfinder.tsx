import React from 'react';
import { Camera, X } from 'lucide-react';
import { STARTING_FILM } from '../constants';

interface PolaroidViewfinderProps {
  open: boolean;
  shotsRemaining: number;
  flashIntensity: number;
  onSnap: () => void;
  onLower: () => void;
}

export const PolaroidViewfinder: React.FC<PolaroidViewfinderProps> = ({
  open,
  shotsRemaining,
  flashIntensity,
  onSnap,
  onLower,
}) => {
  const outOfFilm = shotsRemaining <= 0;

  return (
    <>
      {/* White Polaroid flash overlay */}
      {flashIntensity > 0.01 && (
        <div
          data-testid="polaroid-flash-overlay"
          style={{ opacity: Math.min(1, flashIntensity) }}
          className="fixed inset-0 z-50 bg-[#fffaf0] pointer-events-none transition-opacity duration-75"
        />
      )}

      {open && (
        <div
          data-testid="polaroid-viewfinder"
          className="fixed inset-0 z-30 pointer-events-none flex flex-col items-center justify-center p-4"
        >
          {/* Square 1:1 Viewfinder Frame */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 border-2 border-[#ffcf8a]/75 bg-black/15 shadow-[0_0_0_9999px_rgba(4,5,4,0.52)] flex flex-col justify-between p-3 pointer-events-auto">
            {/* Corner ticks */}
            <div className="flex items-center justify-between gap-2 text-[9px] font-mono tracking-[0.12em] uppercase text-[#ffcf8a]">
              <span>POLAROID 600 VIEW</span>
              <span>600 INSTANT CARTRIDGE</span>
            </div>

            {/* Center reticle */}
            <div className="self-center my-auto w-14 h-14 border border-[#f2efe9]/45 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#ffcf8a]/80" />
            </div>

            {/* Bottom status bar inside frame */}
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.14em] text-[#f2efe9]/85">
              <span>
                FILM: {shotsRemaining}/{STARTING_FILM}
              </span>
              {outOfFilm && (
                <span className="text-[#ff8a7a] font-semibold">OUT OF FILM</span>
              )}
            </div>
          </div>

          {/* Action bar below viewfinder */}
          <div className="mt-4 flex items-center gap-2.5 pointer-events-auto bg-[#0a0c0a]/95 border border-[#f2efe9]/20 px-3.5 py-2.5">
            <button
              type="button"
              data-testid="polaroid-snap-button"
              disabled={outOfFilm}
              onClick={onSnap}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] font-semibold transition-colors cursor-pointer ${
                outOfFilm
                  ? 'bg-[#1a1d1a] text-[#f2efe9]/40 border border-[#f2efe9]/15 cursor-not-allowed'
                  : 'bg-[#ffcf8a] text-[#0a0c0a] hover:bg-[#ffdca8]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{outOfFilm ? 'OUT OF FILM' : 'SNAP PHOTO'}</span>
            </button>

            <button
              type="button"
              data-testid="polaroid-lower-button"
              onClick={onLower}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-[0.12em] bg-[#121613] hover:bg-[#1c221e] text-[#f2efe9]/85 border border-[#f2efe9]/20 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Lower Camera</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
