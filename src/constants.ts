import type { AdCopyDefinition, RouteLineId, SegmentRule, SettingsState } from './types';

/**
 * All tuning numbers, canonical v5.3 strings, and data-driven tables in one place.
 */

export const FORWARD_X = -1 as const;

export const STORAGE_KEYS = {
  SETTINGS: 'last_local_v1_settings',
  ARCHIVE: 'last_local_v1_archive',
} as const;

// 3-Car Consist Geometry & Spatial Layout
// Cars A (lead, x ≈ -19.5), B (mid, x = 0), C (rear, x ≈ +19.5)
export const CAR_CENTERS_X = {
  A: -19.5,
  B: 0,
  C: 19.5,
} as const;

export const CAR_LENGTH = 17.6;
export const CAR_HALF_LENGTH = CAR_LENGTH / 2; // 8.8m
export const CAR_WIDTH = 2.92;
export const CAR_HALF_WIDTH = CAR_WIDTH / 2; // 1.46m
export const CAR_HEIGHT = 2.42;
export const GANGWAY_LENGTH = 1.9; // Connects x = ±8.8 to ±10.7
export const GANGWAY_WIDTH = 1.16;
export const GANGWAY_HEIGHT = 2.08;
export const GANGWAY_CENTERS_X = [-9.75, 9.75] as const;

// Player Movement & Camera Bounds
export const CAMERA_FOV_LANDSCAPE = 68;
export const CAMERA_NEAR = 0.08;
export const CAMERA_FAR = 120;
export const PLAYER_EYE_HEIGHT_SEATED = 1.24;
export const PLAYER_EYE_HEIGHT_STANDING = 1.62;
export const PLAYER_SEAT_X = 0;
export const PLAYER_SEAT_Z = 0.85;

export const WALK_MIN_X = -27.5;
export const WALK_MAX_X = 27.5;
export const WALK_CAR_HALF_Z = 0.56;
export const WALK_GANGWAY_HALF_Z = 0.34;
export const WALK_SPEED_MPS = 2.65;
export const WALK_SMOOTH_ACCEL = 11.5;
export const WALK_SMOOTH_DECEL = 13.5;
export const GANGWAY_DOOR_TRIGGER_DIST_X = 1.45;

// Look speeds & angle clamps
export const KEY_YAW_SPEED_RAD = 1.8;
export const KEY_PITCH_SPEED_RAD = 1.2;
export const MOUSE_SENSITIVITY_RAD_PER_PX = 0.0022;
export const TOUCH_LOOK_SENSITIVITY_RAD_PER_PX = 0.0042;
export const PITCH_MIN_RAD = -1.12;
export const PITCH_MAX_RAD = 1.12;
export const TRIAL_YAW_LIMIT_RAD = 1.35;

export const LOOK_SPEED_MIN = 0.4;
export const LOOK_SPEED_MAX = 2.0;
export const LOOK_SPEED_DEFAULT = 1.0;
export const LOOK_SPEED_STEP = 0.1;

// Head-whip thresholds
export const HEAD_WHIP_MOUSE_RAD_S = 5.5;
export const HEAD_WHIP_TOUCH_RAD_S = 8.0;
export const HEAD_WHIP_TOUCH_MIN_TURN_RAD = (75 * Math.PI) / 180;

// Breathing FOV modulation
export const BREATHING_BY_TIER = {
  High: { bpm: 0, amplitudeDeg: 0 },
  Medium: { bpm: 18, amplitudeDeg: 0.35 },
  Low: { bpm: 24, amplitudeDeg: 0.6 },
  Critical: { bpm: 32, amplitudeDeg: 0.9 },
} as const;
export const BREATHING_PER_FLAG_DEG = 0.22;
export const BREATHING_MAX_FLAG_BONUS_COUNT = 3;

// Heartbeat BPM by tier
export const HEARTBEAT_BPM_BY_TIER = {
  High: 64,
  Medium: 82,
  Low: 102,
  Critical: 118,
} as const;

// Sanity & Suspicion rules
export const SANITY_TIER_THRESHOLDS = {
  HIGH: 75,
  MEDIUM: 40,
  LOW: 10,
} as const;

export const SUSPICION_INTERVENTION_THRESHOLD = 60;
export const SUSPICION_INTERVENTION_RESET = 40;
export const COMPOSURE_INTACT_MAX_SUSPICION = 30;

