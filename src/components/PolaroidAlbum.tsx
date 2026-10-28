import React, { useState } from 'react';
import { Camera, Disc, FolderOpen, X } from 'lucide-react';
import { formatCarLocationForPolaroid } from '../game/polaroidManager';
import type { EvpSignalId, EvpTapeRecord, PolaroidPhotoRecord } from '../types';
import { TapePlayButton } from './TapePlayButton';

interface PolaroidAlbumProps {
  open: boolean;
  photos: PolaroidPhotoRecord[];
  tapes: EvpTapeRecord[];
  hasRecorder: boolean;
  playingTapeId: EvpSignalId | null;
  onClose: () => void;
  onOpenCamera: () => void;
  onTogglePlayTape: (tapeId: EvpSignalId) => void;
}

type CarFilter = 'ALL' | 'Car A (Lead)' | 'Car B (Mid)' | 'Car C (Rear)';

export const PolaroidAlbum: React.FC<PolaroidAlbumProps> = ({
  open,
  photos,
  tapes,
  hasRecorder,
  playingTapeId,
  onClose,
  onOpenCamera,
  onTogglePlayTape,
}) => {
  const [activeTab, setActiveTab] = useState<'polaroids' | 'tapes'>('polaroids');
  const [carFilter, setCarFilter] = useState<CarFilter>('ALL');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  if (!open) return null;

  const filteredPhotos =
    carFilter === 'ALL'
      ? photos
      : photos.filter((p) => formatCarLocationForPolaroid(p.carLocation) === carFilter);

  const selectedPhoto =
    filteredPhotos.find((p) => p.id === selectedPhotoId) ?? filteredPhotos[0] ?? null;

  return (
    <div
      data-testid="evidence-log-modal"
      className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 pointer-events-auto"
    >
      <div className="w-full max-w-3xl bg-[#0c0f0d] border border-[#f2efe9]/25 text-[#f2efe9] shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f2efe9]/15">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-4 h-4 text-[#ffcf8a]" />
            <h2 className="text-sm font-mono uppercase tracking-[0.18em] text-[#ffcf8a]">
              Evidence Log
            </h2>
          </div>
          <button
            type="button"
            data-testid="close-album-button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-[0.12em] bg-[#141815] hover:bg-[#1e2420] border border-[#f2efe9]/20 text-[#f2efe9]/85 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Album</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#f2efe9]/15 bg-[#090b0a] px-5">
          <button
            type="button"
            data-testid="album-tab-polaroids"
            onClick={() => setActiveTab('polaroids')}
            className={`px-4 py-3 text-xs font-mono uppercase tracking-[0.15em] border-b-2 transition-colors cursor-pointer ${
              activeTab === 'polaroids'
                ? 'border-[#ffcf8a] text-[#ffcf8a] font-semibold'
                : 'border-transparent text-[#f2efe9]/60 hover:text-[#f2efe9]'
            }`}
          >
            POLAROIDS ({photos.length})
          </button>
          <button
            type="button"
            data-testid="album-tab-tapes"
            onClick={() => setActiveTab('tapes')}
            className={`px-4 py-3 text-xs font-mono uppercase tracking-[0.15em] border-b-2 transition-colors cursor-pointer ${
              activeTab === 'tapes'
                ? 'border-[#ffcf8a] text-[#ffcf8a] font-semibold'
                : 'border-transparent text-[#f2efe9]/60 hover:text-[#f2efe9]'
            }`}
          >
            TAPES ({tapes.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'polaroids' ? (
            <div>
              {/* Car Filter Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['ALL', 'Car A (Lead)', 'Car B (Mid)', 'Car C (Rear)'] as const).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setCarFilter(filter)}
                      className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.12em] border cursor-pointer ${
                        carFilter === filter
                          ? 'bg-[#ffcf8a] text-[#0a0c0a] border-[#ffcf8a] font-semibold'
                          : 'bg-[#121613] text-[#f2efe9]/75 border-[#f2efe9]/20 hover:bg-[#1a201c]'
                      }`}
                    >
                      {filter === 'ALL' ? 'All Cars' : filter}
                    </button>
                  )
                )}
              </div>

              {photos.length === 0 ? (
                <div className="py-12 text-center border border-[#f2efe9]/15 bg-[#090b0a] p-6">
                  <p className="text-sm font-mono text-[#f2efe9]/75 mb-2">No Polaroids yet.</p>
                  <p className="text-xs text-[#f2efe9]/55 mb-4">
                    Evidentiary photo captured on Polaroid 600 emulsion.
                  </p>
                  <button
                    type="button"
                    data-testid="album-tap-camera-button"
                    onClick={() => {
                      onClose();
                      onOpenCamera();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] bg-[#ffcf8a] text-[#0a0c0a] font-semibold hover:bg-[#ffdca8] cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Tap Camera</span>
                  </button>
                </div>
              ) : filteredPhotos.length === 0 ? (
                <div className="py-10 text-center border border-[#f2efe9]/15 bg-[#090b0a] p-6">
                  <p className="text-sm font-mono text-[#f2efe9]/75">No prints from this car.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Thumbnails list */}
                  <div className="md:col-span-5 grid grid-cols-2 gap-3 content-start">
                    {filteredPhotos.map((photo) => {
                      const isSelected = selectedPhoto?.id === photo.id;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          data-testid={`polaroid-thumb-${photo.id}`}
                          onClick={() => setSelectedPhotoId(photo.id)}
                          className={`p-2 bg-[#f2efe9] text-[#0a0c0a] text-left border-2 transition-transform cursor-pointer ${
                            isSelected ? 'border-[#ffcf8a] scale-[1.02]' : 'border-transparent opacity-85 hover:opacity-100'
                          }`}
                        >
                          <div className="aspect-square w-full bg-[#141715] overflow-hidden mb-2 flex items-center justify-center">
                            {photo.developed ? (
                              <img
                                src={photo.dataUrl}
                                alt={`Polaroid at stop ${photo.stopNumber}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-2">
                                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#ffcf8a]">
                                  Undeveloped print
                                </div>
                                <div className="text-[9px] font-mono text-[#f2efe9]/60 mt-1">
                                  Develops after the ride
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.08em] font-semibold truncate">
                            Polaroid at stop {photo.stopNumber}
                          </div>
                          <div className="text-[9px] font-mono text-[#0a0c0a]/70 truncate">
                            {photo.developed
                              ? photo.anomalyTitle ?? 'Nothing out of place'
                              : 'Undeveloped print'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Evidence Inspector */}
                  {selectedPhoto && (
                    <div
                      data-testid="selected-evidence-panel"
                      className="md:col-span-7 bg-[#090b0a] border border-[#f2efe9]/15 p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.16em] text-[#ffcf8a] mb-3">
                          <span>Selected Evidence</span>
                          <span>
                            {selectedPhoto.developed
                              ? selectedPhoto.anomalyId
                                ? 'Verified Anomaly Evidence'
                                : 'NOTHING OUT OF PLACE'
                              : 'STILL DEVELOPING'}
                          </span>
                        </div>

                        <div className="aspect-square w-full max-w-[240px] mx-auto bg-[#141715] border border-[#f2efe9]/20 mb-4 flex items-center justify-center overflow-hidden">
                          {selectedPhoto.developed ? (
                            <img
                              src={selectedPhoto.dataUrl}
                              alt={`Polaroid at stop ${selectedPhoto.stopNumber}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-4">
                              <div className="text-xs font-mono uppercase tracking-[0.16em] text-[#ffcf8a] mb-1">
                                Undeveloped print
                              </div>
                              <div className="text-[11px] text-[#f2efe9]/65">
                                Develops after the ride
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="font-mono font-semibold text-sm text-[#f2efe9]">
                            {selectedPhoto.developed
                              ? selectedPhoto.anomalyTitle ?? 'Nothing out of place.'
                              : 'Undeveloped print'}
                          </div>
                          <p className="text-[#f2efe9]/75 leading-relaxed">
                            {selectedPhoto.developed
                              ? selectedPhoto.reportDescription ??
                                'No unusual phenomena detected in frame.'
                              : 'Polaroid 600 prints take their time. This one will be ready at the end of the ride.'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#f2efe9]/15 grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-[0.12em]">
                        <div>
                          <div className="text-[#f2efe9]/50">CONSIST CAR LOCATION</div>
                          <div className="text-[#f2efe9] mt-0.5">
                            {formatCarLocationForPolaroid(selectedPhoto.carLocation)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#f2efe9]/50">MTA TRANSIT LINE</div>
                          <div className="text-[#f2efe9] mt-0.5">
                            {selectedPhoto.routeId} Line · Stop {selectedPhoto.stopNumber}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Tapes Tab */
            <div data-testid="album-tapes-list">
              {tapes.length === 0 ? (
                <div className="py-12 text-center border border-[#f2efe9]/15 bg-[#090b0a] p-6">
                  <Disc className="w-6 h-6 text-[#ffcf8a]/60 mx-auto mb-2" />
                  <p className="text-sm font-mono text-[#f2efe9]/80 mb-2">No tapes yet.</p>
                  <p className="text-xs text-[#f2efe9]/60 max-w-md mx-auto leading-relaxed">
                    {hasRecorder
                      ? 'Press R to raise it, tune slowly, and hold record when something comes through.'
                      : 'You don’t have anything to record with.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tapes.map((tape) => (
                    <div
                      key={tape.id}
                      data-testid={`tape-item-${tape.id}`}
                      className="bg-[#090b0a] border border-[#f2efe9]/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#ffcf8a]">
                            {tape.frequencyMhz.toFixed(2)} MHz
                          </span>
                          <span className="text-xs font-mono font-semibold text-[#f2efe9]">
                            {tape.title}
                          </span>
                          {tape.isCarrierOnly && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] bg-[#1a201c] text-[#f2efe9]/70 border border-[#f2efe9]/20">
                              Carrier Wave
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#f2efe9]/80 italic leading-relaxed">
                          {tape.transcript}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <TapePlayButton
                          tape={tape}
                          isPlaying={playingTapeId === tape.id}
                          onTogglePlay={onTogglePlayTape}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
