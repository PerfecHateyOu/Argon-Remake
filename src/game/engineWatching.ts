import {
  RESTRAINT_CEILING_RAISE,
  RESTRAINT_DURATION_SEC,
  RESTRAINT_GRACE_SECONDS,
  RESTRAINT_START_WINDOW_SEC,
  SANITY_DELTAS,
  SUSPICION_DELTAS,
} from '../constants';
import type {
  ActiveMaskCheckState,
  ActiveRestraintState,
  EngineSnapshot,
  SegmentRule,
  SubtitleItem,
} from '../types';
import {
  buildActiveMaskCheck,
  DAD_UNASKED_ANSWERS,
  type MaskCheckDefinition,
  selectMaskCheckPool,
} from './carLife';
import { TUTORIAL_STRINGS } from './tutorial';

export const RESTRAINT_HOLD_DURATION_SEC = RESTRAINT_DURATION_SEC;

export interface WatchingEngineAdapter {
  getSnapshot(): EngineSnapshot;
  update(patch: Partial<EngineSnapshot>): EngineSnapshot;
  showSubtitle(item: Omit<SubtitleItem, 'id'>, durationSec?: number): void;
  triggerParanoidFlash(customWord?: string): void;
  emitRestraintWhisper(): void;
}

export function computeActiveParentWatcher(params: {
  snapshot: EngineSnapshot;
  seg: SegmentRule;
  nextElapsedSec: number;
  forcedWatcherLabel: 'Mom' | 'Dad' | null;
  forcedWatcherRemainingSec: number;
}): 'Mom' | 'Dad' | null {
  const { snapshot, seg, nextElapsedSec, forcedWatcherLabel, forcedWatcherRemainingSec } = params;
  if (snapshot.activeMaskCheck) {
    return snapshot.activeMaskCheck.speakerLabel;
  }
  if (snapshot.activeRestraint) {
    return 'Mom';
  }
  if (forcedWatcherRemainingSec > 0 && forcedWatcherLabel) {
    return forcedWatcherLabel;
  }
  if (!seg.silent) {
    const cyclePeriod = snapshot.nightmareMode ? 6.2 : 8.4;
    const watchDuration = snapshot.nightmareMode ? 3.2 : 2.6;
    const phaseInCycle = nextElapsedSec % cyclePeriod;
    if (phaseInCycle >= 2.2 && phaseInCycle <= 2.2 + watchDuration) {
      const cycleIndex = Math.floor(nextElapsedSec / cyclePeriod);
      return (cycleIndex + seg.stopNumber) % 2 === 0 ? 'Mom' : 'Dad';
    }
  }
  return null;
}

export function triggerMaskCheckHelper(
  adapter: WatchingEngineAdapter,
  usedMaskCheckIds: Set<string>,
  overrideDef?: MaskCheckDefinition
): ActiveMaskCheckState {
  const snapshot = adapter.getSnapshot();
  const pool = selectMaskCheckPool(snapshot.sanityTier, snapshot.suspicion);
  const unused = pool.filter((d) => !usedMaskCheckIds.has(d.id));
  const candidates = unused.length > 0 ? unused : pool;
  const chosen =
    overrideDef ??
    candidates[Math.floor(Math.random() * candidates.length)] ??
    pool[0]!;

  usedMaskCheckIds.add(chosen.id);
  const activeCheck = buildActiveMaskCheck(chosen);

  if (snapshot.sanityTier === 'Low' || snapshot.sanityTier === 'Critical') {
    adapter.triggerParanoidFlash();
  }

  adapter.update({
    activeMaskCheck: activeCheck,
    watchingParentLabel: activeCheck.speakerLabel,
    subtitle: {
      id: activeCheck.id,
      speaker: activeCheck.speakerLabel,
      text: activeCheck.question,
    },
  });

  return activeCheck;
}

