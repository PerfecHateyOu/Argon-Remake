import type {
  ActiveMaskCheckState,
  MaskCheckOption,
  ParentSpeakerId,
  SanityTier,
} from '../types';
import { shuffleArray } from './shuffle';

export interface ParentChatLine {
  speakerId: ParentSpeakerId;
  speakerLabel: 'Mom' | 'Dad';
  text: string;
}

export interface ParentChatPair {
  id: string;
  first: ParentChatLine;
  second: ParentChatLine;
}

export interface MaskCheckDefinition {
  id: string;
  speakerId: ParentSpeakerId;
  speakerLabel: 'Mom' | 'Dad';
  question: string;
  calmAnswer: string;
  offAnswers: readonly [string, string];
  requiresSuspicion?: boolean;
  draft?: boolean;
}

/**
 * Canonical v5.3 Parents' Chats on the ride (Section 4 of Story Bible).
 */
export const PARENT_RIDE_CHATS: readonly ParentChatPair[] = [
  {
    id: 'chat_0',
    first: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'Did you ever call your sister back?',
    },
    second: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'Tonight. Remind me.',
    },
  },
  {
    id: 'chat_1',
    first: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'Your cousin’s gonna be so tall now.',
    },
    second: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'Everybody’s tall now.',
    },
  },
  {
    id: 'chat_2',
    first: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'We should’ve taken the bus.',
    },
    second: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'The bus takes forever.',
    },
  },
  {
    id: 'chat_3',
    first: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'Did you ever call your sister back?',
    },
    second: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'Did you ever call your sister back?',
    },
  },
  {
    id: 'chat_4',
    first: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'Is it always this empty?',
    },
    second: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'It’s always this empty.',
    },
  },
];

/**
 * Extra calm small talk (swapped into the rides into stops 2, 4, and 6).
 */
export const EXTRA_CALM_SMALL_TALK: readonly ParentChatPair[] = [
  {
    id: 'calm_extra_0',
    first: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'Don’t lean against the doors.',
    },
    second: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'Should be in Queens in twenty minutes.',
    },
  },
  {
    id: 'calm_extra_1',
    first: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'Did they change the schedule?',
    },
    second: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'It feels slower today.',
    },
  },
  {
    id: 'calm_extra_2',
    first: {
      speakerId: 'mom',
      speakerLabel: 'Mom',
      text: 'I always hated this curve.',
    },
    second: {
      speakerId: 'dad',
      speakerLabel: 'Dad',
      text: 'Check your bag.',
    },
  },
];

/**
 * Canonical v5.3 Mask Checks — High tier (Calm set).
 */
export const MASK_CHECKS_CALM: readonly MaskCheckDefinition[] = [
  {
    id: 'calm_quiet',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: "You've been quiet. You okay, hon?",
    calmAnswer: 'Yeah, just tired.',
    offAnswers: ['Why? Do I look weird?', 'Did the lights just change?'],
  },
  {
    id: 'calm_stops',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'How many more stops, you think?',
    calmAnswer: 'A few. We’re fine.',
    offAnswers: ['Why are you asking me?', 'Wait, which train is this?'],
  },
  {
    id: 'calm_eat',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'Did you eat anything today?',
    calmAnswer: 'Had a bagel earlier.',
    offAnswers: ['Why does everyone keep asking that?', 'Sorry, what?'],
  },
  {
    id: 'calm_warm',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'You look warm. Are you warm?',
    calmAnswer: 'Just stuffy in here.',
    offAnswers: ['Is it hot to you?', 'Stop looking at me like that.'],
  },
  {
    id: 'calm_staring',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'You’re staring at something.',
    calmAnswer: 'Just zoning out.',
    offAnswers: ['No I’m not.', 'Don’t you see it?'],
    requiresSuspicion: true,
  },
  {
    id: 'calm_drop',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'Did you drop something on the floor?',
    calmAnswer: 'No, just adjusting my bag.',
    offAnswers: ['Why are you staring?', 'Leave me alone.'],
  },
  {
    id: 'calm_window_seat',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'You want the window seat?',
    calmAnswer: 'Nah, I’m good here.',
    offAnswers: ['Why, what’s out there?', 'Don’t make me move.'],
    draft: true,
  },
  {
    id: 'calm_text_aunt',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'Text your aunt we’re on the train.',
    calmAnswer: 'Sending it now.',
    offAnswers: ['There’s no signal down here.', 'Which train do I tell her?'],
    draft: true,
  },
];

/**
 * Canonical v5.3 Mask Checks — Medium/Low tier (Uneasy set).
 */
