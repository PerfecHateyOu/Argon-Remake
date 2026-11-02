import { SANITY_DELTAS, SEGMENT_TABLE } from '../constants';
import { playerController } from '../input/keyLook';
import { pointerLock } from '../input/pointerLock';
import type {
  ActiveMaskCheckState,
  EngineSnapshot,
  FalseStopTrialRecord,
  SegmentRule,
  SubtitleItem,
  TrialState,
  TutorialState,
  TutorialStepId,
} from '../types';
import {
  buildActiveAnomalyInstance,
  isLookingAtAnomaly,
  stepFlagHoldProgress,
} from './anomalyManager';
import { resetPlayerCameraToSeatedEyeLevel } from './engineMovement';

export type TrialChoiceId =
  | 'terminus_sign'
  | 'opposite_sign'
  | 'left_stairs'
  | 'middle_stairs'
  | 'right_stairs'
  | 'left_train'
  | 'right_train';

export interface TutorialAndTrialAdapter {
  getSnapshot(): EngineSnapshot;
  getCurrentSegmentRule(): SegmentRule;
  update(patch: Partial<EngineSnapshot>): EngineSnapshot;
  showSubtitle(item: Omit<SubtitleItem, 'id'>, durationSec?: number): void;
  setSubtitleRemainingSec(sec: number): void;
  enterSegment(tableIndex: number): void;
  exitTrial(): void;
  finishPracticeStretch(): void;
  catchActiveAnomaly(caughtByPhoto?: boolean): boolean;
}

export const TUTORIAL_STRINGS = {
  STEP_1_TITLE: 'Look around',
  STEP_1_BODY:
    'Things in the car change while you’re not looking. Turn away from the windows across the aisle for a moment.',
  STEP_1_TURNED_FEEDBACK: 'Good. You can turn all the way around in your seat, too.',
  STEP_1_CAUGHT_FEEDBACK:
    'That’s it: a sticker that wasn’t there. Here we tell you. On the ride we won’t: flags are private, and you see how you did on the report at the end.',
  STEP_1_MISS_FEEDBACK: 'Not that. Look for something new on the windows across the aisle.',

  STEP_2_TITLE: 'Don’t show it',
  STEP_2_BODY:
    'Mom is watching you. While a parent watches, staring at something or whipping your head around raises their Suspicion. Flagging is private: it never does.',
  STEP_2_QUESTION: 'You okay, hon? You look pale.',
  STEP_2_CALM_OPTION: 'Just tired.',
  STEP_2_OFF_OPTION_1: 'Did that window just change?',
  STEP_2_OFF_OPTION_2: 'Someone keeps staring at us.',
  STEP_2_CALM_FEEDBACK: 'Good. Answer like nothing is wrong, even when something is.',
  STEP_2_TIMEOUT_FEEDBACK:
    'Too slow. On the ride, hesitating raises Suspicion too. Answer like nothing is wrong.',
  STEP_2_ODD_FEEDBACK:
    'On the ride, that would raise her Suspicion. Give the ordinary answer, even when something is wrong.',

  STEP_3_TITLE: 'Read the doors',
  STEP_3_BODY: 'At every stop you can stay on or step off. Watch the doors and listen.',
  STEP_3_REAL_TITLE: 'A real stop',
  STEP_3_REAL_BODY: 'Listen: the chime plays, and the doors open after it finishes.',
  STEP_3_FALSE_TITLE: 'A False Stop',
  STEP_3_FALSE_EARLY_BODY: 'Now the doors open before the chime finishes. That’s the tick.',
  STEP_3_FALSE_FLICKER_BODY:
    'Or the lights flicker once, hard, as the train arrives. That’s the other tick.',
  STEP_3_SUMMARY_TITLE: 'The tick never lies',
  STEP_3_SUMMARY_BODY:
    'Stepping off is a trap unless it’s a real stop your parents lead you to. They’re usually right, but not always: when you hear or see the tick, stay on.',

  STEP_4_TITLE: 'You’re ready',
  STEP_4_BODY:
    'That’s the practice stretch. Nothing in it counted. Your ride to Court Square starts now.',
} as const;

