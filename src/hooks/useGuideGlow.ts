import { useEffect, useState } from 'react';
import type { GuideStep } from '../game/trainingSession.js';

/** Anything the guided lesson can briefly light up with the golden ring + glow. */
export type GuideGlowTarget = 'coach' | 'market' | 'creature' | 'hand' | 'end' | 'bonus' | 'continue';

/** Lead-in before the first pulse, the pulse itself, and the gap before the next one. */
const LEAD_IN = 150;
const HOLD = 1300;
const GAP = 150;
/** Distance between two pulses: the hold plus the gap (on at 150 ms, off at 1450 ms). */
const STEP = HOLD + GAP;

/**
 * The targets a guided step draws the eye to, in the order they should pulse.
 * Pure so the walkthrough can be reasoned about (and tested) without timers.
 */
export function guideGlowSequence(guide: GuideStep, selectedId: string | null): GuideGlowTarget[] {
  switch (guide) {
    // The banner explains the step first, then the market card the player must draw.
    case 'draw': return ['coach', 'market'];
    case 'rotate': return ['creature'];
    case 'summon': return selectedId ? ['creature'] : ['hand'];
    case 'end': return ['end'];
    case 'strike': return ['bonus'];
    case 'complete':
    case 'handoff': return ['continue'];
    default: return [];
  }
}

/**
 * One owner of "what is glowing right now": plays the step's pulse sequence on a
 * transition-driven CSS glow. Keyed on the step and the current selection, so advancing the
 * lesson mid-pulse cancels the old timers and restarts from a clean slate; the CSS transition
 * still ramps the previous glow out smoothly.
 */
export function useGuideGlow(guide: GuideStep, selectedId: string | null, suspended: boolean, presenting: boolean): GuideGlowTarget | null {
  const [glowing, setGlowing] = useState<GuideGlowTarget | null>(null);
  useEffect(() => {
    // The intro, the portrait pause and a running card-flight animation all hold the lesson still.
    if (suspended || presenting) return;
    const targets = guideGlowSequence(guide, selectedId);
    if (!targets.length) return;
    const timers = targets.flatMap((target, index) => {
      const on = LEAD_IN + index * STEP;
      return [
        window.setTimeout(() => setGlowing(target), on),
        window.setTimeout(() => setGlowing(null), on + HOLD),
      ];
    });
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      setGlowing(null);
    };
  }, [guide, selectedId, suspended, presenting]);
  return glowing;
}