export function answerMaskCheckHelper(
  adapter: WatchingEngineAdapter,
  optionIndex: 0 | 1 | 2
): void {
  const snapshot = adapter.getSnapshot();
  const check = snapshot.activeMaskCheck;
  if (!check) {
    if (snapshot.phase === 'ride' && !snapshot.paused) {
      const reply =
        DAD_UNASKED_ANSWERS[optionIndex % DAD_UNASKED_ANSWERS.length] ??
        DAD_UNASKED_ANSWERS[0];
      adapter.showSubtitle(
        {
          speaker: 'Dad',
          text: reply,
        },
        3.2
      );
    }
    return;
  }

  const option = check.options[optionIndex];
  if (!option) return;

  if (snapshot.phase === 'intro' && snapshot.tutorialState) {
    if (option.isCalm) {
      adapter.update({
        activeMaskCheck: null,
        watchingParentLabel: null,
        tutorialState: {
          ...snapshot.tutorialState,
          feedbackText: TUTORIAL_STRINGS.STEP_2_CALM_FEEDBACK,
        },
      });
      adapter.showSubtitle(
        {
          speaker: 'You',
          text: option.text,
          stageDirection: '(Mom nods.)',
        },
        3.2
      );
    } else {
      adapter.update({
        tutorialState: {
          ...snapshot.tutorialState,
          feedbackText: TUTORIAL_STRINGS.STEP_2_ODD_FEEDBACK,
        },
      });
      adapter.showSubtitle(
        {
          stageDirection: 'Mom keeps looking at you.',
          text: TUTORIAL_STRINGS.STEP_2_ODD_FEEDBACK,
        },
        3.8
      );
    }
    return;
  }

  if (option.isCalm) {
    adapter.update({
      activeMaskCheck: null,
    });
    adapter.showSubtitle(
      {
        speaker: 'You',
        text: option.text,
      },
      2.8
    );
  } else {
    const reason = `Gave an odd answer to ${check.speakerLabel}`;
    const updated = adapter.update({
      activeMaskCheck: null,
      suspicion: snapshot.suspicion + SUSPICION_DELTAS.MASK_FAIL,
      sanity: snapshot.sanity + SANITY_DELTAS.MASK_FAIL,
      lastReactionReason: reason,
    });
    if (updated.suspicion !== 40) {
      adapter.showSubtitle(
        {
          stageDirection: `${check.speakerLabel} keeps looking at you.`,
          text: '',
        },
        3.5
      );
    }
  }
}

export function handleMaskCheckTimeoutHelper(adapter: WatchingEngineAdapter): void {
  const snapshot = adapter.getSnapshot();
  const check = snapshot.activeMaskCheck;
  if (!check) return;
  const reason = `Hesitated when ${check.speakerLabel} asked a question`;
  const updated = adapter.update({
    activeMaskCheck: null,
    suspicion: snapshot.suspicion + SUSPICION_DELTAS.ANSWER_TIMEOUT,
    sanity: snapshot.sanity + SANITY_DELTAS.TIMEOUT,
    lastReactionReason: reason,
  });
  if (updated.suspicion !== 40) {
    adapter.showSubtitle(
      {
        stageDirection: 'You don’t answer fast enough.',
        speaker: check.speakerLabel,
        text: 'Hon?',
      },
      3.6
    );
  }
}

export interface RestraintBeatsTracker {
  beat15Played: boolean;
  beat40Played: boolean;
  beat70Played: boolean;
  beat105Played: boolean;
}

/**
 * Starts the Stop 11 Greenpoint Av Restraint moment (5.0 s start window, 15.0 s hold).
 * Train car lights NEVER dim during Restraint (`lightFlickerIntensity` remains `1.0`).
 * Psychological tension is driven exclusively through screen-space post-processing (`G.dim` / `dimOpacity`).
 */
