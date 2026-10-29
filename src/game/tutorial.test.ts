import assert from 'node:assert/strict';
import test from 'node:test';
import { computeBreathingFovOffsetDeg } from '../graphics/sceneRenderer';
import { gameEngine } from './gameState';
import { TUTORIAL_STRINGS } from './tutorial';

test('computeBreathingFovOffsetDeg scales with sanity tier and false flags and zeroes out under reducedEffects', () => {
  assert.equal(
    computeBreathingFovOffsetDeg({
      elapsedSec: 1.0,
      sanityTier: 'High',
      falseFlagsCount: 3,
      reducedEffects: false,
    }),
    0
  );

  assert.equal(
    computeBreathingFovOffsetDeg({
      elapsedSec: 0.78,
      sanityTier: 'Critical',
      falseFlagsCount: 3,
      reducedEffects: true,
    }),
    0
  );

  // At Critical (32 bpm => freq = 32/60 Hz), quarter-period t = 60 / (32 * 4) = 0.46875s -> sin(pi/2) = 1
  const quarterPeriodSec = 60 / (32 * 4);
  const critNoFlags = computeBreathingFovOffsetDeg({
    elapsedSec: quarterPeriodSec,
    sanityTier: 'Critical',
    falseFlagsCount: 0,
    reducedEffects: false,
  });
  const critWithFlags = computeBreathingFovOffsetDeg({
    elapsedSec: quarterPeriodSec,
    sanityTier: 'Critical',
    falseFlagsCount: 3,
    reducedEffects: false,
  });

  assert.ok(Math.abs(critNoFlags - 0.9) < 0.01);
  assert.ok(critWithFlags > critNoFlags);
  assert.ok(Math.abs(critWithFlags - (0.9 + 3 * 0.22)) < 0.01);
});

test('Practice Stretch tutorial steps through Look around, Don’t show it, Read the doors, and You’re ready', () => {
  gameEngine.startPracticeStretch();
  let snap = gameEngine.getSnapshot();
  assert.equal(snap.phase, 'intro');
  assert.equal(snap.isPracticeRun, true);
  assert.equal(snap.tutorialState?.stepId, 'look_around');
  assert.equal(snap.tutorialState?.title, TUTORIAL_STRINGS.STEP_1_TITLE);
  assert.equal(snap.activeAnomaly?.id, 'window_residue');
  assert.equal(snap.activeAnomaly?.manifested, true);

  // Advance to Step 2: Don't show it
  gameEngine.advanceTutorialStep();
  snap = gameEngine.getSnapshot();
  assert.equal(snap.tutorialState?.stepId, 'dont_show_it');
  assert.equal(snap.activeMaskCheck?.question, TUTORIAL_STRINGS.STEP_2_QUESTION);

  // Answer odd option first -> feedback explains why ordinary answer is needed
  gameEngine.answerMaskCheck(1);
  snap = gameEngine.getSnapshot();
  assert.equal(snap.tutorialState?.feedbackText, TUTORIAL_STRINGS.STEP_2_ODD_FEEDBACK);

  // Answer calm option ("Just tired.") -> clears mask check with calm feedback
  gameEngine.answerMaskCheck(0);
  snap = gameEngine.getSnapshot();
  assert.equal(snap.activeMaskCheck, null);
  assert.equal(snap.tutorialState?.feedbackText, TUTORIAL_STRINGS.STEP_2_CALM_FEEDBACK);

  // Advance to Step 3: Read the doors
  gameEngine.advanceTutorialStep();
  snap = gameEngine.getSnapshot();
  assert.equal(snap.tutorialState?.stepId, 'read_the_doors');
  assert.equal(snap.tutorialState?.title, TUTORIAL_STRINGS.STEP_3_TITLE);

  // Advance to Step 4: You're ready
  gameEngine.advanceTutorialStep();
  snap = gameEngine.getSnapshot();
  assert.equal(snap.tutorialState?.stepId, 'ready');
  assert.equal(snap.tutorialState?.body, TUTORIAL_STRINGS.STEP_4_BODY);

  // Finish tutorial -> begins real ride to Court Square
  gameEngine.finishPracticeStretch();
  snap = gameEngine.getSnapshot();
  assert.equal(snap.phase, 'ride');
  assert.equal(snap.isPracticeRun, false);
  assert.equal(snap.tutorialState, null);
});