export const SUSPICION_DELTAS = {
  FALSE_FLAG: 20,
  MASK_FAIL: 15,
  ANSWER_TIMEOUT: 8,
  VISIBLE_REACTION: 10,
  CLEAN_STOP: -5,
  REFUSE_SAFE_HAVEN: 10,
  CAMERA_FLASH_WATCHED: 12,
  RECORDER_HELD_PER_SEC: 4,
  TAPE_PLAYED_WATCHED: 8,
} as const;

export const SANITY_DELTAS = {
  DRIFT_ON_CEILING_DROP: -5,
  CLOCK: -2,
  CATCH: 2,
  MISS: -5,
  FALSE_FLAG: -3,
  MASK_FAIL: -4,
  TIMEOUT: -2,
  SAFE_HAVEN: 15,
  INTERVENTION: -5,
  TRIAL: -20,
  RESTRAINT_FAIL: -5,
  RESTRAINT_OK: 8,
} as const;

export const RESTRAINT_CEILING_RAISE = 6;
export const RESTRAINT_GRACE_SECONDS = 2.5;
export const FLAG_HOLD_SECONDS = 0.7;
export const FLAG_HOLD_DURATION_SEC = 0.7;

export const POLAROID_MAX_SHOTS = 6;
export const POLAROID_GAZE_THRESHOLD_RAD = 0.44;
export const POLAROID_FLASH_DECAY_PER_SEC = 2.8;

export const EVP_FREQ_MIN_MHZ = 88.1;
export const EVP_FREQ_MAX_MHZ = 107.9;
export const EVP_FREQ_DEFAULT_MHZ = 88.5;
export const EVP_FREQ_STEP_MHZ = 0.05;
export const EVP_LOCK_TOLERANCE_MHZ = 0.08;
export const EVP_SIGNAL_RANGE_MHZ = 0.25;
export const EVP_RECORD_DURATION_SEC = 1.6;

export const ANOMALY_GAZE_THRESHOLD_INITIAL_RAD = 0.7;
export const ANOMALY_GAZE_THRESHOLD_8S_RAD = 0.35;
export const ANOMALY_GAZE_THRESHOLD_FINAL_3S_RAD = 0.2;
export const ANOMALY_CLOSE_UP_MAX_DIST_M = 5.0;

// Sanity bands by stop number (1..13)
export const SANITY_BANDS_BY_STOP: Record<number, readonly [number, number]> = {
  1: [80, 100],
  2: [80, 100],
  3: [80, 100],
  4: [70, 95],
  5: [50, 85],
  6: [50, 85],
  7: [30, 70],
  8: [30, 70],
  9: [30, 70],
  10: [5, 30],
  11: [0, 9],
  12: [0, 9],
  13: [0, 9],
} as const;

// Lighting & Post-Processing
export const TONE_MAPPING_EXPOSURE = 1.05;
export const TUNNEL_FOG_COLOR = 0x040504;
export const TUNNEL_FOG_NEAR = 9;
export const TUNNEL_FOG_FAR = 30;
export const FLUORESCENT_LIGHT_COLOR = 0xfff0d4;
export const FLUORESCENT_LIGHT_DISTANCE = 9.5;
export const FLUORESCENT_LIGHT_DECAY = 1.6;
export const AMBER_ACCENT_COLOR = 0xffcf8a;
export const COLD_PANEL_COLOR = 0x7ab8ff;

// Performance Governor
export const MAX_PIXEL_RATIO_DESKTOP = 2.0;
export const MAX_PIXEL_RATIO_TOUCH = 1.75;
export const MIN_PIXEL_RATIO = 1.0;
export const GOVERNOR_SAMPLE_FRAMES = 90;
export const GOVERNOR_FRAME_TIME_THRESHOLD_MS = 25;
export const GOVERNOR_PIXEL_RATIO_STEP = 0.25;

// Default Settings
export const DEFAULT_SETTINGS: SettingsState = {
  lookSpeed: LOOK_SPEED_DEFAULT,
  invertY: false,
  gameVolume: 0.85,
  musicVolume: 0.75,
  screenEffects: 'system',
  fullscreenOnBoard: false,
  startMuted: false,
  showHints: true,
  vibrateOnCatch: true,
  rawMouse: true,
  smoothWalking: false,
  debugOverlay: false,
};