export const MASK_CHECKS_UNEASY: readonly MaskCheckDefinition[] = [
  {
    id: 'uneasy_tell_us',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'You’d tell us if something was wrong, right?',
    calmAnswer: 'Of course.',
    offAnswers: ['Would you tell me?', 'Define wrong.'],
  },
  {
    id: 'uneasy_looking_over',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'Why do you keep looking over there?',
    calmAnswer: 'Thought I saw someone I knew.',
    offAnswers: ['You saw it too?', 'Over where?'],
  },
  {
    id: 'uneasy_staring',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'You’re staring at something.',
    calmAnswer: 'Just zoning out.',
    offAnswers: ['No I’m not.', 'Don’t you see it?'],
    requiresSuspicion: true,
  },
  {
    id: 'uneasy_pole_tight',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'You’re holding that pole awfully tight.',
    calmAnswer: 'Train’s bumpy tonight.',
    offAnswers: ['Because it keeps moving.', 'Don’t let go of yours.'],
    draft: true,
  },
  {
    id: 'uneasy_whole_stop',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'You didn’t say a word that whole stop.',
    calmAnswer: 'Just tired, Dad.',
    offAnswers: ['Was it a stop?', 'Nobody got on.'],
    draft: true,
  },
  {
    id: 'uneasy_stomach',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'Is your stomach bothering you again?',
    calmAnswer: 'A little. It’ll pass.',
    offAnswers: ['It’s not my stomach.', 'Can you feel that too?'],
    draft: true,
  },
  {
    id: 'uneasy_phone_away',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'Put your phone away and talk to us.',
    calmAnswer: 'Okay, okay. It’s away.',
    offAnswers: ['It stopped showing the time.', 'About what?'],
    draft: true,
  },
  {
    id: 'uneasy_counting_stops',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'You’re counting the stops again, aren’t you?',
    calmAnswer: 'Habit. Sorry.',
    offAnswers: ['Someone has to.', 'We passed this one already.'],
    draft: true,
  },
];

/**
 * Canonical v5.3 Mask Checks — Critical tier (Wrong set).
 */
export const MASK_CHECKS_WRONG: readonly MaskCheckDefinition[] = [
  {
    id: 'wrong_see_it_too',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'You can see it too, can’t you?',
    calmAnswer: 'See what?',
    offAnswers: ['Yes.', 'Don’t.'],
  },
  {
    id: 'wrong_not_getting_off',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'We’re not getting off. You know that.',
    calmAnswer: 'I know.',
    offAnswers: ['Why would you say that?', 'Who said we were?'],
  },
  {
    id: 'wrong_looking_for',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'Who are you looking for?',
    calmAnswer: 'Nobody. Just looking.',
    offAnswers: ['The people who were here.', 'You.'],
  },
  {
    id: 'wrong_sit_still',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'Sit still. They notice when you fidget.',
    calmAnswer: 'Okay. Sitting still.',
    offAnswers: ['Who notices?', 'You noticed.'],
    draft: true,
  },
  {
    id: 'wrong_always_taken',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'We’ve always taken this train, sweetie.',
    calmAnswer: 'Right. I know.',
    offAnswers: ['Since when?', 'There’s no always down here.'],
    draft: true,
  },
  {
    id: 'wrong_dont_look_windows',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'Don’t look at the windows. Look at me.',
    calmAnswer: 'I’m looking at you.',
    offAnswers: ['What’s in the windows?', 'Your face is wrong.'],
    draft: true,
  },
  {
    id: 'wrong_smile_for_me',
    speakerId: 'mom',
    speakerLabel: 'Mom',
    question: 'Smile for me, hon. Like you used to.',
    calmAnswer: 'Like this?',
    offAnswers: ['I don’t remember how.', 'You first.'],
    draft: true,
  },
  {
    id: 'wrong_nobody_gets_off',
    speakerId: 'dad',
    speakerLabel: 'Dad',
    question: 'Nobody gets off at this one. Remember?',
    calmAnswer: 'I remember.',
    offAnswers: ['Then why do the doors open?', 'Who told you that?'],
    draft: true,
  },
];

/**
 * Paranoid UI words (flash on screen at low sanity).
 */
export const PARANOID_UI_WORDS: readonly string[] = [
  'they’re not your parents',
  'don’t answer',
  'it’s watching you',
  'wrong wrong wrong',
  'who is she',
  'get off get off',
  'you saw it',
  'SAY NOTHING',
];

/**
 * Dad's unasked answers ("Dad, Answering" anomaly lines).
 */
export const DAD_UNASKED_ANSWERS: readonly string[] = [
  'No, I didn’t hear it either.',
  'Because you didn’t ask.',
  'Two more. Don’t count them.',
];

export const MASK_CHECK_DURATION_SEC = 7.5;

export function selectMaskCheckPool(
  tier: SanityTier,
  suspicion: number
): MaskCheckDefinition[] {
  const rawPool =
    tier === 'High'
      ? MASK_CHECKS_CALM
      : tier === 'Medium' || tier === 'Low'
        ? MASK_CHECKS_UNEASY
        : MASK_CHECKS_WRONG;

  return rawPool.filter((item) => !item.requiresSuspicion || suspicion > 0);
}

export function buildActiveMaskCheck(
  def: MaskCheckDefinition,
  rng: () => number = Math.random
): ActiveMaskCheckState {
  const rawChoices: Array<{ text: string; isCalm: boolean }> = [
    { text: def.calmAnswer, isCalm: true },
    { text: def.offAnswers[0], isCalm: false },
    { text: def.offAnswers[1], isCalm: false },
  ];

  const shuffled = shuffleArray(rawChoices, rng);
  const options: [MaskCheckOption, MaskCheckOption, MaskCheckOption] = [
    { index: 0, text: shuffled[0]!.text, isCalm: shuffled[0]!.isCalm },
    { index: 1, text: shuffled[1]!.text, isCalm: shuffled[1]!.isCalm },
    { index: 2, text: shuffled[2]!.text, isCalm: shuffled[2]!.isCalm },
  ];

  return {
    id: `${def.id}-${Date.now()}`,
    speakerId: def.speakerId,
    speakerLabel: def.speakerLabel,
    question: def.question,
    options,
    remainingSec: MASK_CHECK_DURATION_SEC,
    totalSec: MASK_CHECK_DURATION_SEC,
  };
}