export function triggerRestraintMomentHelper(
  adapter: WatchingEngineAdapter,
  beats: RestraintBeatsTracker
): void {
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const promptText = isTouch
    ? 'Hold the button. Don’t let go. Don’t react.'
    : 'Hold Space. Don’t let go. Don’t react.';

  const restraintState: ActiveRestraintState = {
    active: true,
    isHolding: false,
    hasStartedHolding: false,
    elapsedSec: 0,
    graceRemainingSec: 0,
    holdProgress: 0,
    dimOpacity: 0,
    momFrozen: false,
    strangersVanished: false,
  };

  beats.beat15Played = false;
  beats.beat40Played = false;
  beats.beat70Played = false;
  beats.beat105Played = false;

  adapter.update({
    activeRestraint: restraintState,
    activeMaskCheck: null,
    watchingParentLabel: 'Mom',
    lightFlickerIntensity: 1.0,
    isFlagHolding: false,
    flagHoldProgress: 0,
  });

  adapter.showSubtitle(
    {
      speaker: 'Mom',
      stageDirection: '(her mouth doesn’t move)',
      text: promptText,
    },
    3.5
  );
}

export function failRestraintHelper(
  adapter: WatchingEngineAdapter,
  reasonText: 'You let go' | 'You couldn’t keep it together'
): void {
  const snapshot = adapter.getSnapshot();
  const updated = adapter.update({
    activeRestraint: null,
    restraintHeld: false,
    restraintCompleted: true,
    sanity: snapshot.sanity + SANITY_DELTAS.RESTRAINT_FAIL,
    suspicion: snapshot.suspicion + SUSPICION_DELTAS.MASK_FAIL,
    lastReactionReason: 'Lost your composure during the restraint moment',
    watchingParentLabel: null,
    lightFlickerIntensity: 1.0,
    isFlagHolding: false,
    flagHoldProgress: 0,
  });
  if (updated.suspicion !== 40) {
    adapter.showSubtitle(
      {
        stageDirection: 'You flinch. Dad sees it.',
        text: reasonText,
      },
      3.8
    );
  }
}

export function notifyRestraintFocusLossHelper(adapter: WatchingEngineAdapter): void {
  const cur = adapter.getSnapshot().activeRestraint;
  if (!cur || !cur.active) return;
  adapter.update({
    activeRestraint: {
      ...cur,
      isHolding: false,
      graceRemainingSec: RESTRAINT_GRACE_SECONDS,
    },
  });
}

export function setRestraintHoldingHelper(
  adapter: WatchingEngineAdapter,
  holding: boolean
): void {
  const cur = adapter.getSnapshot().activeRestraint;
  if (!cur || !cur.active || cur.isHolding === holding) return;

  if (holding) {
    adapter.update({
      activeRestraint: {
        ...cur,
        isHolding: true,
        hasStartedHolding: true,
        graceRemainingSec: 0,
      },
    });
    return;
  }

  if (cur.graceRemainingSec > 0) {
    adapter.update({
      activeRestraint: {
        ...cur,
        isHolding: false,
      },
    });
    return;
  }

  if (cur.hasStartedHolding) {
    failRestraintHelper(adapter, 'You let go');
    return;
  }

  adapter.update({
    activeRestraint: {
      ...cur,
      isHolding: false,
    },
  });
}

