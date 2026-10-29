import type { ActiveMaskCheckState, TutorialState, TutorialStepId } from '../types';

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

