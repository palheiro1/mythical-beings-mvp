import { ArrowRight } from 'lucide-react';
import type { GuideGlowTarget } from '../../hooks/useGuideGlow.js';
import { GUIDED_CARD_ID, type GuideStep, type TrainingSession } from '../../game/trainingSession.js';
import { getDisplayCardById } from '../../utils/cardCatalog.js';
import { getCardArtClass, getCardPresentation, type DisplayCard } from '../../utils/digitalCards.js';
import CardArtwork from '../CardArtwork.js';

const firstCard = getDisplayCardById(GUIDED_CARD_ID);
if (!firstCard) throw new Error('The guided lesson card is missing from the catalog.');
const first = getCardPresentation(firstCard);

const steps: Record<Exclude<GuideStep, 'free'>, { title: string; text: string; progress: number }> = {
  // Fallback only: guided lessons dispatch 'start-guide' from the introduction, so 'welcome' is unreachable in practice.
  welcome: { title: 'Your first duel', text: 'Your three Creatures share 20 Power. Reduce the bot’s Power to zero to win. Each Creature can hold one Knowledge card.', progress: 0 },
  draw: { title: 'Draw Lepidoptera', text: `Lepidoptera is an ${first.typeLabel}. Choose Draw in the Market to spend your first action.`, progress: 1 },
  rotate: { title: 'Rotate Tarasca', text: `Lepidoptera requires ${first.value} Wisdom. Choose Rotate under Tarasca to prepare it for your next turn.`, progress: 2 },
  watch: { title: 'The bot takes its turn', text: 'You used both actions. Now the bot goes through its Knowledge Phase, then chooses its actions.', progress: 3 },
  summon: { title: 'Select Lepidoptera', text: `Select the Ally in your hand. Lepidoptera requires ${first.value} Wisdom and Tarasca has 2.`, progress: 4 },
  end: { title: 'End your turn', text: `${first.description} Choose End Turn to see Lepidoptera act during your next Knowledge Phase.`, progress: 5 },
  'wait-for-strike': { title: 'Watch the bot’s Power', text: 'Lepidoptera acts automatically during your Knowledge Phase.', progress: 5 },
  strike: { title: 'Lepidoptera strikes', text: 'In your Knowledge Phase, the Ally acts automatically and rotates. Your Action Phase comes next.', progress: 6 },
  complete: { title: 'Tulpar’s bonus', text: 'When you play an Air Knowledge card, Tulpar lets you rotate one of your Creatures for free. Continue to play on with a 30-second turn clock.', progress: 6 },
  handoff: { title: 'Ready to play on?', text: 'Keep this team and board. You’ll have 30 seconds per turn.', progress: 0 },
};

function MoveFigure({ card, label, from, to }: {
  card: DisplayCard; label: string; from: string | number; to: string | number;
}) {
  return <div className="lesson-move" role="img" aria-label={`${label}, from ${from} to ${to}`}>
    <span aria-hidden="true" className={`lesson-move-art dc-art-window ${getCardArtClass(card)}`}>
      <CardArtwork src={card.image} alt="" className="dc-art-source" sizes="60px" />
    </span>
    <span className="lesson-move-caption" aria-hidden="true">
      <small>{label}</small>
      <strong>{from} <ArrowRight size={15} /> {to}</strong>
    </span>
  </div>;
}

function MoveIllustration({ session }: { session: TrainingSession }) {
  const { game, guide, firstStrike } = session;
  const player = game.players[0];
  switch (guide) {
    case 'draw': {
      const card = game.market.find(item => item.id === GUIDED_CARD_ID);
      return card && <MoveFigure card={card} label="Draw" from="Market" to="Hand" />;
    }
    case 'rotate': {
      const card = player.creatures.find(item => item.id === 'tarasca');
      if (!card) return null;
      const { value, cycle, step } = getCardPresentation(card);
      const next = cycle[step + 1];
      return next && <MoveFigure card={card} label="Tarasca’s Wisdom" from={value} to={next.value} />;
    }
    case 'summon': {
      const card = player.hand.find(item => item.id === GUIDED_CARD_ID);
      return card && <MoveFigure card={card} label="Play" from="Hand" to="Tarasca" />;
    }
    case 'strike': {
      const card = player.field.find(slot => slot.knowledge?.id === GUIDED_CARD_ID)?.knowledge;
      return card && firstStrike && <MoveFigure card={card} label="Bot Power" from={firstStrike.before} to={firstStrike.after} />;
    }
    default: return null;
  }
}

interface CoachProps {
  session: TrainingSession;
  direct: boolean;
  lessonBonus: boolean;
  onStart: () => void;
  onSkip: () => void;
  onShowBonus: () => void;
  onContinue: () => void;
  /** Which guided-lesson target is pulsing right now, if any. */
  glow?: GuideGlowTarget | null;
}

export default function TrainingCoach({ session, direct, lessonBonus, glow, onStart, onSkip, onShowBonus, onContinue }: CoachProps) {
  const { guide: step, firstStrike } = session;
  if (step === 'free') return null;
  const content = steps[step];
  let title = content.title;
  let text = content.text;
  if (direct && step === 'draw') text = `Tap the marked ${first.typeLabel} in the Market. This uses your first action.`;
  if (direct && step === 'rotate') text = `Tap Tarasca to rotate it. Lepidoptera requires ${first.value} Wisdom.`;
  if (direct && step === 'summon') text = `Select the Ally in your hand. Lepidoptera requires ${first.value} Wisdom. Tarasca has 2.`;
  if (step === 'summon' && session.selectedId) {
    title = 'Play Lepidoptera on Tarasca';
    text = direct ? 'Tap Tarasca to play the Ally for one action. Tarasca keeps its Wisdom.' : 'Choose Play here under Tarasca. Playing the Ally uses one action. Tarasca keeps its Wisdom.';
  }
  if (step === 'end' && lessonBonus) text = `${first.description} Choose End Turn to skip Tulpar’s optional rotation and see Lepidoptera act next turn.`;
  if (step === 'strike' && firstStrike) text = `In your Knowledge Phase, Lepidoptera dealt ${firstStrike.damage} damage and rotated. Your Action Phase starts now.`;
  const finished = step === 'complete' || step === 'handoff';
  return <aside className={glow === 'coach' ? 'wd-coach wd-coach-highlight' : 'wd-coach'} data-step={step} aria-label="Guided lesson">
    <div className="wd-coach-copy lesson-coach-copy" aria-live="polite" aria-atomic="true">
      <div className="lesson-instruction"><h2 tabIndex={-1}>{title}</h2><p>{text}</p></div>
      <MoveIllustration session={session} />
    </div>
    <div className="wd-coach-controls">
      {step === 'welcome' && <button className="wd-button wd-button-primary" onClick={onStart}>Start learning <ArrowRight size={16} /></button>}
      {step === 'strike' && <button className={`wd-button wd-button-primary ${glow === 'bonus' ? 'wd-guide-glow' : ''}`} data-guide-target="bonus" onClick={onShowBonus}>See Tulpar’s bonus <ArrowRight size={16} /></button>}
      {finished && <button className={`wd-button wd-button-primary ${glow === 'continue' ? 'wd-guide-glow' : ''}`} data-guide-target="continue" onClick={onContinue}>Continue Practice <ArrowRight size={16} /></button>}
      {!finished && step !== 'welcome' && step !== 'strike' && <span className="wd-lesson-progress" aria-label={`Step ${content.progress} of 6`}>{content.progress}/6</span>}
      {!finished && step !== 'strike' && <button className="wd-text-button" onClick={onSkip}>Skip tutorial</button>}
    </div>
  </aside>;
}
