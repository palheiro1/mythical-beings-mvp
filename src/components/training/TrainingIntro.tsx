import { useRef } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, RotateCw } from 'lucide-react';
import type { Creature, Knowledge, PlayerState } from '../../game/types.js';
import { getCardArtClass, getCardPresentation } from '../../utils/digitalCards.js';
import CardArtwork from '../CardArtwork.js';
import DigitalCardFace from '../DigitalCardFace.js';
import TrainingDialog from './TrainingDialog.js';

const titles = ['Bring the bot’s Power to zero.', 'How a turn works', 'Draw from the Market'] as const;

export interface IntroProgress {
  step: number;
  rotated: boolean;
}

function TeamFigure({ team }: { team: PlayerState }) {
  return <figure className="lesson-illustration lesson-team" aria-label="Your Creatures and their shared Power">
    <div className="lesson-team-cards" aria-hidden="true">
      {team.creatures.map(creature => (
        <div className="lesson-team-card" key={creature.id}>
          <DigitalCardFace card={creature} sizes="150px" />
        </div>
      ))}
    </div>
    <figcaption>
      <span className="sr-only">{team.creatures.map(creature => creature.name).join(', ')}. </span>
      <strong className="wd-power-value">{team.power}</strong>
      <span>Shared team Power</span>
    </figcaption>
  </figure>;
}

function WisdomExample({ creature, card, rotated, onRotate }: {
  creature: Creature; card: Knowledge; rotated: boolean; onRotate: () => void;
}) {
  const example = { ...creature, currentWisdom: undefined, rotation: rotated ? 90 : 0 };
  const { value: wisdom } = getCardPresentation(example);
  return <figure className="lesson-illustration lesson-example" aria-label="Try a rotation with the lesson cards">
    <div className="lesson-example-pair" aria-hidden="true">
      <div className="lesson-example-card">
        <DigitalCardFace card={example} sizes="110px" />
      </div>
      {wisdom >= card.cost ? <Check size={20} /> : <RotateCw size={19} />}
      <div className="lesson-example-card"><DigitalCardFace card={card} sizes="110px" /></div>
    </div>
    <figcaption aria-live="polite" aria-atomic="true">
      {rotated
        ? `${creature.name} can now play ${card.name} and keep its ${wisdom} Wisdom.`
        : `${card.name} requires ${card.cost} Wisdom. ${creature.name} has ${wisdom}.`}
    </figcaption>
    <button type="button" className="wd-button lesson-try" onClick={onRotate}>
      <RotateCw size={15} aria-hidden="true" />{rotated ? 'Reset example' : `Try rotating ${creature.name}`}
    </button>
  </figure>;
}

function TurnPhases({ card }: { card: Knowledge }) {
  const { current } = getCardPresentation(card);
  return <ol className="lesson-phases" aria-label="Turn order">
    <li>
      <span className="lesson-phase-number" aria-hidden="true">1</span>
      <h3>Knowledge Phase</h3>
      <p>Your Knowledge cards in play take effect automatically at the start of your turn, then rotate one step.</p>
      <div className="lesson-phase-effect">
        <span className={`dc-art-window ${getCardArtClass(card)}`} aria-hidden="true">
          <CardArtwork src={card.image} alt="" className="dc-art-source" sizes="32px" />
        </span>
        <span>{card.name} in play</span>
        <ArrowRight size={14} aria-hidden="true" />
        <strong>{current.kind === 'damage' ? `${current.value} damage` : current.label}</strong>
      </div>
    </li>
    <li>
      <span className="lesson-phase-number" aria-hidden="true">2</span>
      <h3>Action Phase</h3>
      <p>You normally get <strong>two actions</strong>. Card effects can change that number. Choose to draw from the Market, rotate a Creature, or play a Knowledge card.</p>
    </li>
  </ol>;
}

