import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsStore } from '../settings';
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_IDS,
  evaluateUnlockedAchievements,
  resolveAchievementsCatalog,
} from './achievements';
import {
  computeAnomalyAccuracyPercent,
  computeSanityRetainedPercent,
  ENDING_CATALOG,
  ENDING_IDS,
  evaluateRideEnding,
  formatStopReportNotes,
  resolveEndingsCatalog,
} from './endings';
import { gameEngine } from './gameState';

test('evaluateRideEnding resolves all 8 canonical endings in strict priority order', () => {
  assert.equal(ENDING_IDS.length, 8);

  // 1. The Unbroken Mask (peakSuspicion === 0)
  const e1 = evaluateRideEnding({
    route: 'G',
    selectedExit: 'escalators',
    peakSuspicion: 0,
    sanityRetainedPercent: 85,
    anomalyAccuracyPercent: 100,
    tapesCount: 0,
    hasConductorOnTape: false,
    restraintHeld: false,
    falseStopTrialsCount: 0,
    interventionsCount: 0,
    steppedOffAtBait: false,
  });
  assert.equal(e1.id, 'unbroken_mask');
  assert.equal(e1.badge, '[SECRET: THE UNBROKEN MASK]');
  assert.equal(e1.primaryButtonLabel, 'Ride again');
  assert.ok(e1.narrativeText.includes('Court Sq'));

  // 2a. The Eternal Commute via Stop 12 bait (when peakSuspicion > 0)
  const e2Bait = evaluateRideEnding({
    route: 'G',
    selectedExit: null,
    peakSuspicion: 10,
    sanityRetainedPercent: 90,
    anomalyAccuracyPercent: 100,
    tapesCount: 3,
    hasConductorOnTape: true,
    restraintHeld: true,
    falseStopTrialsCount: 0,
    interventionsCount: 0,
    steppedOffAtBait: true,
  });
  assert.equal(e2Bait.id, 'eternal_commute');
  assert.equal(e2Bait.badge, '[LOOP: THE ETERNAL COMMUTE]');
  assert.equal(e2Bait.primaryButtonLabel, 'Get back on');
  assert.ok(e2Bait.narrativeText.includes('Hoyt–Schermerhorn'));
  assert.ok(e2Bait.summary.includes('21 St'));

  // 2b. The Eternal Commute via Sanity Retained < 30%
  const e2LowSanity = evaluateRideEnding({
    route: 'G',
    selectedExit: 'escalators',
    peakSuspicion: 20,
    sanityRetainedPercent: 29,
    anomalyAccuracyPercent: 100,
    tapesCount: 3,
    hasConductorOnTape: true,
    restraintHeld: true,
    falseStopTrialsCount: 0,
    interventionsCount: 0,
    steppedOffAtBait: false,
  });
  assert.equal(e2LowSanity.id, 'eternal_commute');
  assert.equal(e2LowSanity.primaryButtonLabel, 'Get back on');

  // 3. Midnight Terminal (lower_level, >=2 tapes, >=75% accuracy, peakSuspicion <= 30)
  const e3 = evaluateRideEnding({
    route: 'G',
    selectedExit: 'lower_level',
    peakSuspicion: 30,
    sanityRetainedPercent: 70,
    anomalyAccuracyPercent: 75,
    tapesCount: 2,
    hasConductorOnTape: false,
    restraintHeld: false,
    falseStopTrialsCount: 1,
    interventionsCount: 0,
    steppedOffAtBait: false,
  });
  assert.equal(e3.id, 'midnight_terminal');
  assert.equal(e3.badge, '[BRANCH: SIGNAL ARCHIVIST]');
  assert.ok(e3.narrativeText.includes('Track 4 clear. All units hold position.'));

  // 4. Skyward Catwalk (surface_hatch, restraintHeld, 0 trials, 0 interventions)
  const e4 = evaluateRideEnding({
    route: 'G',
    selectedExit: 'surface_hatch',
    peakSuspicion: 45,
    sanityRetainedPercent: 55,
    anomalyAccuracyPercent: 50,
    tapesCount: 0,
    hasConductorOnTape: false,
    restraintHeld: true,
    falseStopTrialsCount: 0,
    interventionsCount: 0,
    steppedOffAtBait: false,
  });
  assert.equal(e4.id, 'skyward_catwalk');
  assert.equal(e4.badge, '[BRANCH: SKYWARD VOID]');

  // 5. Dawn Horizon (escalators, restraintHeld, 0 trials, conductor tape, sanityRetained >= 60%)
  const e5 = evaluateRideEnding({
    route: 'G',
    selectedExit: 'escalators',
    peakSuspicion: 25,
    sanityRetainedPercent: 60,
    anomalyAccuracyPercent: 50,
    tapesCount: 1,
    hasConductorOnTape: true,
    restraintHeld: true,
    falseStopTrialsCount: 0,
    interventionsCount: 0,
    steppedOffAtBait: false,
  });
  assert.equal(e5.id, 'dawn_horizon');
  assert.equal(e5.badge, '[BRANCH: DAWN HORIZON]');

  // 6. Exposed (interventionsCount > 0 beats falseStopTrialsCount > 0)
  const e6 = evaluateRideEnding({
    route: 'G',
    selectedExit: 'escalators',
    peakSuspicion: 60,
    sanityRetainedPercent: 50,
    anomalyAccuracyPercent: 50,
    tapesCount: 0,
    hasConductorOnTape: false,
    restraintHeld: false,
    falseStopTrialsCount: 2,
    interventionsCount: 1,
    steppedOffAtBait: false,
  });
  assert.equal(e6.id, 'exposed');
  assert.equal(e6.badge, '[TERMINAL: EXPOSED]');

  // 7. Disoriented Collapse (falseStopTrialsCount > 0 when interventionsCount === 0)
  const e7 = evaluateRideEnding({
    route: 'G',
    selectedExit: 'escalators',
    peakSuspicion: 20,
    sanityRetainedPercent: 50,
    anomalyAccuracyPercent: 50,
    tapesCount: 0,
    hasConductorOnTape: false,
    restraintHeld: false,
    falseStopTrialsCount: 1,
    interventionsCount: 0,
    steppedOffAtBait: false,
  });
  assert.equal(e7.id, 'disoriented_collapse');
  assert.equal(e7.badge, '[COLLAPSE: DISORIENTED]');
  assert.ok(e7.narrativeText.includes('Jackson Ave'));

  // 8. Civilian Extraction (fallback)
  const e8 = evaluateRideEnding({
    route: 'G',
    selectedExit: 'escalators',
    peakSuspicion: 20,
    sanityRetainedPercent: 55,
    anomalyAccuracyPercent: 50,
    tapesCount: 0,
    hasConductorOnTape: false,
    restraintHeld: false,
    falseStopTrialsCount: 0,
    interventionsCount: 0,
    steppedOffAtBait: false,
  });
  assert.equal(e8.id, 'civilian_extraction');
  assert.equal(e8.badge, '[STANDARD: EXTRACTION]');
  assert.ok(e8.narrativeText.includes('Long Island City'));
  assert.equal(ENDING_CATALOG.civilian_extraction.summaryTemplate, 'An ordinary arrival.');
});

