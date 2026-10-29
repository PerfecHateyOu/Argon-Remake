import React from 'react';
import { RESTRAINT_CEILING_RAISE, ROUTE_METADATA } from '../constants';
import {
  buildEndingResult,
  ENDING_IDS,
  formatStopReportNotes,
  resolveEndingsCatalog,
} from '../game/endings';
import { PSYCH_IDS, resolvePsychLogCatalog } from '../game/psychLog';
import type { EngineSnapshot, ProgressArchive } from '../types';

interface ReportScreenProps {
  snapshot: EngineSnapshot;
  archive: ProgressArchive;
  onPlayAgain: () => void;
  onOpenCaseFiles: () => void;
  onReturnToTitle: () => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  snapshot,
  archive,
  onPlayAgain,
  onOpenCaseFiles,
  onReturnToTitle,
}) => {
  const ending =
    snapshot.resolvedEnding ??
    buildEndingResult(
      snapshot.steppedOffAtBait ? 'eternal_commute' : 'civilian_extraction',
      snapshot.activeRoute
    );

  const currentRoute = ROUTE_METADATA[snapshot.activeRoute];
  const psychCatalog = resolvePsychLogCatalog(archive, snapshot.rideAnomalies);
  const endingsCatalog = resolveEndingsCatalog(archive, snapshot.activeRoute);
  const isNotFiled = snapshot.isPracticeRun || snapshot.isDebugRun;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ride Report"
      data-testid="end-screen"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-8 bg-[#040504]/92 pointer-events-auto select-none overflow-y-auto"
    >
      <div
        data-testid="report-screen"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#e6e2d8]/25 bg-[#0b0d0b] p-6 md:p-8 space-y-6 overflow-y-auto"
      >
        {/* Top Ending Header & Narrative */}
        <div className="border-b border-[#e6e2d8]/15 pb-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              data-testid="ending-badge"
              className="text-xs font-mono uppercase tracking-widest text-[#ffcf8a]"
            >
              {ending.badge}
            </span>
            <div className="flex items-center gap-2">
              {isNotFiled && (
                <span
                  data-testid="status-not-filed"
                  className="px-2.5 py-0.5 border border-[#ffcf8a]/50 bg-[#ffcf8a]/10 text-[11px] font-mono uppercase tracking-wider text-[#ffcf8a]"
                >
                  STATUS: NOT FILED
                </span>
              )}
              <span className="text-xs font-mono text-[#9e9a90]">{currentRoute.name}</span>
            </div>
          </div>

          <h2
            data-testid="ending-title"
            className="text-2xl md:text-3xl font-bold tracking-tight text-[#fff0d4]"
          >
            {ending.title}
          </h2>

          <p
            data-testid="ending-narrative"
            className="text-sm md:text-base text-[#e6e2d8] leading-relaxed"
          >
            {ending.narrativeText}
          </p>

          <p data-testid="ending-summary" className="text-xs font-mono text-[#c8c3b8]">
            {ending.summary}
          </p>
        </div>

        {/* Core Ride Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sanity Retained */}
          <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
                Sanity Retained
              </span>
              {snapshot.restraintHeld && (
                <span
                  data-testid="restraint-bonus-chip"
                  className="text-[10px] font-mono text-[#8ad4a4]"
                >
                  +{RESTRAINT_CEILING_RAISE} restraint bonus
                </span>
              )}
            </div>
            <div
              data-testid="sanity-retained-value"
              className="text-2xl font-bold font-mono tabular-nums text-[#fff0d4]"
            >
              {snapshot.sanityRetainedPercent}%
            </div>
            <p className="text-[11px] text-[#9e9a90] leading-relaxed">
              How well you held on, stop by stop: where your sanity sat inside each stop&apos;s
              band, averaged over the ride.
            </p>
          </div>

          {/* Mask Integrity */}
          <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
                Mask Integrity
              </span>
              <span className="text-[10px] font-mono text-[#c8c3b8]">
                Peak Suspicion {snapshot.peakSuspicion}
              </span>
            </div>
            <div
              data-testid="mask-integrity-value"
              className="text-lg font-bold font-mono tabular-nums text-[#fff0d4]"
            >
              {snapshot.peakSuspicion === 0
                ? 'They never suspected a thing.'
                : `${Math.max(0, 100 - Math.round((snapshot.peakSuspicion / 60) * 100))}% (${
                    snapshot.peakSuspicion
                  }/60)`}
            </div>
            <p className="text-[11px] text-[#9e9a90] leading-relaxed">
              How well you hid it: the highest your parents&apos; Suspicion got this ride. Lower is
              better.
            </p>
          </div>

          {/* Anomaly Accuracy */}
          <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
                Anomaly Accuracy
              </span>
              <span className="text-[10px] font-mono text-[#c8c3b8]">
                {snapshot.anomaliesCaughtCount} of {snapshot.anomaliesSpawnedCount}
              </span>
            </div>
            <div
              data-testid="anomaly-accuracy-value"
              className="text-2xl font-bold font-mono tabular-nums text-[#fff0d4]"
            >
              {snapshot.anomalyAccuracyPercent}%
            </div>
            <p className="text-[11px] text-[#9e9a90] leading-relaxed">
              Anomalies you flagged or photographed in time, out of all that appeared.
            </p>
          </div>
        </div>

        {/* Secondary Metrics: Restraint (Stop 11) & False Stop Trials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-3.5 flex items-center justify-between gap-4">
            <span className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
              Restraint (Stop 11)
            </span>
            <span
              data-testid="report-restraint-status"
              className="text-xs font-mono text-[#fff0d4]"
            >
              {snapshot.restraintHeld
                ? 'Held (Composure Maintained)'
                : snapshot.restraintCompleted
                  ? 'Failed'
                  : 'Not reached'}
            </span>
          </div>

          <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-3.5 flex items-center justify-between gap-4">
            <span className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
              False Stop Trials
            </span>
            <span data-testid="report-trials-status" className="text-xs font-mono text-[#fff0d4]">
              {snapshot.falseStopTrials.length === 0
                ? 'None. You never stepped off into a trap.'
                : snapshot.falseStopTrials
                    .map((t) => `Stop ${t.stop} (${t.depth} loops deep)`)
                    .join(', ')}
            </span>
          </div>
        </div>

        {/* Stop-by-Stop Decisions & Door Tells */}
        {snapshot.stopDecisions.length > 0 && (
          <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 space-y-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
              Stop Log & Door Tells
            </h3>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {snapshot.stopDecisions.map((decision, idx) => {
                const notes = formatStopReportNotes(decision);
                return (
                  <div
                    key={`${decision.segmentId}-${idx}`}
                    className="border border-[#e6e2d8]/10 bg-[#0b0d0b] px-3 py-2 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#fff0d4]">
                        Stop {decision.stopNumber} · {decision.stationName}
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="px-1.5 py-0.5 border border-[#e6e2d8]/20 text-[#c8c3b8]">
                          {notes.stopBadgeLabel}
                        </span>
                        {decision.steppedOff && (
                          <span className="px-1.5 py-0.5 border border-[#ffcf8a]/50 text-[#ffcf8a]">
                            Stepped off
                          </span>
                        )}
                      </div>
                    </div>
                    {notes.tellNote && (
                      <div className="text-[11px] text-[#c8c3b8] font-mono">{notes.tellNote}</div>
                    )}
                    {notes.parentNote && (
                      <div className="text-[11px] italic text-[#9e9a90]">{notes.parentNote}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Developed Polaroid Evidence */}
        {snapshot.photos.length > 0 && (
          <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
              Polaroid Evidence ({snapshot.photos.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {snapshot.photos.map((photo) => (
                <div
                  key={photo.id}
                  data-testid={`report-polaroid-${photo.id}`}
                  className="bg-[#f2ede2] p-2.5 text-[#121311] space-y-1.5"
                >
                  <div className="aspect-square w-full bg-[#090b09] overflow-hidden">
                    <img
                      src={photo.dataUrl}
                      alt="Polaroid print"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-[11px] font-bold tracking-tight truncate">
                    {photo.anomalyTitle ? `${photo.anomalyTitle} · Caught on film` : 'Nothing out of place'}
                  </div>
                  <div className="text-[10px] font-mono text-[#52504a] truncate">
                    Stop {photo.stopNumber} · {photo.stationName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* This Ride & Case File Psych Log Summary */}
        <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 space-y-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
                This ride & Case file
              </h3>
              <span className="text-xs font-mono text-[#c8c3b8]">
                {psychCatalog.documentedCount} of {PSYCH_IDS.length} documented,{' '}
                {psychCatalog.unconfirmedCount} unconfirmed ·{' '}
                {endingsCatalog.documentedEndingsCount} of {ENDING_IDS.length} endings documented
              </span>
            </div>
            <p className="text-xs text-[#9e9a90]">
              The anomalies you&apos;ve seen: this ride&apos;s, then the whole file kept on this
              device (the same file as Case Files → Anomalies).
            </p>
            {psychCatalog.unconfirmedCount > 0 && (
              <p className="text-[11px] font-mono text-[#ffcf8a]">
                {psychCatalog.unconfirmedCount} witnessed but never caught.
              </p>
            )}
          </div>

          {/* This ride anomalies */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#fff0d4]">This ride</div>
            {snapshot.rideAnomalies.length === 0 ? (
              <p className="text-xs text-[#9e9a90]">
                Nothing happened in front of you this ride. That you know of.
              </p>
            ) : (
              <div className="space-y-1.5">
                {snapshot.rideAnomalies.map((rec, i) => (
                  <div
                    key={`${rec.id}-${i}`}
                    className="border border-[#e6e2d8]/10 bg-[#0b0d0b] px-3 py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#fff0d4]">
                        Stop {rec.stopNumber} · {rec.title}:
                      </span>{' '}
                      <span className="text-[#c8c3b8]">{rec.reportDescription}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono uppercase shrink-0 border ${
                        rec.caught
                          ? 'border-[#ffcf8a]/60 text-[#ffcf8a]'
                          : 'border-[#e6e2d8]/25 text-[#9e9a90]'
                      }`}
                    >
                      {rec.caught ? (rec.caughtByPhoto ? 'Caught on film' : 'CAUGHT') : 'UNCONFIRMED'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case file summary */}
          <div className="space-y-2 pt-2 border-t border-[#e6e2d8]/10">
            <div className="text-xs font-semibold text-[#fff0d4]">Case file</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {psychCatalog.entries.map((entry) => {
                const { definition, status } = entry;
                const isDoc = status === 'DOCUMENTED';
                const isUnconf = status === 'UNCONFIRMED';
                return (
                  <div
                    key={definition.id}
                    className="border border-[#e6e2d8]/10 bg-[#0b0d0b] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className={isDoc || isUnconf ? 'text-[#e6e2d8]' : 'text-[#78746c]'}>
                      #{definition.index} ·{' '}
                      {isDoc || isUnconf ? definition.title : 'Not yet witnessed.'}
                    </span>
                    <span className="text-[10px] font-mono text-[#9e9a90]">{status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2 shrink-0">
          <button
            type="button"
            data-testid="play-again-button"
            onClick={onPlayAgain}
            className="flex-1 min-w-40 py-3 bg-[#fff0d4] text-[#040504] text-sm font-semibold hover:bg-[#ffcf8a] cursor-pointer"
          >
            {ending.primaryButtonLabel}
          </button>
          <button
            type="button"
            data-testid="report-case-files-button"
            onClick={onOpenCaseFiles}
            className="px-5 py-3 border border-[#e6e2d8]/30 text-sm text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
          >
            Case Files
          </button>
          <button
            type="button"
            data-testid="return-title-button"
            onClick={onReturnToTitle}
            className="px-5 py-3 border border-[#e6e2d8]/30 text-sm text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
          >
            Return to title
          </button>
        </div>
      </div>
    </div>
  );
};

