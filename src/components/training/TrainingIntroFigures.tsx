import { ArrowDown, ArrowRight, BookOpen, Check, Clock3, RotateCw } from 'lucide-react';
import type { Creature, Knowledge, PlayerState } from '../../game/types.js';
import { getCardArtClass, getCardPresentation, type DisplayCard } from '../../utils/digitalCards.js';
import CardArtwork from '../CardArtwork.js';
import DigitalCardFace from '../DigitalCardFace.js';

function Thumbnail({ card }: { card: DisplayCard }) {
  return <span className={`lesson-thumbnail dc-art-window ${getCardArtClass(card)}`} aria-hidden="true">
    <CardArtwork src={card.image} alt="" className="dc-art-source" sizes="60px" />
  </span>;
}

export function Teams({ team, opponent }: { team: PlayerState; opponent: PlayerState }) {
  return <figure className="lesson-illustration lesson-teams" aria-label="Both teams and their shared Power">
    {[{ player: opponent, label: 'Bot' }, { player: team, label: 'You' }].map(({ player, label }) =>
      <div className="lesson-roster" key={player.id}>
        <div className="lesson-roster-name"><strong>{label}</strong><span>{player.power} Power</span></div>
        <div className="lesson-roster-cards" aria-hidden="true">
          {player.creatures.map(card => <div key={card.id} className="lesson-roster-card">
            <DigitalCardFace card={card} sizes="80px" />
          </div>)}
        </div>
        <span className="sr-only">{player.creatures.map(card => card.name).join(', ')}.</span>
      </div>)}
  </figure>;
}

function MapRow({ player, label }: { player: PlayerState; label: string }) {
  return <div className="lesson-map-row">
    <span>{label}</span>
    <div className="lesson-map-cards">{player.creatures.map(card => <Thumbnail key={card.id} card={card} />)}</div>
  </div>;
}

export function BoardMap({ team, opponent, market, direct }: {
  team: PlayerState; opponent: PlayerState; market: Knowledge[]; direct: boolean;
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
        <div className="lesson-market-cards">{market.map(card => <Thumbnail key={card.instanceId} card={card} />)}</div>
      </div>
    </div>
    <figcaption className="lesson-card-path">
      <span>Market</span><ArrowRight size={15} aria-hidden="true" /><span>Hand</span><ArrowRight size={15} aria-hidden="true" /><span>Creature</span>
      <span className="sr-only">{direct ? ' Switch between Hand and Market using the tabs.' : ' Your hand is on the left. The Market is on the right.'}</span>
    </figcaption>
  </figure>;
}

const phases = ['Knowledge Phase', 'Action Phase'] as const;
const nextBeatLabels = ['See your actions', 'Pass to the bot', 'See the bot’s actions', 'Return to your turn'];

export function TurnCycle({ team, opponent, beat, onAdvance }: {
  team: PlayerState; opponent: PlayerState; beat: number; onAdvance: (next: number) => void;
}) {
  return <figure className="lesson-illustration lesson-cycle" aria-label="Explore the turn cycle">
    <div className="lesson-turn-table">
      {[{ player: team, label: 'Your turn' }, { player: opponent, label: 'Bot’s turn' }].map(({ player, label }, side) =>
        <div className="lesson-turn-side" key={player.id}>
          <div className="lesson-side-heading"><Thumbnail card={player.creatures[0]} /><strong>{label}</strong></div>
          <div className="lesson-turn-phases">
            {phases.map((phase, index) =>
              <span key={phase} className="lesson-turn-phase" aria-current={beat === 2 * side + index ? 'step' : undefined}>
                {phase}
              </span>)}
            <ArrowRight size={13} aria-hidden="true" />
          </div>
        </div>)}
    </div>
    <figcaption className="sr-only" aria-live="polite" aria-atomic="true">
      {beat < 2 ? 'Your turn' : 'Bot’s turn'}, {phases[beat % 2]}.
    </figcaption>
    <button type="button" className="wd-button lesson-try" onClick={() => onAdvance((beat + 1) % nextBeatLabels.length)}>
      {nextBeatLabels[beat]} <ArrowRight size={15} aria-hidden="true" />
    </button>
  </figure>;
}

export function OpeningActions({ creature, card }: { creature: Creature; card: Knowledge }) {
  return <figure className="lesson-illustration lesson-moves" aria-label="Two actions in the opening turn">
    <figcaption>Your opening turn</figcaption>
    <div className="lesson-action-example">
      <Thumbnail card={card} /><div><strong>Draw {card.name}</strong><span>1 action left</span></div>
    </div>
    <ArrowDown size={16} aria-hidden="true" />
    <div className="lesson-action-example">
      <Thumbnail card={creature} /><div><strong>Rotate {creature.name}</strong><span>0 actions left</span></div>
    </div>
    <span className="lesson-turn-pass">The bot goes next</span>
  </figure>;
}

export function WisdomExample({ creature, card, rotated, onRotate }: {
  creature: Creature; card: Knowledge; rotated: boolean; onRotate: () => void;
}) {
  const example = { ...creature, currentWisdom: undefined, rotation: rotated ? 90 : 0 };
  const { value: wisdom } = getCardPresentation(example);
  return <figure className="lesson-illustration lesson-example" aria-label="Try a rotation with the lesson cards">
    <div className="lesson-example-pair" aria-hidden="true">
      <div className="lesson-example-card"><DigitalCardFace card={example} sizes="110px" /></div>
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

export function CardTiming({ card }: { card: Knowledge }) {
  const { current, description } = getCardPresentation(card, 0);
  return <figure className="lesson-illustration lesson-timing" aria-label={`${card.name} across two of your turns`}>
    <div className="lesson-timing-stage">
      <div className="lesson-timing-card" aria-hidden="true"><DigitalCardFace card={card} rotation={0} sizes="76px" /></div>
      <div><span>Your Action Phase</span><strong>{description}</strong></div>
    </div>
    <div className="lesson-timing-gap"><ArrowDown size={14} aria-hidden="true" /> The bot takes its turn</div>
    <div className="lesson-timing-stage">
      <div className="lesson-timing-card" aria-hidden="true"><DigitalCardFace card={card} rotation={90} sizes="76px" /></div>
      <div><span>Your next Knowledge Phase</span><strong>{current.value} damage to the bot</strong><span>Then rotate one step.</span></div>
    </div>
  </figure>;
}