export function buildTutorialStepState(
  stepId: TutorialStepId,
  isTouch = false
): TutorialState {
  switch (stepId) {
    case 'look_around':
      return {
        stepId: 'look_around',
        stepNumber: 1,
        title: TUTORIAL_STRINGS.STEP_1_TITLE,
        body: TUTORIAL_STRINGS.STEP_1_BODY,
        coachHint: isTouch
          ? 'Drag the screen · Hold the FLAG button'
          : 'Click in the train, then move the mouse (or use the arrow keys) · Hold F while looking at anything that changes.',
        feedbackText: null,
        doorDemoStage: 'real',
      };
    case 'dont_show_it':
      return {
        stepId: 'dont_show_it',
        stepNumber: 2,
        title: TUTORIAL_STRINGS.STEP_2_TITLE,
        body: TUTORIAL_STRINGS.STEP_2_BODY,
        coachHint: isTouch ? 'Tap a choice' : 'Press 1, 2, or 3 to answer Mom',
        feedbackText: null,
        doorDemoStage: 'real',
      };
    case 'read_the_doors':
      return {
        stepId: 'read_the_doors',
        stepNumber: 3,
        title: TUTORIAL_STRINGS.STEP_3_TITLE,
        body: TUTORIAL_STRINGS.STEP_3_BODY,
        coachHint: `${TUTORIAL_STRINGS.STEP_3_REAL_TITLE} · ${TUTORIAL_STRINGS.STEP_3_REAL_BODY}`,
        feedbackText: TUTORIAL_STRINGS.STEP_3_SUMMARY_BODY,
        doorDemoStage: 'summary',
      };
    case 'ready':
      return {
        stepId: 'ready',
        stepNumber: 4,
        title: TUTORIAL_STRINGS.STEP_4_TITLE,
        body: TUTORIAL_STRINGS.STEP_4_BODY,
        coachHint: 'Start the ride · or press Enter',
        feedbackText: null,
        doorDemoStage: 'summary',
      };
  }
}

export function buildTutorialMaskCheck(): ActiveMaskCheckState {
  return {
    id: 'tutorial-mask-check',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: TUTORIAL_STRINGS.STEP_2_QUESTION,
    options: [
      { index: 0, text: TUTORIAL_STRINGS.STEP_2_CALM_OPTION, isCalm: true },
      { index: 1, text: TUTORIAL_STRINGS.STEP_2_OFF_OPTION_1, isCalm: false },
      { index: 2, text: TUTORIAL_STRINGS.STEP_2_OFF_OPTION_2, isCalm: false },
    ],
    remainingSec: 12,
    totalSec: 12,
  };
}

export function startPracticeStretchHelper(adapter: TutorialAndTrialAdapter): void {
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const stickerAnomaly = buildActiveAnomalyInstance('window_residue', () => 0.1);
  const eyeLevelPatch = resetPlayerCameraToSeatedEyeLevel(adapter.getSnapshot());
  pointerLock.clearErrorHint();

  adapter.update({
    ...eyeLevelPatch,
    phase: 'intro',
    rideSubPhase: 'cruising',
    paused: false,
    trainSpeedMps: 12.0,
    tutorialState: buildTutorialStepState('look_around', isTouch),
    activeAnomaly: { ...stickerAnomaly, manifested: true },
    activeMaskCheck: null,
    watchingParentLabel: null,
    isPracticeRun: true,
    subtitle: { id: 'tutorial-step-1', text: TUTORIAL_STRINGS.STEP_1_BODY },
  });
  adapter.setSubtitleRemainingSec(6.0);
}

