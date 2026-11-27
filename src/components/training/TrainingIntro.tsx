import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import type { Knowledge, PlayerState } from '../../game/types.js';
import { getCardPresentation } from '../../utils/digitalCards.js';
import TrainingDialog from './TrainingDialog.js';
import { BoardMap, CardTiming, OpeningActions, Teams, TurnCycle, WisdomExample } from './TrainingIntroFigures.js';

export interface IntroProgress {
  step: number;
  turnBeat: number;
  rotated: boolean;
}

interface TrainingIntroProps {
  team: PlayerState;
  opponent: PlayerState;
  market: Knowledge[];
  direct: boolean;
  progress: IntroProgress;
  onProgress: (value: IntroProgress) => void;
  onFinish: () => void;
}

export default function TrainingIntro({ team, opponent, market, direct, progress, onProgress, onFinish }: TrainingIntroProps) {
  const { step, turnBeat, rotated } = progress;
  const nextButton = useRef<HTMLButtonElement>(null);
  const creature = team.creatures[0];
  const card = market[0];
  const pages = [
    {
      title: 'Bring the bot’s Power to zero.',
      illustration: <Teams team={team} opponent={opponent} />,
      copy: <>
        <p>Your three <strong>Creatures</strong> share one total of <strong>{team.power} Power</strong>. The bot has three Creatures and {opponent.power} Power of its own.</p>
        <p>Creature abilities and Knowledge cards can deal damage. Each point that gets past Defense takes 1 Power from the opposing team.</p>
      </>,
    },
    {
      title: 'From the Market to your board',
      illustration: <BoardMap team={team} opponent={opponent} market={market} direct={direct} />,
      copy: <>
        <p>The shared <strong>Market</strong> starts with five face-up Knowledge cards. Each is an <strong>Ally</strong> or a <strong>Spell</strong>. Either player can draw one into their hand.</p>
        <p>A card waits in your hand until you play it on a Creature. Each Creature can hold one Knowledge card at a time. Playing another there replaces it.</p>
      </>,
    },
    {
      title: 'Two phases per turn',
      illustration: <TurnCycle team={team} opponent={opponent} beat={turnBeat}
        onAdvance={next => onProgress({ ...progress, turnBeat: next })} />,
      copy: <dl className="lesson-rules">
        <dt>Knowledge Phase</dt>
        <dd>Your Knowledge cards in play automatically apply the effect shown at their current rotation, then turn one step. Your Creatures start with empty slots.</dd>
        <dt>Action Phase</dt>
        <dd>You choose how to spend your actions. You normally get two, though card effects can change that number.</dd>
        <dd className="lesson-rule-note">The bot takes both phases next. Then the turn comes back to you.</dd>
      </dl>,
    },
    {
      title: 'Choose your actions',
      illustration: <OpeningActions creature={creature} card={card} />,
      copy: <>
        <dl className="lesson-rules">
          <dt>Draw from the Market</dt><dd>Take a face-up Knowledge card into your hand.</dd>
          <dt>Rotate a Creature</dt><dd>Advance to the next value on its Wisdom cycle.</dd>
          <dt>Play a Knowledge card</dt><dd>Choose a card in your hand and a Creature with enough Wisdom.</dd>
        </dl>
        <p className="lesson-rule-note">Each move normally uses one action. You can repeat a move or choose <strong>End Turn</strong> early.</p>
      </>,
    },
    {
      title: 'Which cards can a Creature play?',
      illustration: <WisdomExample creature={creature} card={card} rotated={rotated}
        onRotate={() => onProgress({ ...progress, rotated: !rotated })} />,
      copy: <>
        <p>Each Creature has its own <strong>Wisdom</strong>. To play a Knowledge card, the Creature’s Wisdom must meet or exceed the card’s requirement.</p>
        <p>Try rotating {creature.name} a quarter turn. Compare its new Wisdom with the requirement on {card.name}. Playing the card leaves the Creature’s Wisdom intact.</p>
      </>,
    },
    {
      title: 'Follow one card across turns',
      illustration: <CardTiming card={card} />,
      copy: <>
        <p>{card.name} is an <strong>{getCardPresentation(card).typeLabel}</strong>. Play it on {creature.name} to trigger its <strong>On play</strong> effect. It stays there through the bot’s turn.</p>
        <p>During <strong>your next Knowledge Phase</strong>, it deals damage and rotates. After its final rotation, the card goes to the discard pile.</p>
      </>,
    },
  ];
  const page = pages[step];
  const last = step === pages.length - 1;

  useEffect(() => {
    const dialog = nextButton.current?.closest<HTMLElement>('[role="dialog"]');
    if (dialog) dialog.scrollTop = 0;
  }, [step]);

  return <TrainingDialog title={page.title} className="lesson-opening">
    {page.illustration}
    <div className="lesson-opening-copy">
      <div className="lesson-explanation" aria-live="polite" aria-atomic="true">
        <span className="sr-only">Introduction step {step + 1} of {pages.length}. {page.title} </span>
        {page.copy}
      </div>
      <div className="lesson-navigation">
        <span className="lesson-progress" aria-hidden="true">{step + 1} / {pages.length}</span>
        {step > 0 && <button type="button" className="lesson-back" onClick={() => {
          nextButton.current?.focus();
          onProgress({ ...progress, step: step - 1 });
        }}><ArrowLeft size={14} aria-hidden="true" /> Back</button>}
        <button type="button" className="wd-button lesson-enter" ref={nextButton}
          onClick={() => last ? onFinish() : onProgress({ ...progress, step: step + 1 })}>
          {last ? 'Start lesson' : 'Next'} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {last && <small><Clock3 size={14} aria-hidden="true" />The clock is paused. Your first move is to draw {card.name}.</small>}
    </div>
  </TrainingDialog>;
}
