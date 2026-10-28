/**
 * Core TypeScript definitions for LAST LOCAL (v5.3 Canonical).
 * Strictly typed with zero `any`.
 */

export type GamePhase = 'menu' | 'intro' | 'ride' | 'stop' | 'haven' | 'trial' | 'end';

export type SanityTier = 'High' | 'Medium' | 'Low' | 'Critical';

export type ScreenEffectsMode = 'system' | 'full' | 'reduced';

export type RouteLineId = 'G' | 'L' | '7';

export type ChapterStartOption = 1 | 2 | 3;

export type ExitChoiceId = 'escalators' | 'lower_level' | 'surface_hatch';

export type StopType = 'real' | 'false' | 'haven' | 'bait' | 'final';

export type DoorTellType = 'none' | 'doors_open_early' | 'lights_flicker';

export type RideSubPhase = 'cruising' | 'approaching' | 'braking' | 'chime' | 'doors_open' | 'departing';

export type ConsistCarId = 'A' | 'B' | 'C' | 'GANGWAY_AB' | 'GANGWAY_BC';

export type ConsistLocationLabel =
  | 'CAR A (LEAD)'
  | 'CAR B (MID)'
  | 'CAR C (REAR)'
  | 'GANGWAY COUPLING';

export type PassengerArchetype =
  | 'mom'
  | 'dad'
  | 'mta'
  | 'coat'
  | 'puffer'
  | 'hoodie'
  | 'texter'
  | 'overcoat'
  | 'office';

export type ParentSpeakerId = 'mom' | 'dad';

export type AnomalyId =
  | 'misprint'
  | 'window_residue'
  | 'cold_panel'
  | 'man_across_aisle'
  | 'route_map_error'
  | 'color_drift'
  | 'relocated_passenger'
  | 'additional_passenger'
  | 'warped_copy'
  | 'woman_on_bench'
  | 'mom_fixed'
  | 'dad_answering'
  | 'empty_car';

export type PsychClass = 'I' | 'II' | 'III' | 'IV';

export type EvidenceStatusChip = 'CAUGHT' | 'DOCUMENTED' | 'UNCONFIRMED' | 'NOTHING';

export interface ActiveAnomalyInstance {
  id: AnomalyId;
  title: string;
  psychClass: PsychClass;
  tierIndex: 0 | 1 | 2 | 3;
  reportDescription: string;
  caseFileNote: string;
  targetX: number;
  targetY: number;
  targetZ: number;
  closeUpRead: boolean;
  manifested: boolean;
  caught: boolean;
  variantKey: string;
  adIndex?: number;
  adSwappedHeadline?: string;
  adShiftedBgColor?: string;
  dadLine?: string;
}

export interface RideAnomalyRecord {
  id: AnomalyId;
  title: string;
  psychClass: PsychClass;
  stopNumber: number;
  segmentId: string;
  reportDescription: string;
  caught: boolean;
  caughtByPhoto?: boolean;
}

export interface MaskCheckOption {
  index: 0 | 1 | 2;
  text: string;
  isCalm: boolean;
}

export interface ActiveMaskCheckState {
  id: string;
  speakerId: ParentSpeakerId;
  speakerLabel: 'Mom' | 'Dad';
  question: string;
  options: readonly [MaskCheckOption, MaskCheckOption, MaskCheckOption];
  remainingSec: number;
  totalSec: number;
}

export interface SubtitleItem {
  id: string;
  speaker?: string;
  text: string;
  stageDirection?: string;
  isPa?: boolean;
}

export interface RollsignBanner {
  chapterNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
}

export interface AdCopyDefinition {
  id: string;
  headline: string;
  warpedHeadline?: string;
  tagline: string;
  subtext: string;
  bgColor: string;
  accentColor: string;
  textColor: string;
  placement: 'across' | 'near';
}

export interface SettingsState {
  lookSpeed: number;
  invertY: boolean;
  gameVolume: number;
  musicVolume: number;
  screenEffects: ScreenEffectsMode;
  fullscreenOnBoard: boolean;
  startMuted: boolean;
  showHints: boolean;
  vibrateOnCatch: boolean;
  rawMouse: boolean;
  smoothWalking: boolean;
  debugOverlay: boolean;
}

export interface ProgressArchive {
  finishedRides: number;
  documentedAnomalies: string[];
  unconfirmedAnomalies: string[];
  documentedEndings: string[];
  unlockedAchievements: string[];
}

export interface SegmentRule {
  id: string;
  stopNumber: number;
  stationIndex: number;
  anomaliesCount: number;
  forcedAnomalyCategory?: 'route_map_error' | 'parent' | 'critical';
  stopType: StopType;
  forgivingFalseStop?: boolean;
  doorTell: DoorTellType;
  chatIndex?: number;
  maskChecksCount: number;
  whisper?: boolean;
  silent?: boolean;
  thin?: boolean;
  crowd?: boolean;
  cruiseDurationSec?: number;
  paLie?: string;
  restraint?: boolean;
  exitChoice?: boolean;
}

export interface EngineSnapshot {
  phase: GamePhase;
  rideSubPhase: RideSubPhase;
  paused: boolean;
  muted: boolean;
  nightmareMode: boolean;
  startChapter: ChapterStartOption;
  activeRoute: RouteLineId;
  segmentTableIndex: number;
  stopIndex: number;
  segmentId: string;
  currentStationName: string;
  nextStationName: string;
  isOpenAirStation: boolean;
  trainSpeedMps: number;
  segmentElapsedSec: number;
  segmentDurationSec: number;
  stationDistanceM: number;
  doorOpenProgress: number;
  chimePlaying: boolean;
  activeDoorTell: DoorTellType;
  lightFlickerIntensity: number;
  rollsign: RollsignBanner | null;
  subtitle: SubtitleItem | null;
  selectedExit: ExitChoiceId | null;
  watchingParentLabel: 'Mom' | 'Dad' | null;
  activeMaskCheck: ActiveMaskCheckState | null;
  paranoidFlashText: string | null;
  interventionsCount: number;
  lastReactionReason: string | null;
  activeAnomaly: ActiveAnomalyInstance | null;
  flagHoldProgress: number;
  isFlagHolding: boolean;
  rideAnomalies: RideAnomalyRecord[];
  anomaliesSpawnedCount: number;
  anomaliesCaughtCount: number;
  falseFlagsCount: number;
  sanity: number;
  sanityTier: SanityTier;
  suspicion: number;
  peakSuspicion: number;
  fps: number;
  pixelRatio: number;
  isPracticeRun: boolean;
  isDebugRun: boolean;
  carLocation: ConsistLocationLabel;
  nearGangwayDoor: boolean;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  playerPitch: number;
}



