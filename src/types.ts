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

export interface TrialState {
  stage: 1 | 2 | 3;
  stopNumber: number;
  depth: number;
  steadyStairIndex: 0 | 1 | 2;
  steadyTrainSide: 'left' | 'right';
  feedbackText: string | null;
}

export interface FalseStopTrialRecord {
  stop: number;
  depth: number;
}

export interface ActiveRestraintState {
  active: boolean;
  isHolding: boolean;
  hasStartedHolding: boolean;
  elapsedSec: number;
  graceRemainingSec: number;
  holdProgress: number;
  dimOpacity: number;
  momFrozen: boolean;
  strangersVanished: boolean;
}

export interface StopDecisionRecord {
  segmentId: string;
  stopNumber: number;
  stationName: string;
  stopType: StopType;
  doorTell: DoorTellType;
  steppedOff: boolean;
  sanityAfter: number;
  sanityBandMin: number;
  sanityBandMax: number;
}

export interface PolaroidPhotoRecord {
  id: string;
  stopNumber: number;
  stationName: string;
  carLocation: ConsistLocationLabel;
  routeId: RouteLineId;
  dataUrl: string;
  anomalyId: AnomalyId | null;
  anomalyTitle: string | null;
  psychClass: PsychClass | null;
  reportDescription: string | null;
  developed: boolean;
  capturedAtSec: number;
}

export type EvpSignalId =
  | 'dispatch_track_2'
  | 'a_passenger'
  | 'dispatch_no_train'
  | 'someone_far_end'
  | 'static_then_time'
  | 'conductor_echo'
  | 'voice_like_moms'
  | 's5_dispatch_static'
  | 's4_phantom_pa'
  | 's7_night_wiretap'
  | 'emergency_channel'
  | 'decoy_carrier_1'
  | 'decoy_carrier_2'
  | 'carrier_90_20'
  | 'carrier_97_35'
  | 'carrier_104_30';

export interface EvpTapeRecord {
  id: EvpSignalId;
  frequencyMhz: number;
  title: string;
  transcript: string;
  isCarrierOnly: boolean;
  isSecretBroadcaster: boolean;
  stopNumber: number;
}

export type EndingId =
  | 'unbroken_mask'
  | 'eternal_commute'
  | 'midnight_terminal'
  | 'skyward_catwalk'
  | 'dawn_horizon'
  | 'exposed'
  | 'disoriented_collapse'
  | 'civilian_extraction';

export interface EndingResult {
  id: EndingId;
  index: number; // 1..8
  title: string;
  badge: string;
  narrativeText: string;
  summary: string;
  primaryButtonLabel: 'Get back on' | 'Ride again';
  isAlternativeEscape: boolean;
}

export type AchievementId =
  | 'first_contact'
  | 'silver_halide_evidence'
  | 'signal_hunter'
  | 'phantom_broadcaster'
  | 'the_unbroken_mask'
  | 'night_watch'
  | 'loop_breaker'
  | 'chief_archivist';

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
}

export type TutorialStepId = 'look_around' | 'dont_show_it' | 'read_the_doors' | 'ready';

export interface TutorialState {
  stepId: TutorialStepId;
  stepNumber: 1 | 2 | 3 | 4;
  title: string;
  body: string;
  coachHint: string;
  feedbackText: string | null;
  doorDemoStage: 'real' | 'false_early' | 'false_flicker' | 'summary';
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
  isOnTrestle: boolean;
  trestleProgress: number;
  trestleWitnessed: boolean;
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
  resolvedEnding: EndingResult | null;
  sanityRetainedPercent: number;
  anomalyAccuracyPercent: number;
  tutorialState: TutorialState | null;
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
  cameraOpen: boolean;
  polaroidShotsRemaining: number;
  polaroidFlashIntensity: number;
  photos: PolaroidPhotoRecord[];
  albumOpen: boolean;
  hasRecorder: boolean;
  evpOpen: boolean;
  evpFrequencyMhz: number;
  evpSignalStrength: number;
  evpLockedSignalId: EvpSignalId | null;
  evpLockedTitle: string | null;
  evpTranscriptLive: string | null;
  evpIsRecording: boolean;
  evpRecordProgress: number;
  evpLastSavedTitle: string | null;
  tapes: EvpTapeRecord[];
  playingTapeId: EvpSignalId | null;
  hasConductorEvp: boolean;
  hasSecretBroadcasterEvp: boolean;
  safeHavenVisited: boolean;
  trialState: TrialState | null;
  falseStopTrials: FalseStopTrialRecord[];
  activeRestraint: ActiveRestraintState | null;
  restraintHeld: boolean;
  restraintCompleted: boolean;
  restraintCeilingBonus: number;
  steppedOffAtBait: boolean;
  stopDecisions: StopDecisionRecord[];
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