export function advanceTutorialStepHelper(adapter: TutorialAndTrialAdapter): void {
  const snapshot = adapter.getSnapshot();
  if (snapshot.phase !== 'intro' || !snapshot.tutorialState) return;
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const cur = snapshot.tutorialState.stepId;

  if (cur === 'look_around') {
    const maskCheck = buildTutorialMaskCheck();
    adapter.update({
      tutorialState: buildTutorialStepState('dont_show_it', isTouch),
      activeAnomaly: null,
      activeMaskCheck: maskCheck,
      watchingParentLabel: 'Mom',
      subtitle: { id: 'tutorial-mom-question', speaker: 'Mom', text: maskCheck.question },
    });
    adapter.setSubtitleRemainingSec(10.0);
  } else if (cur === 'dont_show_it') {
    adapter.update({
      tutorialState: buildTutorialStepState('read_the_doors', isTouch),
      activeMaskCheck: null,
      watchingParentLabel: null,
      subtitle: { id: 'tutorial-doors', text: TUTORIAL_STRINGS.STEP_3_SUMMARY_BODY },
    });
    adapter.setSubtitleRemainingSec(8.0);
  } else if (cur === 'read_the_doors') {
    adapter.update({
      tutorialState: buildTutorialStepState('ready', isTouch),
      subtitle: { id: 'tutorial-ready', text: TUTORIAL_STRINGS.STEP_4_BODY },
    });
    adapter.setSubtitleRemainingSec(8.0);
  } else {
    adapter.finishPracticeStretch();
  }
}

export function stepIntroTutorialFlagHelper(
  adapter: TutorialAndTrialAdapter,
  dtSec: number
): boolean {
  const snapshot = adapter.getSnapshot();
  if (!snapshot.isFlagHolding && snapshot.flagHoldProgress <= 0) {
    return false;
  }
  const camY = playerController.getState().y || 1.24;
  const lookingAtActive = isLookingAtAnomaly(
    snapshot.activeAnomaly,
    snapshot.playerX,
    camY,
    snapshot.playerZ,
    snapshot.playerYaw,
    snapshot.playerPitch
  );
  const flagStep = stepFlagHoldProgress({
    isHolding: snapshot.isFlagHolding,
    currentProgress: snapshot.flagHoldProgress,
    dtSec,
    lookingAtActiveAnomaly: lookingAtActive,
  });
  snapshot.flagHoldProgress = Number(flagStep.nextProgress.toFixed(2));
  if (flagStep.completedCatch) {
    adapter.catchActiveAnomaly(false);
    const curTutorial = adapter.getSnapshot().tutorialState;
    if (curTutorial) {
      adapter.update({
        tutorialState: {
          ...curTutorial,
          feedbackText: TUTORIAL_STRINGS.STEP_1_CAUGHT_FEEDBACK,
        },
      });
    }
  } else if (flagStep.completedFalseFlag && snapshot.tutorialState) {
    adapter.update({
      isFlagHolding: false,
      flagHoldProgress: 0,
      tutorialState: {
        ...snapshot.tutorialState,
        feedbackText: TUTORIAL_STRINGS.STEP_1_MISS_FEEDBACK,
      },
    });
  }
  return true;
}

export function enterTrialRoomHelper(
  adapter: TutorialAndTrialAdapter,
  stopNumber?: number
): void {
  const seg = adapter.getCurrentSegmentRule();
  const trial: TrialState = {
    stage: 1,
    stopNumber: stopNumber ?? seg.stopNumber,
    depth: 1,
    steadyStairIndex: 1,
    steadyTrainSide: 'right',
    feedbackText:
      'Find the way back. The signs lie. Watch the lights when the chime plays.',
  };
  pointerLock.unlock({ quiet: true });
  const eyeLevelPatch = resetPlayerCameraToSeatedEyeLevel(adapter.getSnapshot());
  adapter.update({
    ...eyeLevelPatch,
    phase: 'trial',
    trialState: trial,
    trainSpeedMps: 0,
    activeMaskCheck: null,
    watchingParentLabel: null,
    subtitle: { id: `trial-start-${Date.now()}`, text: trial.feedbackText ?? '' },
  });
  adapter.setSubtitleRemainingSec(6.0);
}