function MapRow({ player, label }: { player: PlayerState; label: string }) {
  return <div className="lesson-map-row">
    <span>{label}</span>
    <div className="lesson-map-cards">{player.creatures.map(card => (
      <span key={card.id} className={`dc-art-window ${getCardArtClass(card)}`}>
        <CardArtwork src={card.image} alt="" className="dc-art-source" sizes="40px" />
      </span>
    ))}</div>
  </div>;
}

function BoardMap({ team, opponent, card, direct }: {
  team: PlayerState; opponent: PlayerState; card: Knowledge; direct: boolean;
}) {
  return <figure className="lesson-illustration lesson-orientation" aria-label="Map of the practice arena">
    <div className={`lesson-map ${direct ? 'lesson-map-tabs' : ''}`} aria-hidden="true">
      <div className="lesson-map-clock"><Clock3 size={12} /> Clock</div>
      <div className="lesson-map-coach"><BookOpen size={12} /> Coach</div>
      {!direct && <div className="lesson-map-hand"><BookOpen size={18} /> Hand</div>}
      <div className="lesson-map-board">
        <MapRow player={opponent} label="Bot" />
        <MapRow player={team} label="You" />
      </div>
      <div className="lesson-map-market">
        <div className="lesson-map-trays">{direct && <span>Hand</span>}<strong>Market</strong></div>
        <span className={`lesson-map-card dc-art-window ${getCardArtClass(card)}`}>
          <CardArtwork src={card.image} alt="" className="dc-art-source" sizes="65px" />
        </span>
      </div>
    </div>
    <figcaption>
      <span className="sr-only">The bot’s Creatures face yours. The turn clock is in the header. </span>
      {direct ? 'Switch between Hand and Market using the tabs.' : 'Your hand is on the left. The Market is on the right.'}
    </figcaption>
  </figure>;
}

interface TrainingIntroProps {
  team: PlayerState;
  opponent: PlayerState;
  firstCard: Knowledge;
  direct: boolean;
  progress: IntroProgress;
  onProgress: (value: IntroProgress) => void;
  onFinish: () => void;
}

export default function TrainingIntro({ team, opponent, firstCard, direct, progress, onProgress, onFinish }: TrainingIntroProps) {
  const { step, rotated } = progress;
  const title = titles[step];
  const nextButton = useRef<HTMLButtonElement>(null);
  const last = step === titles.length - 1;
  const copy = [
    <p>Your three Creatures share {team.power} Power. The bot starts with {opponent.power}. Deal damage with Creature abilities and Knowledge cards (Allies and Spells).</p>,
    <TurnPhases card={firstCard} />,
    <p>Your Creatures start with empty slots. For your first action, draw <strong>{firstCard.name}</strong>, the marked {getCardPresentation(firstCard).typeLabel}, from the Market into your hand.</p>,
  ];
  return <TrainingDialog title={title} className="lesson-opening">
    {step === 0 && <TeamFigure team={team} />}
    {step === 1 && <WisdomExample creature={team.creatures[0]} card={firstCard} rotated={rotated}
      onRotate={() => onProgress({ step, rotated: !rotated })} />}
    {step === 2 && <BoardMap team={team} opponent={opponent} card={firstCard} direct={direct} />}
    <div className="lesson-opening-copy">
      <div aria-live="polite" aria-atomic="true">
        <span className="sr-only">Introduction step {step + 1} of {titles.length}. {title} </span>
        {copy[step]}
      </div>
      <div className="lesson-navigation">
        <span className="lesson-progress" aria-hidden="true">{step + 1} / {titles.length}</span>
        {step > 0 && <button type="button" className="lesson-back" onClick={() => {
          nextButton.current?.focus();
          onProgress({ ...progress, step: step - 1 });
        }}><ArrowLeft size={14} aria-hidden="true" /> Back</button>}
        <button type="button" className="wd-button lesson-enter" ref={nextButton}
          onClick={() => last ? onFinish() : onProgress({ ...progress, step: step + 1 })}>
          {last ? 'Start lesson' : 'Next'} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {last && <small><Clock3 size={14} aria-hidden="true" /> The clock is paused while you learn.</small>}
    </div>
  </TrainingDialog>;
}
