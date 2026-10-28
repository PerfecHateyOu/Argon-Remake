import type { RollsignBanner, RouteLineId } from '../types';
import { ROUTE_METADATA } from '../constants';

interface AnalogRollsignProps {
  rollsign: RollsignBanner | null;
  activeRoute: RouteLineId;
}

export function AnalogRollsign({ rollsign, activeRoute }: AnalogRollsignProps) {
  if (!rollsign) return null;

  const routeMeta = ROUTE_METADATA[activeRoute];

  return (
    <div
      data-testid="analog-rollsign"
      className="fixed inset-x-0 top-20 z-20 flex justify-center px-4 pointer-events-none select-none"
    >
      <div className="w-full max-w-xl border-2 border-[#3c3f3c] bg-[#0a0c0a] shadow-2xl overflow-hidden">
        {/* Mechanical rollsign drum top trim */}
        <div className="h-2 bg-[#1e211e] border-b border-[#3c3f3c] flex items-center justify-between px-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5c605c]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#5c605c]" />
        </div>

        {/* Backlit Mylar Sign Window */}
        <div className="px-6 py-4 flex items-center gap-4 bg-[#111311]">
          <span
            className="inline-flex items-center justify-center w-11 h-11 rounded-full text-xl font-bold text-[#040504] shrink-0"
            style={{ backgroundColor: routeMeta.bulletColor }}
          >
            {routeMeta.id}
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#ffcf8a]">
              ANALOG ROLLSIGN · {routeMeta.name}
            </div>
            <h2
              data-testid="rollsign-title"
              className="text-xl sm:text-2xl font-bold tracking-tight text-[#fff0d4] truncate"
            >
              {rollsign.title}
            </h2>
            <p className="text-xs font-mono text-[#a8a398] truncate">
              {rollsign.subtitle}
            </p>
          </div>
        </div>

        {/* Mechanical rollsign drum bottom trim */}
        <div className="h-2 bg-[#1e211e] border-t border-[#3c3f3c] flex items-center justify-between px-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5c605c]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#5c605c]" />
        </div>
      </div>
    </div>
  );
}