test('computeSanityRetainedPercent, computeAnomalyAccuracyPercent, and formatStopReportNotes match v5.3 rules', () => {
  const pct = computeSanityRetainedPercent({
    stopDecisions: [
      {
        segmentId: '2',
        stopNumber: 2,
        stationName: 'Fulton St',
        stopType: 'real',
        doorTell: 'none',
        steppedOff: false,
        sanityAfter: 90,
        sanityBandMin: 80,
        sanityBandMax: 100, // 50% of band
      },
      {
        segmentId: '3',
        stopNumber: 3,
        stationName: 'Clinton–Washington Avs',
        stopType: 'real',
        doorTell: 'none',
        steppedOff: false,
        sanityAfter: 100,
        sanityBandMin: 80,
        sanityBandMax: 100, // 100% of band
      },
    ],
    finalSanity: 90,
    restraintHeld: true,
  });
  // Average of 50% and 100% = 75% (RESTRAINT_CEILING_RAISE only raises ceiling, not percentage)
  assert.equal(pct, 75);
  assert.equal(
    computeSanityRetainedPercent({
      stopDecisions: [],
      finalSanity: 100,
      restraintHeld: false,
    }),
    0
  );

  assert.equal(computeAnomalyAccuracyPercent(3, 4), 75);
  assert.equal(computeAnomalyAccuracyPercent(0, 0), 100);

  const stop9Notes = formatStopReportNotes({
    segmentId: '9',
    stopNumber: 9,
    stationName: 'Metropolitan Av',
    stopType: 'false',
    doorTell: 'doors_open_early',
    steppedOff: false,
    sanityAfter: 50,
    sanityBandMin: 30,
    sanityBandMax: 70,
  });
  assert.equal(stop9Notes.stopBadgeLabel, 'False Stop');
  assert.equal(
    stop9Notes.tellNote,
    'The tell: the doors opened early, and the announcement lied.'
  );

  const stop6bNotes = formatStopReportNotes({
    segmentId: '6b',
    stopNumber: 6,
    stationName: 'Myrtle–Willoughby Avs',
    stopType: 'false',
    doorTell: 'lights_flicker',
    steppedOff: false,
    sanityAfter: 70,
    sanityBandMin: 50,
    sanityBandMax: 85,
  });
  assert.equal(stop6bNotes.tellNote, 'The tell: the lights flickered as you pulled in.');
  assert.equal(
    stop6bNotes.parentNote,
    'Mom said it was your transfer. She was wrong. The doors weren’t.'
  );
});