// Canonical v5.3 Ad Copy (Section 6)
export const ADS_ACROSS_AISLE: readonly AdCopyDefinition[] = [
  {
    id: 'greenpoint_savings',
    headline: 'GREENPOINT SAVINGS',
    warpedHeadline: 'GREENPOINT SAVES US',
    tagline: 'Your money. Closer to home.',
    subtext: 'Branches in Brooklyn and Queens',
    bgColor: '#173628',
    accentColor: '#8ad4a4',
    textColor: '#f4f1ea',
    placement: 'across',
  },
  {
    id: 'kessler_dental',
    headline: 'KESSLER DENTAL',
    warpedHeadline: 'KESSLER DENIAL',
    tagline: 'Smile like you mean it.',
    subtext: 'New patients welcome, evenings too',
    bgColor: '#1a2e44',
    accentColor: '#90c8f8',
    textColor: '#f5f5f2',
    placement: 'across',
  },
  {
    id: 'halloran_mattress',
    headline: 'HALLORAN MATTRESS',
    warpedHeadline: 'HALLORAN MATTERS',
    tagline: "Sleep like nothing's wrong.",
    subtext: 'Free delivery to Brooklyn and Queens',
    bgColor: '#3a2229',
    accentColor: '#f0b694',
    textColor: '#f7f2eb',
    placement: 'across',
  },
  {
    id: 'learn_a_trade',
    headline: 'LEARN A TRADE',
    warpedHeadline: 'LEARN A TRACE',
    tagline: 'Night classes at Borough Tech.',
    subtext: 'Electrical, HVAC, welding, carpentry',
    bgColor: '#382d18',
    accentColor: '#ffd478',
    textColor: '#f8f4ec',
    placement: 'across',
  },
  {
    id: 'courtesy_counts',
    headline: 'COURTESY COUNTS',
    warpedHeadline: 'COURTESY COUNTS DOWN',
    tagline: 'Offer your seat to someone who needs it.',
    subtext: 'A message from your fellow riders',
    bgColor: '#22272c',
    accentColor: '#ffcf8a',
    textColor: '#f2efe9',
    placement: 'across',
  },
];

export const ADS_NEAR_SEAT: readonly AdCopyDefinition[] = [
  {
    id: 'midnight_diner',
    headline: 'MIDNIGHT DINER',
    tagline: 'Open until the last train.',
    subtext: 'Myrtle and Willoughby',
    bgColor: '#2c1d19',
    accentColor: '#f5b87a',
    textColor: '#f6f1e8',
    placement: 'near',
  },
  {
    id: 'tax_help_now',
    headline: 'TAX HELP NOW',
    tagline: 'Walk-ins welcome, fast filing.',
    subtext: 'Court Sq, second floor',
    bgColor: '#1d2d24',
    accentColor: '#a2d9b1',
    textColor: '#f3f1ec',
    placement: 'near',
  },
  {
    id: 'see_a_doctor',
    headline: 'SEE A DOCTOR TODAY',
    tagline: 'Same-day visits, most insurance.',
    subtext: 'Clinics near every G stop',
    bgColor: '#1e2b38',
    accentColor: '#98c4eb',
    textColor: '#f4f3ef',
    placement: 'near',
  },
  {
    id: 'read_more',
    headline: 'READ MORE',
    tagline: 'Your library card is completely free.',
    subtext: 'Brooklyn Public Library',
    bgColor: '#2d2638',
    accentColor: '#d4b8f0',
    textColor: '#f5f2ec',
    placement: 'near',
  },
];

// Canonical v5.3 Route Stops
export const G_TRAIN_STOPS: readonly string[] = [
  'Hoyt–Schermerhorn',
  'Fulton St',
  'Clinton–Washington Avs',
  'Classon Av',
  'Bedford–Nostrand Avs',
  'Myrtle–Willoughby Avs',
  'Flushing Av',
  'Broadway',
  'Metropolitan Av',
  'Nassau Av',
  'Greenpoint Av',
  '21 St',
  'Court Sq',
];

export const L_TRAIN_STOPS: readonly string[] = [
  '8th Av',
  '6th Av',
  'Union Sq–14th St',
  '3rd Av',
  '1st Av',
  'Bedford Av',
  'Lorimer St',
  'Graham Av',
  'Grand St',
  'Montrose Av',
  'Morgan Av',
  'Jefferson St',
  'Myrtle–Wyckoff Avs',
];

