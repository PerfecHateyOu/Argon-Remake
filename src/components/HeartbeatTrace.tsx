import React from 'react';
import { HEARTBEAT_BPM_BY_TIER } from '../constants';
import type { SanityTier } from '../types';

interface HeartbeatTraceProps {
  sanityTier: SanityTier;
  sanity: number;
}

export const HeartbeatTrace: React.FC<HeartbeatTraceProps> = ({ sanityTier, sanity }) => {
  const bpm = HEARTBEAT_BPM_BY_TIER[sanityTier];
  const traceColor =
    sanityTier === 'Critical'
      ? '#d9534f'
      : sanityTier === 'Low'
        ? '#ffcf8a'
        : sanityTier === 'Medium'
          ? '#fff0d4'
          : '#8ad4a4';

  return (
    <div
      data-testid="heartbeat-trace"
      className="inline-flex items-center gap-2 border border-[#e6e2d8]/20 bg-[#080a08]/90 px-3 py-1.5 text-[11px] font-mono tabular-nums self-start"
    >
      <svg
        width="52"
        height="16"
        viewBox="0 0 52 16"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <polyline
          points="0,8 12,8 16,3 20,14 24,2 28,12 32,8 52,8"
          stroke={traceColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ color: traceColor }}>{bpm} BPM</span>
      <span className="text-[#9e9a90]">· {sanity}%</span>
    </div>
  );
};

