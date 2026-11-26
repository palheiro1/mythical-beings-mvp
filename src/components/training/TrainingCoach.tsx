import { ArrowRight } from 'lucide-react';
import type { GuideGlowTarget } from '../../hooks/useGuideGlow.js';
import type { GuideStep, TrainingSession } from '../../game/trainingSession.js';
import { getCardArtClass, getCardPresentation, type DisplayCard } from '../../utils/digitalCards.js';
import CardArtwork from '../CardArtwork.js';

const steps: Record<Exclude<GuideStep, 'free'>, { title: string; text: string; progress: number }> = {
  // Fallback only: guided lessons dispatch 'start-guide' from the introduction, so 'welcome' is unreachable in practice.
  welcome: { title: 'Your first duel', text: 'Your three creatures share 20 Power. Bring the other side to zero to win. Each creature can carry one Knowledge card if its Wisdom meets the cost. Those cards and creature abilities deal damage.', progress: 0 },
  draw: { title: 'Draw Lepidoptera', text: 'Choose Draw on the marked market card. This uses the first of your two actions.', progress: 1 },
  rotate: { title: 'Rotate Tarasca', text: 'Lepidoptera needs 1 Wisdom. Choose Rotate under Tarasca to give it enough Wisdom for your next turn.', progress: 2 },
  watch: { title: 'The bot takes its turn', text: 'You used both actions. Now the bot goes through its Knowledge Phase, then chooses its actions.', progress: 3 },
  summon: { title: 'Select Lepidoptera', text: 'Choose the spell in your hand. It needs 1 Wisdom and Tarasca now has 2.', progress: 4 },
  end: { title: 'End your turn', text: 'Your team gained 1 Power when Lepidoptera entered play. End your turn to see it strike when your next turn begins.', progress: 5 },
  'wait-for-strike': { title: 'Watch the bot’s Power', text: 'Lepidoptera acts on its own when your turn begins.', progress: 5 },
  strike: { title: 'Lepidoptera strikes', text: 'In your Knowledge Phase, the spell acts automatically and rotates. Your Action Phase comes next.', progress: 6 },
  complete: { title: 'Tulpar’s bonus', text: 'Playing an air spell lets Tulpar rotate one of your creatures for free. Continue to play on with a 30-second turn clock.', progress: 6 },
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
      const card = game.market.find(item => item.id === 'aerial1');
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
      const card = player.hand.find(item => item.id === 'aerial1');
      return card && <MoveFigure card={card} label="Play" from="Hand" to="Tarasca" />;
    }
    case 'strike': {
      const card = player.field.find(slot => slot.knowledge?.id === 'aerial1')?.knowledge;
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
  if (direct && step === 'draw') text = 'Tap the marked spell. This uses 1 of 2 actions.';
  if (direct && step === 'rotate') text = 'Tap Tarasca to turn it. The spell needs 1 Wisdom.';
  if (direct && step === 'summon') text = 'The spell needs 1 Wisdom. Tarasca has 2.';
  if (step === 'summon' && session.selectedId) {
    title = 'Play Lepidoptera on Tarasca';
    text = direct ? 'Tap Tarasca to play the spell for one action.' : 'Choose Play here under Tarasca to play the spell for one action.';
  }
  if (step === 'end' && lessonBonus) text = 'Lepidoptera gave you 1 Power. Choose End Turn to pass on Tulpar’s bonus and watch the spell on your next turn.';
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