export const GHOST_7_STOPS: readonly string[] = [
  'Times Sq–42nd St',
  '5th Av–Bryant Pk',
  'Grand Central',
  'Abandoned Steinway Platform',
  'Hunters Point Depths',
  'Vernon–Jackson Void',
  'Sunken Yard Switch 9',
  'Dead Track Gantry',
  'Queensboro Cavern',
  'Rawlings Switch',
  'Court Sq Tower Vault',
  'Upper Switch 12',
  'Terminal Echo',
];

export const ROUTE_METADATA: Record<
  RouteLineId,
  {
    id: RouteLineId;
    name: string;
    description: string;
    stops: readonly string[];
    bulletColor: string;
  }
> = {
  G: {
    id: 'G',
    name: 'G Brooklyn–Queens Crosstown',
    description:
      'The ride as it was meant: Brooklyn to Queens, climbing out over Newtown Creek before Court Sq.',
    stops: G_TRAIN_STOPS,
    bulletColor: '#6cbe45',
  },
  L: {
    id: 'L',
    name: 'L 14th St–Canarsie Express',
    description:
      "The same ride on the L's stations, 8th Av to Myrtle–Wyckoff. It never leaves the tunnel.",
    stops: L_TRAIN_STOPS,
    bulletColor: '#a7a9ac',
  },
  '7': {
    id: '7',
    name: '7 Ghost Line (Abandoned Spur)',
    description:
      'The same ride on stations no map shows, Times Sq to Terminal Echo. It never leaves the tunnel.',
    stops: GHOST_7_STOPS,
    bulletColor: '#b933ad',
  },
};

// Canonical v5.3 Segment Table (Stops 2..13 including 6b)
export const SEGMENT_TABLE: readonly SegmentRule[] = [
  {
    id: '2',
    stopNumber: 2,
    stationIndex: 1,
    anomaliesCount: 1,
    stopType: 'real',
    doorTell: 'none',
    chatIndex: 0,
    maskChecksCount: 0,
  },
  {
    id: '3',
    stopNumber: 3,
    stationIndex: 2,
    anomaliesCount: 1,
    stopType: 'real',
    doorTell: 'none',
    maskChecksCount: 1,
  },
  {
    id: '4',
    stopNumber: 4,
    stationIndex: 3,
    anomaliesCount: 1,
    stopType: 'false',
    forgivingFalseStop: true,
    doorTell: 'doors_open_early',
    chatIndex: 1,
    maskChecksCount: 0,
  },
  {
    id: '5',
    stopNumber: 5,
    stationIndex: 4,
    anomaliesCount: 1,
    stopType: 'real',
    doorTell: 'none',
    maskChecksCount: 1,
    whisper: true,
  },
  {
    id: '6',
    stopNumber: 6,
    stationIndex: 5,
    anomaliesCount: 1,
    stopType: 'haven',
    doorTell: 'none',
    chatIndex: 2,
    maskChecksCount: 0,
  },
  {
    id: '6b',
    stopNumber: 6,
    stationIndex: 5,
    anomaliesCount: 0,
    forcedAnomalyCategory: 'route_map_error',
    stopType: 'false',
    doorTell: 'lights_flicker',
    maskChecksCount: 0,
    silent: true,
    thin: true,
    cruiseDurationSec: 13,
  },
  {
    id: '7',
    stopNumber: 7,
    stationIndex: 6,
    anomaliesCount: 2,
    stopType: 'real',
    doorTell: 'none',
    maskChecksCount: 1,
    crowd: true,
  },
  {
    id: '8',
    stopNumber: 8,
    stationIndex: 7,
    anomaliesCount: 2,
    stopType: 'real',
    doorTell: 'none',
    maskChecksCount: 2,
    crowd: true,
  },
  {
    id: '9',
    stopNumber: 9,
    stationIndex: 8,
    anomaliesCount: 1,
    stopType: 'false',
    doorTell: 'doors_open_early',
    paLie: 'This is Court Square. Last stop. Everybody off the train.',
    chatIndex: 3,
    maskChecksCount: 0,
  },
  {
    id: '10',
    stopNumber: 10,
    stationIndex: 9,
    anomaliesCount: 1,
    forcedAnomalyCategory: 'parent',
    stopType: 'real',
    doorTell: 'none',
    maskChecksCount: 1,
  },
  {
    id: '11',
    stopNumber: 11,
    stationIndex: 10,
    anomaliesCount: 0,
    stopType: 'real',
    doorTell: 'none',
    restraint: true,
    chatIndex: 4,
    maskChecksCount: 0,
  },
  {
    id: '12',
    stopNumber: 12,
    stationIndex: 11,
    anomaliesCount: 1,
    forcedAnomalyCategory: 'critical',
    stopType: 'bait',
    doorTell: 'lights_flicker',
    maskChecksCount: 1,
  },
  {
    id: '13',
    stopNumber: 13,
    stationIndex: 12,
    anomaliesCount: 0,
    stopType: 'final',
    doorTell: 'none',
    cruiseDurationSec: 16,
    exitChoice: true,
    maskChecksCount: 0,
  },
];

