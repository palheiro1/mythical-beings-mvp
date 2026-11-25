import { ArrowRight, BookOpen } from 'lucide-react';
import type { GuideStep, TrainingSession } from '../../game/trainingSession.js';

const steps: Record<Exclude<GuideStep, 'free'>, { title: string; text: string; progress: number }> = {
  // Fallback only: guided lessons dispatch 'start-guide' from the introduction, so 'welcome' is unreachable in practice.
  welcome: { title: 'Your first duel', text: 'Your three creatures share 20 Power. Bring the other side to zero to win. Each creature can carry one Knowledge card if its Wisdom meets the cost. Those cards and creature abilities deal damage.', progress: 0 },
  draw: { title: '1. Gather knowledge', text: 'You normally get two actions per turn. Lepidoptera needs 1 Wisdom. Spend your first action to draw it from the market into your hand.', progress: 1 },
  rotate: { title: '2. Grow your wisdom', text: 'Tarasca has 0 Wisdom. Spend your second action to rotate it a quarter turn. Its Wisdom rises to 2, enough to summon Lepidoptera next turn.', progress: 2 },
  watch: { title: '3. Watch the turn change', text: 'Drawing and rotating used both actions, so the bot plays next. Tarasca keeps its new Wisdom.', progress: 3 },
  summon: { title: '4. Play your knowledge', text: 'Tarasca now has 2 Wisdom. Lepidoptera needs only 1. Select it in your hand, then choose “Play here” on Tarasca to summon it for one action.', progress: 4 },
  end: { title: '5. Lepidoptera enters play', text: 'Its arrival gives your team 1 Power. End your turn to see what the spell does the next time you play.', progress: 5 },
  'wait-for-strike': { title: 'Watch Lepidoptera', text: 'When your turn starts, the Knowledge on Tarasca will act and rotate on its own. Some cards change strength as they turn.', progress: 5 },
  strike: { title: '6. Lepidoptera strikes', text: 'At the start of your turn, active Knowledge resolves its effect and rotates. The next position can give a different effect.', progress: 6 },
  complete: { title: 'Tulpar’s bonus', text: 'Summon air Knowledge, like Lepidoptera, and Tulpar can rotate any of your creatures for free. Its Wisdom advances without using another action. Continue to start your 30-second clock.', progress: 6 },
  handoff: { title: 'Ready to practise freely?', text: 'Keep this team and the current board. You have 30 seconds per turn, starting when you continue and it is your turn.', progress: 0 },
};

interface CoachProps {
  session: TrainingSession;
  direct: boolean;
  lessonBonus: boolean;
  onStart: () => void;
  onSkip: () => void;
  onShowBonus: () => void;
  onContinue: () => void;
  /** Brief golden pulse on the frame right after the introduction closes. */
  highlighted?: boolean;
}

export default function TrainingCoach({ session, direct, lessonBonus, highlighted, onStart, onSkip, onShowBonus, onContinue }: CoachProps) {
  const { guide: step, firstStrike } = session;
  if (step === 'free') return null;
  const content = steps[step];
  let text = content.text;
  if (direct && step === 'draw') text = 'You normally get two actions per turn. Tap Lepidoptera in the market to spend your first action drawing it into your hand. It needs 1 Wisdom.';
  if (direct && step === 'rotate') text = 'Tarasca has 0 Wisdom. Tap it to spend your second action on a quarter turn. Its Wisdom rises to 2, enough for Lepidoptera.';
  if (direct && step === 'summon') text = 'Tarasca now has 2 Wisdom. Lepidoptera needs only 1. Tap it in your hand, then tap Tarasca to summon it for one action.';
  if (step === 'end' && lessonBonus) text = 'Lepidoptera gives your team 1 Power as it enters. Choose End Turn to pass on this summon’s optional bonus and watch the spell on your next turn.';
  if (step === 'strike' && firstStrike) text = `Lepidoptera dealt ${firstStrike.damage} damage as your turn began. Bot Power fell from ${firstStrike.before} to ${firstStrike.after}. The spell then rotated on its own.`;
  const finished = step === 'complete' || step === 'handoff';
  return <aside className={highlighted ? 'wd-coach wd-coach-highlight' : 'wd-coach'} data-step={step} aria-label="Guided lesson">
    <div className="wd-coach-copy" aria-live="polite" aria-atomic="true"><span className="wd-eyebrow"><BookOpen size={13} />Guided lesson · Clock paused</span><h2 tabIndex={-1}>{content.title}</h2><p>{text}</p></div>
    <div className="wd-coach-controls">
      {step === 'welcome' && <button className="wd-button wd-button-primary" onClick={onStart}>Start learning <ArrowRight size={16} /></button>}
      {step === 'strike' && <button className="wd-button wd-button-primary" onClick={onShowBonus}>See Tulpar’s bonus <ArrowRight size={16} /></button>}
      {finished && <button className="wd-button wd-button-primary" onClick={onContinue}>Continue Practice <ArrowRight size={16} /></button>}
      {!finished && step !== 'welcome' && step !== 'strike' && <span className="wd-lesson-progress" aria-label={`Step ${content.progress} of 6`}>{content.progress}/6</span>}
      {!finished && step !== 'strike' && <button className="wd-text-button" onClick={onSkip}>Skip tutorial</button>}
    </div>
  </aside>;
}
