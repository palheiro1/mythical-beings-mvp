import { ArrowRight, BookOpen } from 'lucide-react';
import type { GuideStep } from '../../game/trainingSession.js';

const steps: Record<Exclude<GuideStep, 'free'>, { title: string; text: string; progress: number }> = {
  welcome: { title: 'Your first duel', text: 'Bring the Bot’s Power to zero. Take two actions each turn. This prepared lesson has no timer.', progress: 0 },
  draw: { title: '1. Gather knowledge', text: 'In the market, draw Lepidoptera. Drawing uses one action and puts the card in your hand.', progress: 1 },
  rotate: { title: '2. Grow your wisdom', text: 'Rotate Tarasca. Its wisdom rises from 0 to 2 — enough to play Lepidoptera next turn.', progress: 2 },
  watch: { title: '3. Watch the turn change', text: 'Both actions are used, so your turn ends automatically. The bot now takes its turn.', progress: 3 },
  summon: { title: '4. Play your knowledge', text: 'Select Lepidoptera in your hand, then choose “Play here” on Tarasca. It needs 1 wisdom; Tarasca has 2.', progress: 4 },
  end: { title: '5. Pass the turn', text: 'Your knowledge is in play. You can also end a turn before using every action. Choose “End Turn”.', progress: 5 },
  complete: { title: 'You know the essentials.', text: 'Keep playing this match. In free practice you have 30 seconds per turn; the clock starts when you continue and it is your turn.', progress: 6 },
  handoff: { title: 'Ready to practise freely?', text: 'Keep this team and the current board. You will have 30 seconds per turn, starting when you continue and it is your turn.', progress: 6 },
};

export default function TrainingCoach({ step, onStart, onSkip, onContinue, resolvingEffect }: { resolvingEffect: boolean; step: GuideStep; onStart: () => void; onSkip: () => void; onContinue: () => void }) {
  if (step === 'free') return null;
  const content = step === 'end' && resolvingEffect ? { title: '5. A creature’s special ability', text: 'Tulpar grants a free rotation when you play air knowledge. Choose a creature in the effect panel, then end your turn.', progress: 5 } : steps[step];
  return <aside className="wd-coach" data-step={step} aria-label="Guided lesson">
    <div className="wd-coach-copy" aria-live="polite" aria-atomic="true"><span className="wd-eyebrow"><BookOpen size={13} />Guided lesson · Clock paused</span><h2>{content.title}</h2><p>{content.text}</p></div>
    <div className="wd-coach-controls">
      {step === 'welcome' ? <button className="wd-button wd-button-primary" onClick={onStart}>Start learning <ArrowRight size={16} /></button> : content.progress === 6 ? <button className="wd-button wd-button-primary" onClick={onContinue}>Continue Practice <ArrowRight size={16} /></button> : <span className="wd-lesson-progress" aria-label={`Step ${content.progress} of 5`}>{content.progress}/5</span>}
      {content.progress !== 6 && <button className="wd-text-button" onClick={onSkip}>Skip tutorial</button>}
    </div>
  </aside>;
}
