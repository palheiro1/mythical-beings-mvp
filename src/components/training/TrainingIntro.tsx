import { ArrowRight } from 'lucide-react';
import TrainingDialog from './TrainingDialog.js';

const STEPS = [
  {
    title: 'Your goal',
    text: 'Bring the bot’s Power to zero before it brings yours down. Both teams start at 20 Power.',
  },
  {
    title: 'Key principles',
    text: 'You get two actions per turn: draw Knowledge from the market, rotate a creature to raise its Wisdom, or play Knowledge onto a creature.',
  },
  {
    title: 'Getting around',
    text: 'Creatures and Power sit on the board, the market and your hand below it, the coach banner above and the turn clock in the header.',
  },
] as const;

interface TrainingIntroProps {
  /** Zero-based step index, owned by the match so a portrait rotation does not restart the walkthrough. */
  step: number;
  onStep: (step: number) => void;
  onFinish: () => void;
}

/** Non-dismissable three-step introduction shown before a guided lesson starts. */
export default function TrainingIntro({ step, onStep, onFinish }: TrainingIntroProps) {
  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  return <TrainingDialog title={current.title}>
    {/* The dialog title lives in the header, so repeat it here: live regions only announce content that changes. */}
    <div aria-live="polite" aria-atomic="true">
      <p className="sr-only">{current.title}</p>
      <p>{current.text}</p>
    </div>
    <div className="wd-dialog-actions">
      <span className="wd-intro-progress" role="status" aria-label={`Introduction step ${step + 1} of ${STEPS.length}`}>{step + 1} / {STEPS.length}</span>
      <button type="button" className="wd-button wd-button-primary" onClick={() => { if (isLastStep) onFinish(); else onStep(step + 1); }}>
        {isLastStep ? 'Ok, let’s start the practice' : 'Next'} {!isLastStep && <ArrowRight size={16} aria-hidden="true" />}
      </button>
    </div>
  </TrainingDialog>;
}
