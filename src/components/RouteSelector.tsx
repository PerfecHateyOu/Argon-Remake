import { ROUTE_METADATA } from '../constants';
import type { RouteLineId } from '../types';

interface RouteSelectorProps {
  activeRoute: RouteLineId;
  onSelectRoute: (route: RouteLineId) => void;
  onClose: () => void;
}

const ROUTE_ORDER: readonly RouteLineId[] = ['G', 'L', '7'];

export function RouteSelector({
  activeRoute,
  onSelectRoute,
  onClose,
}: RouteSelectorProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Route Lines"
      data-testid="route-selector-modal"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#040504]/85 text-[#e6e2d8]"
    >
      <div className="w-full max-w-xl border border-[#e6e2d8]/25 bg-[#0b0d0b] p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#e6e2d8]/15 pb-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#9e9a90]">
              LAST LOCAL v5.2
            </div>
            <h2 className="text-lg font-semibold text-[#fff0d4]">Route Lines</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer whitespace-nowrap"
          >
            Close route selector
          </button>
        </div>

        <p className="text-xs text-[#c8c3b8]">
          Switching renames the stops and announcements ahead, from now on. Every new ride starts on the G.
        </p>

        <div className="space-y-3">
          {ROUTE_ORDER.map((lineId) => {
            const spec = ROUTE_METADATA[lineId];
            const isActive = activeRoute === lineId;
            return (
              <div
                key={lineId}
                className={`border p-4 flex items-start justify-between gap-4 ${
                  isActive
                    ? 'border-[#fff0d4] bg-[#141814]'
                    : 'border-[#e6e2d8]/20 bg-[#0d100d]'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-[#040504] shrink-0 mt-0.5"
                    style={{ backgroundColor: spec.bulletColor }}
                  >
                    {spec.id}
                  </span>
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold text-[#fff0d4]">
                      {spec.name}
                    </div>
                    <p className="text-xs text-[#a8a398] leading-relaxed">
                      {spec.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isActive ? (
                    <span
                      data-testid={`route-active-${lineId}`}
                      className="inline-block px-3 py-1.5 border border-[#fff0d4]/40 text-xs font-mono text-[#fff0d4] whitespace-nowrap"
                    >
                      Active Line
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`route-switch-${lineId}`}
                      onClick={() => onSelectRoute(lineId)}
                      className="px-3 py-1.5 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] cursor-pointer whitespace-nowrap"
                    >
                      Switch Line
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