export function chooseTrialOptionHelper(
  adapter: TutorialAndTrialAdapter,
  choice: TrialChoiceId
): void {
  const snapshot = adapter.getSnapshot();
  const trial = snapshot.trialState;
  if (snapshot.phase !== 'trial' || !trial) return;

  if (trial.stage === 1) {
    if (choice === 'opposite_sign') {
      const nextTrial: TrialState = {
        ...trial,
        stage: 2,
        feedbackText: 'The stairs go down to another platform.',
      };
      adapter.update({ trialState: nextTrial });
      adapter.showSubtitle(
        { stageDirection: 'The stairs go down to another platform.', text: '' },
        3.8
      );
    } else {
      const nextTrial: TrialState = {
        ...trial,
        stage: 1,
        depth: trial.depth + 1,
        feedbackText:
          'The stairs bring you back up onto the same platform. It’s quieter now.',
      };
      adapter.update({ trialState: nextTrial });
      adapter.showSubtitle(
        {
          stageDirection:
            'The stairs bring you back up onto the same platform. It’s quieter now.',
          text: '',
        },
        3.8
      );
    }
    return;
  }

  if (trial.stage === 2) {
    const stairIdx =
      choice === 'left_stairs' ? 0 : choice === 'middle_stairs' ? 1 : 2;
    if (stairIdx === trial.steadyStairIndex) {
      const nextTrial: TrialState = {
        ...trial,
        stage: 3,
        feedbackText: 'You come out at the platform edge. Two trains are coming.',
      };
      adapter.update({ trialState: nextTrial });
      adapter.showSubtitle(
        {
          stageDirection:
            'You come out at the platform edge. Two trains are coming.',
          text: '',
        },
        4.0
      );
    } else {
      const nextTrial: TrialState = {
        ...trial,
        stage: 1,
        depth: trial.depth + 1,
        feedbackText:
          'The stairs bring you back up onto the same platform. It’s quieter now.',
      };
      adapter.update({ trialState: nextTrial });
      adapter.showSubtitle(
        {
          stageDirection:
            'The stairs bring you back up onto the same platform. It’s quieter now.',
          text: '',
        },
        3.8
      );
    }
    return;
  }

  if (trial.stage === 3) {
    const chosenSide = choice === 'left_train' ? 'left' : 'right';
    if (chosenSide === trial.steadyTrainSide) {
      adapter.exitTrial();
    } else {
      const nextTrial: TrialState = {
        ...trial,
        stage: 2,
        depth: trial.depth + 1,
        feedbackText: 'The doors close on nothing. You’re back on the stairs.',
      };
      adapter.update({ trialState: nextTrial });
      adapter.showSubtitle(
        {
          stageDirection:
            'The doors close on nothing. You’re back on the stairs.',
          text: '',
        },
        3.8
      );
    }
  }
}

export function exitTrialHelper(adapter: TutorialAndTrialAdapter): void {
  const snapshot = adapter.getSnapshot();
  const trial = snapshot.trialState;
  const depth = trial?.depth ?? 1;
  const stopNumber = trial?.stopNumber ?? adapter.getCurrentSegmentRule().stopNumber;

  const record: FalseStopTrialRecord = {
    stop: stopNumber,
    depth,
  };
  const nextTrials = [...snapshot.falseStopTrials, record];
  const nextIdx = Math.min(
    SEGMENT_TABLE.length - 1,
    snapshot.segmentTableIndex + 1
  );

  // Eye-Level Rule: upon exiting any trial, camera faces directly across the car at seated eye level (0.0, 0.0)
  const eyeLevelPatch = resetPlayerCameraToSeatedEyeLevel(snapshot);

  adapter.update({
    ...eyeLevelPatch,
    trialState: null,
    falseStopTrials: nextTrials,
    sanity: snapshot.sanity + SANITY_DELTAS.TRIAL,
    lastReactionReason: 'Returned from a False Stop Trial',
  });

  adapter.enterSegment(nextIdx);

  if (depth > 1) {
    adapter.showSubtitle(
      {
        stageDirection: 'You don’t remember getting back on.',
        speaker: 'Mom',
        text: 'Oh my god. Where were you? Sit. Stay where we can see you.',
      },
      4.6
    );
  } else {
    adapter.showSubtitle(
      {
        speaker: 'Mom',
        text: 'Where did you go?! You can’t just walk off like that!',
      },
      4.4
    );
  }
}
