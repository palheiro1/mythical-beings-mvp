import { ArrowRight, BookOpen } from 'lucide-react';
import { getDisplayCardById } from '../../utils/cardCatalog.js';
import { getCardPresentation } from '../../utils/digitalCards.js';
import { GUIDED_CARD_ID, type GuideStep, type TrainingSession } from '../../game/trainingSession.js';

const firstCard = getDisplayCardById(GUIDED_CARD_ID);
if (!firstCard) throw new Error('The guided lesson card is missing from the catalog.');
const first = getCardPresentation(firstCard);

const steps: Record<Exclude<GuideStep, 'free'>, { title: string; text: string; progress: number }> = {
  welcome: { title: 'Your first duel', text: 'Your three Creatures share 20 Power. Reduce the opposing team’s Power to zero to win. Each Creature can hold one Knowledge card.', progress: 0 },
  draw: { title: '1. Draw from the Market', text: `Lepidoptera is an ${first.typeLabel}. ${first.valueLabel}. Use the first of your two actions to draw it from the Market into your hand.`, progress: 1 },
  rotate: { title: '2. Rotate Tarasca', text: 'Tarasca has 0 Wisdom. Spend your second action to rotate it a quarter turn. Its Wisdom rises to 2, enough to play Lepidoptera next turn.', progress: 2 },
  watch: { title: '3. Watch the turn change', text: 'Drawing and rotating used both actions, so the bot plays next. Tarasca keeps its new Wisdom.', progress: 3 },
  summon: { title: '4. Play Lepidoptera', text: 'Tarasca now has 2 Wisdom. Select Lepidoptera in your hand, then choose “Play here” on Tarasca. This uses one action. Tarasca keeps its Wisdom.', progress: 4 },
  end: { title: '5. Lepidoptera enters play', text: `${first.description} Choose End Turn to see Lepidoptera act in your next Knowledge Phase.`, progress: 5 },
  'wait-for-strike': { title: 'Watch Lepidoptera', text: 'When your turn starts, the Knowledge card on Tarasca will act and rotate on its own. Some cards change strength as they turn.', progress: 5 },
  strike: { title: '6. Lepidoptera strikes', text: 'In your Knowledge Phase, each of your Knowledge cards in play resolves its effect and rotates. The next position can give a different effect.', progress: 6 },
  complete: { title: 'Tulpar’s bonus', text: 'When you play an Air Knowledge card, Tulpar lets you rotate one of your Creatures for free. Its Wisdom advances without using another action. Continue to start your 30-second clock.', progress: 6 },
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
}

export default function TrainingCoach({ session, direct, lessonBonus, onStart, onSkip, onShowBonus, onContinue }: CoachProps) {
  const { guide: step, firstStrike } = session;
  if (step === 'free') return null;
  const content = steps[step];
  let text = content.text;
  if (direct && step === 'draw') text = `Lepidoptera is an ${first.typeLabel}. ${first.valueLabel}. Tap it in the Market to spend your first action drawing it into your hand.`;
  if (direct && step === 'rotate') text = 'Tarasca has 0 Wisdom. Tap it to spend your second action on a quarter turn. Its Wisdom rises to 2, enough for Lepidoptera.';
  if (direct && step === 'summon') text = 'Tarasca now has 2 Wisdom. Tap Lepidoptera in your hand, then tap Tarasca to play it for one action. Tarasca keeps its Wisdom.';
  if (step === 'end' && lessonBonus) text = `${first.description} Choose End Turn to skip Tulpar’s optional rotation and watch Lepidoptera act next turn.`;
  if (step === 'strike' && firstStrike) text = `Lepidoptera dealt ${firstStrike.damage} damage as your turn began. Bot Power fell from ${firstStrike.before} to ${firstStrike.after}. The Ally then rotated one step.`;
  const finished = step === 'complete' || step === 'handoff';
  return <aside className="wd-coach" data-step={step} aria-label="Guided lesson">
    <div className="wd-coach-copy" aria-live="polite" aria-atomic="true"><span className="wd-eyebrow"><BookOpen size={13} />Guided lesson · Clock paused</span><h2>{content.title}</h2><p>{text}</p></div>
    <div className="wd-coach-controls">
      {step === 'welcome' && <button className="wd-button wd-button-primary" onClick={onStart}>Start learning <ArrowRight size={16} /></button>}
      {step === 'strike' && <button className="wd-button wd-button-primary" onClick={onShowBonus}>See Tulpar’s bonus <ArrowRight size={16} /></button>}
      {finished && <button className="wd-button wd-button-primary" onClick={onContinue}>Continue Practice <ArrowRight size={16} /></button>}
      {!finished && step !== 'welcome' && step !== 'strike' && <span className="wd-lesson-progress" aria-label={`Step ${content.progress} of 6`}>{content.progress}/6</span>}
      {!finished && step !== 'strike' && <button className="wd-text-button" onClick={onSkip}>Skip tutorial</button>}
    </div>
  </aside>;
}