test('evaluateUnlockedAchievements unlocks all 8 canonical achievements and persists on saving runs only', () => {
  assert.equal(ACHIEVEMENT_IDS.length, 8);
  assert.equal(
    ACHIEVEMENT_CATALOG.chief_archivist.description,
    'Catalog and document at least 6 distinct anomaly types in your case files.'
  );

  const unlocked = evaluateUnlockedAchievements({
    existingUnlockedIds: [],
    documentedAnomaliesCount: 6,
    anomaliesCaughtCount: 2,
    rideAnomalies: [
      {
        id: 'misprint',
        title: 'The Misprint',
        psychClass: 'I',
        stopNumber: 2,
        segmentId: '2',
        reportDescription: 'The GREENPOINT SAVINGS ad had a typo: "GRFENPOINT SAVINGS"',
        caught: true,
        caughtByPhoto: true,
      },
    ],
    photos: [],
    tapes: [
      {
        id: 'dispatch_track_2',
        frequencyMhz: 88.9,
        title: 'Dispatch, track 2',
        transcript: '...hold...',
        isCarrierOnly: false,
        isSecretBroadcaster: false,
        stopNumber: 7,
      },
      {
        id: 'conductor_echo',
        frequencyMhz: 96.3,
        title: 'The conductor',
        transcript: '...conductor...',
        isCarrierOnly: false,
        isSecretBroadcaster: false,
        stopNumber: 8,
      },
      {
        id: 's7_night_wiretap',
        frequencyMhz: 103.5,
        title: 'Flushing Av night wiretap',
        transcript: '...whistling...',
        isCarrierOnly: false,
        isSecretBroadcaster: true,
        stopNumber: 9,
      },
    ],
    hasSecretBroadcasterEvp: true,
    trestleWitnessed: true,
    rideCompleted: true,
    steppedOffAtBait: false,
    peakSuspicion: 0,
    resolvedEnding: evaluateRideEnding({
      route: 'G',
      selectedExit: 'escalators',
      peakSuspicion: 0,
      sanityRetainedPercent: 95,
      anomalyAccuracyPercent: 100,
      tapesCount: 3,
      hasConductorOnTape: true,
      restraintHeld: true,
      falseStopTrialsCount: 0,
      interventionsCount: 0,
      steppedOffAtBait: false,
    }),
  });

  assert.deepEqual(unlocked, [...ACHIEVEMENT_IDS]);

  // Verify gameEngine.chooseCourtSqExit saves on normal ride and skips saving on practice run
  settingsStore.eraseSavedProgress();
  settingsStore.update({ debugOverlay: false });

  // Practice run (Chapter 2): should NOT increment finishedRides or document ending
  gameEngine.startRide({ chapter: 2, practice: true });
  gameEngine.enterSegment(12);
  gameEngine.arriveAtCurrentStop();
  gameEngine.chooseCourtSqExit('escalators');
  assert.equal(gameEngine.getSnapshot().isPracticeRun, true);
  assert.equal(settingsStore.getArchive().finishedRides, 0);
  assert.equal(settingsStore.getArchive().documentedEndings.length, 0);

  // Saving run (Chapter 1): increments finishedRides and documents ending
  gameEngine.startRide({ chapter: 1, practice: false });
  gameEngine.enterSegment(12);
  gameEngine.arriveAtCurrentStop();
  gameEngine.chooseCourtSqExit('escalators');
  assert.equal(gameEngine.getSnapshot().phase, 'end');
  assert.equal(gameEngine.getSnapshot().resolvedEnding?.id, 'unbroken_mask');
  assert.equal(settingsStore.getArchive().finishedRides, 1);
  assert.ok(settingsStore.getArchive().documentedEndings.includes('unbroken_mask'));

  const endingsCat = resolveEndingsCatalog(settingsStore.getArchive(), 'G');
  assert.equal(endingsCat.documentedEndingsCount, 1);

  const achCat = resolveAchievementsCatalog(settingsStore.getArchive());
  assert.ok(achCat.unlockedCount >= 2); // the_unbroken_mask + loop_breaker
});