export function stepActiveRestraintHelper(params: {
  adapter: WatchingEngineAdapter;
  dtSec: number;
  beats: RestraintBeatsTracker;
}): { completedOrFailed: boolean; bannerChanged: boolean; nextRestraint: ActiveRestraintState | null } {
  const { adapter, dtSec, beats } = params;
  const snapshot = adapter.getSnapshot();
  const cur = snapshot.activeRestraint;
  if (!cur || !cur.active) {
    return { completedOrFailed: false, bannerChanged: false, nextRestraint: null };
  }

  let bannerChanged = false;
  const nextRestraintElapsed = cur.elapsedSec + dtSec;
  const nextDim = Number(Math.min(0.4, (nextRestraintElapsed / 6.0) * 0.4).toFixed(3));
  let nextMomFrozen = cur.momFrozen;
  let nextStrangersVanished = cur.strangersVanished;

  if (!beats.beat15Played && nextRestraintElapsed >= 1.5) {
    beats.beat15Played = true;
    nextMomFrozen = true;
    bannerChanged = true;
  }
  if (!beats.beat40Played && nextRestraintElapsed >= 4.0) {
    beats.beat40Played = true;
    adapter.showSubtitle(
      {
        speaker: 'Dad',
        text: 'No. We’re not getting off. You know that.',
      },
      3.8
    );
  }
  if (!beats.beat70Played && nextRestraintElapsed >= 7.0) {
    beats.beat70Played = true;
    nextStrangersVanished = true;
    adapter.emitRestraintWhisper();
    bannerChanged = true;
  }
  if (!beats.beat105Played && nextRestraintElapsed >= 10.5) {
    beats.beat105Played = true;
    adapter.showSubtitle(
      {
        speaker: 'Mom',
        stageDirection: '(her mouth doesn’t move)',
        text: 'You can stop pretending.',
      },
      4.0
    );
  }

  if (cur.isHolding) {
    const nextHold = Math.min(1, cur.holdProgress + dtSec / RESTRAINT_HOLD_DURATION_SEC);
    if (nextHold >= 1) {
      adapter.update({
        activeRestraint: null,
        restraintHeld: true,
        restraintCompleted: true,
        restraintCeilingBonus: RESTRAINT_CEILING_RAISE,
        sanity: snapshot.sanity + SANITY_DELTAS.RESTRAINT_OK,
        watchingParentLabel: null,
        lightFlickerIntensity: 1.0,
        isFlagHolding: false,
        flagHoldProgress: 0,
      });
      adapter.showSubtitle(
        {
          stageDirection: 'The lights come back. Everyone is where they were.',
          text: '',
        },
        3.8
      );
      return { completedOrFailed: true, bannerChanged: true, nextRestraint: null };
    }

    const prevBucket = Math.round(cur.holdProgress * 20);
    const nextBucket = Math.round(nextHold * 20);
    const nextRestraint: ActiveRestraintState = {
      ...cur,
      elapsedSec: Number(nextRestraintElapsed.toFixed(2)),
      holdProgress: Number(nextHold.toFixed(3)),
      dimOpacity: nextDim,
      momFrozen: nextMomFrozen,
      strangersVanished: nextStrangersVanished,
    };
    if (prevBucket !== nextBucket || nextDim !== cur.dimOpacity) bannerChanged = true;
    return { completedOrFailed: false, bannerChanged, nextRestraint };
  }

  if (cur.graceRemainingSec > 0) {
    const nextGrace = cur.graceRemainingSec - dtSec;
    if (nextGrace <= 0) {
      failRestraintHelper(
        adapter,
        cur.hasStartedHolding ? 'You let go' : 'You couldn’t keep it together'
      );
      return { completedOrFailed: true, bannerChanged: true, nextRestraint: null };
    }
    const prevTenths = Math.ceil(cur.graceRemainingSec * 10);
    const nextTenths = Math.ceil(nextGrace * 10);
    const nextRestraint: ActiveRestraintState = {
      ...cur,
      elapsedSec: Number(nextRestraintElapsed.toFixed(2)),
      graceRemainingSec: Number(nextGrace.toFixed(2)),
      dimOpacity: nextDim,
      momFrozen: nextMomFrozen,
      strangersVanished: nextStrangersVanished,
    };
    if (prevTenths !== nextTenths || nextDim !== cur.dimOpacity) bannerChanged = true;
    return { completedOrFailed: false, bannerChanged, nextRestraint };
  }

  if (!cur.hasStartedHolding) {
    if (nextRestraintElapsed >= RESTRAINT_START_WINDOW_SEC) {
      failRestraintHelper(adapter, 'You couldn’t keep it together');
      return { completedOrFailed: true, bannerChanged: true, nextRestraint: null };
    }
    const nextRestraint: ActiveRestraintState = {
      ...cur,
      elapsedSec: Number(nextRestraintElapsed.toFixed(2)),
      dimOpacity: nextDim,
      momFrozen: nextMomFrozen,
      strangersVanished: nextStrangersVanished,
    };
    if (nextDim !== cur.dimOpacity) bannerChanged = true;
    return { completedOrFailed: false, bannerChanged, nextRestraint };
  }

  failRestraintHelper(adapter, 'You let go');
  return { completedOrFailed: true, bannerChanged: true, nextRestraint: null };
}
