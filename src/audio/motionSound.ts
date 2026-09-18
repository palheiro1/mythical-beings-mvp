import type { MotionStep } from '../utils/trainingMotion.js';
import type { TrainingSound } from './trainingAudio.js';

/** Semantic fallback for effects whose anchors/animations are not visible. */
export function motionSounds(step: MotionStep): TrainingSound[] {
  if (step.kind === 'move') return [{ kind: step.to.zone === 'discard' ? 'discard' : step.to.zone === 'market' ? 'deal' : step.to.zone.startsWith('hand:') ? 'draw' : 'place', element: step.to.card.element }];
  if (step.kind === 'rotate') return [{ kind: 'rotate', element: step.to.card.element }];
  if (step.kind === 'combat') return [
    ...step.blocked ? [{ kind: 'block' as const, amount: step.blocked }] : [],
    ...(step.amount ?? 0) > 0 ? [{ kind: 'damage' as const, amount: step.amount, delay: step.blocked ? 0.15 : 0 }] : [],
  ];
  if (step.kind === 'power') return step.amount ? [{ kind: step.amount > 0 ? 'heal' : 'damage', amount: Math.abs(step.amount), element: step.element }] : [];
  return [{ kind: 'effect', element: step.element }];
}
