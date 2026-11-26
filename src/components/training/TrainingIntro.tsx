import { useRef } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, RotateCw } from 'lucide-react';
import type { Creature, Knowledge, PlayerState } from '../../game/types.js';
import { getCardArtClass, getCardPresentation } from '../../utils/digitalCards.js';
import CardArtwork from '../CardArtwork.js';
import DigitalCardFace from '../DigitalCardFace.js';
import TrainingDialog from './TrainingDialog.js';

const titles = ['Bring the bot’s Power to zero.', 'How a turn works', 'Find your first card.'] as const;

export interface IntroProgress {
  step: number;
  rotated: boolean;
}

function TeamFigure({ team }: { team: PlayerState }) {
  return <figure className="lesson-illustration lesson-team" aria-label="Your creatures and their shared Power">
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

function WisdomExample({ creature, spell, rotated, onRotate }: {
  creature: Creature; spell: Knowledge; rotated: boolean; onRotate: () => void;
}) {
  const example = { ...creature, currentWisdom: undefined, rotation: rotated ? 90 : 0 };
  const { value: wisdom } = getCardPresentation(example);
  return <figure className="lesson-illustration lesson-example" aria-label="Try a rotation with the lesson cards">
    <div className="lesson-example-pair" aria-hidden="true">
      <div className="lesson-example-card">
        <DigitalCardFace card={example} sizes="110px" />
      </div>
      {wisdom >= spell.cost ? <Check size={20} /> : <RotateCw size={19} />}
      <div className="lesson-example-card"><DigitalCardFace card={spell} sizes="110px" /></div>
    </div>
    <figcaption aria-live="polite" aria-atomic="true">
      {rotated
        ? `${creature.name} now has ${wisdom} Wisdom. Enough to play ${spell.name}!`
        : `${creature.name} has ${wisdom} Wisdom. ${spell.name} needs ${spell.cost}.`}
    </figcaption>
    <button type="button" className="wd-button lesson-try" onClick={onRotate}>
      <RotateCw size={15} aria-hidden="true" />{rotated ? 'Reset example' : `Try rotating ${creature.name}`}
    </button>
  </figure>;
}

function TurnPhases({ spell }: { spell: Knowledge }) {
  const { current } = getCardPresentation(spell);
  return <ol className="lesson-phases" aria-label="Turn order">
    <li>
      <h3>Knowledge Phase</h3>
      <p>When your turn starts, the spells on your creatures take effect automatically, then rotate.</p>
      <div className="lesson-phase-effect">
        <span className={`dc-art-window ${getCardArtClass(spell)}`} aria-hidden="true">
          <CardArtwork src={spell.image} alt="" className="dc-art-source" sizes="32px" />
        </span>
        <span>{spell.name} in play</span>
        <ArrowRight size={14} aria-hidden="true" />
        <strong>{current.label}</strong>
      </div>
    </li>
    <li>
      <h3>Action Phase</h3>
      <p>Draw from the market, rotate a creature, or play a spell from your hand. You have <strong>two actions</strong> unless a card effect changes that number.</p>
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

function BoardMap({ team, opponent, spell, direct }: {
  team: PlayerState; opponent: PlayerState; spell: Knowledge; direct: boolean;
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
        <span className={`lesson-map-spell dc-art-window ${getCardArtClass(spell)}`}>
          <CardArtwork src={spell.image} alt="" className="dc-art-source" sizes="65px" />
        </span>
      </div>
    </div>
    <figcaption>
      <span className="sr-only">The bot’s creatures face yours. The turn clock is in the header. </span>
      {direct ? 'Switch between Hand and Market using the tabs.' : 'Your hand is on the left. The market is on the right.'}
    </figcaption>
  </figure>;
}

interface TrainingIntroProps {
  team: PlayerState;
  opponent: PlayerState;
  firstSpell: Knowledge;
  direct: boolean;
  progress: IntroProgress;
  onProgress: (value: IntroProgress) => void;
  onFinish: () => void;
}

export default function TrainingIntro({ team, opponent, firstSpell, direct, progress, onProgress, onFinish }: TrainingIntroProps) {
  const { step, rotated } = progress;
  const title = titles[step];
  const nextButton = useRef<HTMLButtonElement>(null);
  const last = step === titles.length - 1;
  const copy = [
    <p>Your three creatures share {team.power} Power. The bot has {opponent.power} of its own. Use Knowledge cards (spells) and creature abilities to deal damage.</p>,
    <TurnPhases spell={firstSpell} />,
    <p>Your creatures start with empty spell slots. For your first action, draw the marked <strong>{firstSpell.name}</strong> from the market into your hand.</p>,
  ];
  return <TrainingDialog title={title} className="lesson-opening">
    {step === 0 && <TeamFigure team={team} />}
    {step === 1 && <WisdomExample creature={team.creatures[0]} spell={firstSpell} rotated={rotated}
      onRotate={() => onProgress({ step, rotated: !rotated })} />}
    {step === 2 && <BoardMap team={team} opponent={opponent} spell={firstSpell} direct={direct} />}
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
