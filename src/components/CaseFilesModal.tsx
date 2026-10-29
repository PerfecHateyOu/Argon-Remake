import React, { useState } from 'react';
import { ACHIEVEMENT_IDS, resolveAchievementsCatalog } from '../game/achievements';
import { ENDING_IDS, resolveEndingsCatalog } from '../game/endings';
import { PSYCH_IDS, resolvePsychLogCatalog } from '../game/psychLog';
import type {
  EvpSignalId,
  EvpTapeRecord,
  PolaroidPhotoRecord,
  ProgressArchive,
  RideAnomalyRecord,
  RouteLineId,
} from '../types';
import { TapePlayButton } from './TapePlayButton';

export type CaseFilesSectionId = 'anomalies' | 'evidence' | 'endings' | 'achievements';

interface CaseFilesModalProps {
  open: boolean;
  archive: ProgressArchive;
  rideAnomalies: readonly RideAnomalyRecord[];
  photos: readonly PolaroidPhotoRecord[];
  tapes: readonly EvpTapeRecord[];
  activeRoute: RouteLineId;
  playingTapeId: EvpSignalId | null;
  onClose: () => void;
  onOpenCamera?: () => void;
  onTogglePlayTape?: (tapeId: EvpSignalId) => void;
}

export const CaseFilesModal: React.FC<CaseFilesModalProps> = ({
  open,
  archive,
  rideAnomalies,
  photos,
  tapes,
  activeRoute,
  playingTapeId,
  onClose,
  onOpenCamera,
  onTogglePlayTape,
}) => {
  const [activeSection, setActiveSection] = useState<CaseFilesSectionId>('anomalies');
  const [enlargedPhoto, setEnlargedPhoto] = useState<PolaroidPhotoRecord | null>(null);

  if (!open) return null;

  const psychCatalog = resolvePsychLogCatalog(archive, rideAnomalies);
  const endingsCatalog = resolveEndingsCatalog(archive, activeRoute);
  const achievementsCatalog = resolveAchievementsCatalog(archive);
  const hasAnyWitnessed =
    psychCatalog.documentedCount > 0 || psychCatalog.unconfirmedCount > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Case Files"
      data-testid="case-files-modal"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#040504]/90 pointer-events-auto select-none"
    >
      <div className="w-full max-w-3xl max-h-[86vh] flex flex-col border border-[#e6e2d8]/25 bg-[#0b0d0b] p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6e2d8]/15 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#fff0d4]">Case Files</h2>
            <div className="text-xs font-mono text-[#ffcf8a]">
              {psychCatalog.documentedCount} of {PSYCH_IDS.length} documented,{' '}
              {psychCatalog.unconfirmedCount} unconfirmed ·{' '}
              {endingsCatalog.documentedEndingsCount} of {ENDING_IDS.length} endings documented
            </div>
          </div>
          <button
            type="button"
            data-testid="close-case-files-button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
          >
            Close Case Files
          </button>
        </div>

        {/* Section Tabs */}
        <nav
          aria-label="Case Files sections"
          className="flex flex-wrap items-center gap-2 border-b border-[#e6e2d8]/15 pb-3 shrink-0"
        >
          <button
            type="button"
            data-testid="case-files-tab-anomalies"
            onClick={() => setActiveSection('anomalies')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border cursor-pointer ${
              activeSection === 'anomalies'
                ? 'border-[#ffcf8a] bg-[#ffcf8a] text-[#080a08] font-semibold'
                : 'border-[#e6e2d8]/25 text-[#c8c3b8] hover:border-[#fff0d4]'
            }`}
          >
            Anomalies ({psychCatalog.documentedCount}/{PSYCH_IDS.length})
          </button>
          <button
            type="button"
            data-testid="case-files-tab-evidence"
            onClick={() => setActiveSection('evidence')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border cursor-pointer ${
              activeSection === 'evidence'
                ? 'border-[#ffcf8a] bg-[#ffcf8a] text-[#080a08] font-semibold'
                : 'border-[#e6e2d8]/25 text-[#c8c3b8] hover:border-[#fff0d4]'
            }`}
          >
            Polaroids & Tapes ({photos.length + tapes.length})
          </button>
          <button
            type="button"
            data-testid="case-files-tab-endings"
            onClick={() => setActiveSection('endings')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border cursor-pointer ${
              activeSection === 'endings'
                ? 'border-[#ffcf8a] bg-[#ffcf8a] text-[#080a08] font-semibold'
                : 'border-[#e6e2d8]/25 text-[#c8c3b8] hover:border-[#fff0d4]'
            }`}
          >
            Endings ({endingsCatalog.documentedEndingsCount}/{ENDING_IDS.length})
          </button>
          <button
            type="button"
            data-testid="case-files-tab-achievements"
            onClick={() => setActiveSection('achievements')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border cursor-pointer ${
              activeSection === 'achievements'
                ? 'border-[#ffcf8a] bg-[#ffcf8a] text-[#080a08] font-semibold'
                : 'border-[#e6e2d8]/25 text-[#c8c3b8] hover:border-[#fff0d4]'
            }`}
          >
            Achievements ({achievementsCatalog.unlockedCount}/{ACHIEVEMENT_IDS.length})
          </button>
        </nav>

        {/* Section 1: Anomalies */}
        {activeSection === 'anomalies' && (
          <div className="overflow-y-auto space-y-2.5 pr-1">
            {!hasAnyWitnessed && (
              <p className="text-sm text-[#c8c3b8]">
                Nothing witnessed yet. Anomalies you see on a ride are filed here.
              </p>
            )}

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
                          #{definition.index} · Class {definition.psychClass}, not yet witnessed
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
                    <p className="text-xs italic text-[#9e9a90]">Seen, not flagged in time.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Section 2: Polaroids & Tapes */}
        {activeSection === 'evidence' && (
          <div className="overflow-y-auto space-y-4 pr-1">
            {enlargedPhoto && (
              <div
                aria-label="Enlarged polaroid"
                data-testid="case-files-enlarged-polaroid"
                className="border border-[#ffcf8a]/50 bg-[#080a08] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
                    SILVER PRINT · Polaroid at stop {enlargedPhoto.stopNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnlargedPhoto(null)}
                    className="px-2.5 py-1 border border-[#e6e2d8]/30 text-xs text-[#e6e2d8] hover:border-[#fff0d4] cursor-pointer"
                  >
                    Close photo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="bg-[#f2ede2] p-2.5 text-[#121311]">
                    <div className="aspect-square w-full bg-[#090b09] overflow-hidden">
                      {enlargedPhoto.developed ? (
                        <img
                          src={enlargedPhoto.dataUrl}
                          alt={`Polaroid at stop ${enlargedPhoto.stopNumber}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[#ffcf8a]">
                          Undeveloped Silver Print
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-[#fff0d4]">
                      {!enlargedPhoto.developed
                        ? 'Undeveloped Silver Print'
                        : enlargedPhoto.anomalyTitle
                          ? `Verified Anomaly Evidence · ${enlargedPhoto.anomalyTitle}`
                          : 'Routine Commute'}
                    </div>
                    <p className="text-[#c8c3b8]">
                      {!enlargedPhoto.developed
                        ? 'Polaroid 600 prints take their time. This one will be ready at the end of the ride.'
                        : enlargedPhoto.reportDescription ??
                          'No unusual phenomena detected in frame.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
                Polaroid Evidence ({photos.length})
              </h3>
              {photos.length === 0 ? (
                <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 flex items-center justify-between">
                  <span className="text-xs text-[#9e9a90]">No Polaroids yet</span>
                  {onOpenCamera && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCamera();
                      }}
                      className="px-3 py-1.5 bg-[#fff0d4] text-[#040504] text-xs font-semibold hover:bg-[#ffcf8a] cursor-pointer"
                    >
                      Tap Camera
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setEnlargedPhoto(photo)}
                      className="border border-[#e6e2d8]/20 bg-[#080a08] p-2.5 text-left space-y-1.5 hover:border-[#ffcf8a] cursor-pointer"
                    >
                      <div className="text-[10px] font-mono text-[#ffcf8a]">
                        SILVER PRINT · Polaroid at stop {photo.stopNumber}
                      </div>
                      <div className="text-xs font-semibold text-[#fff0d4] truncate">
                        {photo.anomalyId ? 'Anomaly Caught' : 'Standard Car'}
                      </div>
                      <div className="text-[11px] text-[#9e9a90] truncate">
                        {photo.stationName}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-[#e6e2d8]/15">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#ffcf8a]">
                Recorded EVP Tapes ({tapes.length})
              </h3>
              {tapes.length === 0 ? (
                <div className="border border-[#e6e2d8]/15 bg-[#080a08] p-4 text-xs text-[#9e9a90]">
                  No tapes yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {tapes.map((tape) => (
                    <div
                      key={tape.id}
                      className="border border-[#e6e2d8]/15 bg-[#080a08] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-[#fff0d4]">
                          {tape.title}{' '}
                          <span className="font-mono text-[#ffcf8a]">
                            ({tape.frequencyMhz.toFixed(2)} MHz)
                          </span>
                          {tape.isCarrierOnly && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-mono border border-[#e6e2d8]/25 text-[#9e9a90]">
                              Carrier Wave
                            </span>
                          )}
                        </div>
                        {onTogglePlayTape && (
                          <TapePlayButton
                            tape={tape}
                            isPlaying={playingTapeId === tape.id}
                            onTogglePlay={(id) => onTogglePlayTape(id)}
                          />
                        )}
                      </div>
                      <p className="text-xs italic text-[#c8c3b8]">{tape.transcript}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 3: Endings */}
        {activeSection === 'endings' && (
          <div className="overflow-y-auto space-y-2.5 pr-1">
            <div className="text-xs font-mono text-[#ffcf8a]">
              {endingsCatalog.documentedEndingsCount} of {ENDING_IDS.length} endings documented
            </div>
            {endingsCatalog.entries.map((entry) => {
              const { definition, documented, formattedSummary } = entry;
              return (
                <div
                  key={definition.id}
                  data-testid={`ending-entry-${definition.id}`}
                  className="border border-[#e6e2d8]/15 bg-[#080a08] p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[#fff0d4]">
                      {documented ? (
                        <>
                          #{definition.index} · {definition.title}
                        </>
                      ) : (
                        <span className="text-[#9e9a90]">
                          #{definition.index} · Undocumented Outcome
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${
                        documented
                          ? 'border-[#ffcf8a]/60 text-[#ffcf8a] bg-[#ffcf8a]/10'
                          : 'border-[#e6e2d8]/15 text-[#78746c]'
                      }`}
                    >
                      {documented ? definition.badge : 'UNDOCUMENTED'}
                    </span>
                  </div>
                  {documented && (
                    <p className="text-xs text-[#c8c3b8] leading-relaxed">{formattedSummary}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Section 4: Achievements */}
        {activeSection === 'achievements' && (
          <div className="overflow-y-auto space-y-2.5 pr-1">
            {achievementsCatalog.entries.map((entry) => {
              const { definition, unlocked } = entry;
              return (
                <div
                  key={definition.id}
                  data-testid={`achievement-entry-${definition.id}`}
                  className="border border-[#e6e2d8]/15 bg-[#080a08] p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        unlocked ? 'text-[#fff0d4]' : 'text-[#9e9a90]'
                      }`}
                    >
                      {definition.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${
                        unlocked
                          ? 'border-[#ffcf8a]/60 text-[#ffcf8a] bg-[#ffcf8a]/10'
                          : 'border-[#e6e2d8]/15 text-[#78746c]'
                      }`}
                    >
                      {unlocked ? 'EARNED' : 'Not yet earned.'}
                    </span>
                  </div>
                  <p className="text-xs text-[#c8c3b8] leading-relaxed">
                    {definition.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