// Canonical v5.3 UI Strings for Start Screen & Settings
export const UI_STRINGS = {
  TITLE: 'LAST LOCAL',
  SUBTITLE_GENRE: 'A Liminal Subway Horror Game',
  SUBTITLE_DEST: 'LAST LOCAL — to Court Sq',
  DESCRIPTION:
    'Every stop takes you further from home. A first-person liminal horror ride on the NYC G train: spot subtle anomalies, keep your composure in front of your parents, and learn which doors are safe.',
  NIGHTMARE_LABEL: 'Nightmare mode',
  NIGHTMARE_DESC: 'Faster train, flickering tubes, sharper-eyed parents, faster sanity loss',
  UNLOCK_HINT: 'Nightmare mode and chapter select: finish a ride to unlock',
  START_FROM_LABEL: 'Start from',
  HOW_TO_PLAY_1_TITLE: '1. Notice.',
  HOW_TO_PLAY_1_BODY: 'When something in the car changes, look at it and hold',
  HOW_TO_PLAY_2_TITLE: "2. Don't show it.",
  HOW_TO_PLAY_2_BODY:
    'Staring at something wrong, or whipping your head around, while a parent is looking at you raises their suspicion. When they talk to you, answer like nothing is wrong.',
  HOW_TO_PLAY_3_TITLE: '3. Read the doors.',
  HOW_TO_PLAY_3_BODY:
    'At every stop you can stay on or step off. Assume stepping off is a trap. Your parents usually know when to get off, but they can be wrong.',
  DOORS_NEVER_LIE: 'The doors never lie.',
  CONTROLS_BADGE: 'Keyboard and mouse',
  POINTER_LOCK_HINT: 'Click in the train, then move the mouse (or use the arrow keys)',
} as const;

// Ride Motion, Tunnel Pool, and Station Timing Constants
export const DEFAULT_CRUISE_DURATION_SEC = 18.0;
export const BRAKING_DURATION_SEC = 3.5;
export const DEPARTURE_ACCEL_DURATION_SEC = 2.8;
export const DOOR_CHIME_DURATION_SEC = 1.4;
export const EARLY_DOOR_OPEN_DELAY_SEC = 0.15;
export const STOP_DWELL_DURATION_SEC = 6.5;
export const PA_NEXT_STOP_ANNOUNCE_SEC = 7.0;
export const ROLLSIGN_DISPLAY_SEC = 3.6;

export const TRAIN_CRUISE_SPEED_MPS = 15.5;
export const TRAIN_NIGHTMARE_SPEED_MULT = 1.25;

// Pooled Tunnel Ring Parameters (Train travels toward -x; scenery streams toward +x)
export const TUNNEL_RING_COUNT = 24;
export const TUNNEL_RING_SPACING = 5.0; // Total span = 120m (-60m to +60m)
export const TUNNEL_HALF_SPAN = (TUNNEL_RING_COUNT * TUNNEL_RING_SPACING) / 2;

// Station Platform Parameters
export const STATION_PLATFORM_LENGTH = 62.0;
export const STATION_PLATFORM_WIDTH = 3.6;
export const STATION_PLATFORM_Z = -3.38; // Across the aisle (-Z side, directly visible from player seat)
export const PASSING_TRAIN_TRACK_Z = 3.25; // Opposite track (+Z side)
export const PASSING_TRAIN_SPEED_MPS = 24.0;

