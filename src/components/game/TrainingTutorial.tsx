import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, GraduationCap, X } from 'lucide-react';
import { useCardRegistry } from '../../hooks/useCardRegistry.js';
import { ArenaButton, StatusBadge } from '../ui/index.js';

interface TrainingTutorialProps {
  open: boolean;
  onClose: (completed: boolean) => void;
}

const STEPS = [
  {
    title: 'Welcome to your training duel',
    description: 'You have two actions each turn. Reduce the Bot’s Power to zero; this practice match has no rewards or wallet requirements.',
    targetId: null,
    targetLabel: 'Training overview',
  },
  {
    title: 'Draw from the Market',
    description: 'The Market shows five face-up Knowledge cards. Drawing one normally uses an action and moves it into your hand.',
    targetId: 'market:anchor',
    targetLabel: 'Market',
  },
  {
    title: 'Choose a card in your hand',
    description: 'Select a Knowledge card first. Its cost must be no higher than the Wisdom of the creature that will summon it.',
    targetId: 'hand:anchor',
    targetLabel: 'Your hand',
  },
  {
    title: 'Command your creatures',
    description: 'With no card selected, choose a creature to rotate it and raise its Wisdom. With a card selected, choose a creature to summon that Knowledge.',
    targetId: 'table:anchor',
    targetLabel: 'Your creatures',
  },
  {
    title: 'Finish your turn deliberately',
    description: 'The action bar shows actions and time remaining. End the turn when ready; the complete event history stays available beside the Market.',
    targetId: 'action:anchor',
    targetLabel: 'Action bar',
  },
] as const;

const TrainingTutorial: React.FC<TrainingTutorialProps> = ({ open, onClose }) => {
  const registry = useCardRegistry();
  const [stepIndex, setStepIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  const step = STEPS[stepIndex];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    headingRef.current?.focus();
    if (!step.targetId) return undefined;
    const target = registry.getElement(step.targetId);
    if (!target) return undefined;

    target.setAttribute('data-training-highlight', 'true');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    target.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
    return () => target.removeAttribute('data-training-highlight');
  }, [open, registry, step.targetId]);

  if (!open) return null;

  const isLastStep = stepIndex === STEPS.length - 1;
  const advance = () => {
    if (isLastStep) {
      onClose(true);
      return;
    }
    setStepIndex((current) => current + 1);
  };

  return (
    <section
      className="surface-obsidian fixed inset-x-3 bottom-3 z-[70] mx-auto w-auto max-w-xl rounded-xl border border-cyan-200/40 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.72),0_0_32px_rgba(34,211,238,0.12)] sm:bottom-5 sm:p-5"
      role="dialog"
      aria-labelledby="training-tutorial-title"
      aria-describedby="training-tutorial-description"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusBadge tone="blue">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            Guided training · {stepIndex + 1}/{STEPS.length}
          </StatusBadge>
          <h2
            ref={headingRef}
            id="training-tutorial-title"
            tabIndex={-1}
            className="mt-3 font-display text-2xl font-black text-slate-50 focus:outline-none"
          >
            {step.title}
          </h2>
        </div>
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
          onClick={() => onClose(false)}
          aria-label="Skip guided training"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <p id="training-tutorial-description" className="mt-2 leading-6 text-slate-300">
        {step.description}
      </p>
      <p className="mt-2 text-xs font-bold uppercase tracking-normal text-cyan-200" aria-live="polite">
        {step.targetId ? `Highlighted: ${step.targetLabel}` : step.targetLabel}
      </p>

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="min-h-11 px-2 text-sm font-bold text-slate-300 underline decoration-slate-500 underline-offset-4 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
          onClick={() => onClose(false)}
        >
          Skip tutorial
        </button>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <ArenaButton
              type="button"
              variant="ghost"
              icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
              onClick={() => setStepIndex((current) => current - 1)}
            >
              Back
            </ArenaButton>
          )}
          <ArenaButton
            type="button"
            icon={isLastStep ? <Check className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
            onClick={advance}
          >
            {isLastStep ? 'Start playing' : 'Next'}
          </ArenaButton>
        </div>
      </div>
    </section>
  );
};

export default TrainingTutorial;
