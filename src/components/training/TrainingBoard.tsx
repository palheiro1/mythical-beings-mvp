import { RotateCw } from 'lucide-react';
import { getEffectiveCreatureWisdom } from '../../game/utils.js';
import { HUMAN_ID, validateTrainingAction, type TrainingAction, type TrainingSession } from '../../game/trainingSession.js';
import type { Creature, Knowledge } from '../../game/types.js';
import TrainingCard, { type DisplayCard } from './TrainingCard.js';

function KnowledgeSlot({ card, opponent, inspect }: { card: Knowledge | null; opponent?: boolean; inspect: (card: DisplayCard) => void }) {
  const step = Math.floor((card?.rotation ?? 0) / 90);
  const value = card?.valueCycle?.[step];
  return <div className="wd-knowledge-slot">
    {card ? <><TrainingCard card={card} board rotation={(card.rotation ?? 0) + (opponent ? 180 : 0)} onInspect={inspect} /><span className="wd-card-stat">{typeof value === 'number' ? value >= 0 ? `${value} damage` : `${-value} defence` : 'Card effect'} · {step + 1}/{card.maxRotations ?? 4}</span></> : <div className="wd-empty-slot"><span>Knowledge</span></div>}
  </div>;
}

export default function TrainingBoard({ session, onAction, onInspect }: { session: TrainingSession; onAction: (action: TrainingAction) => void; onInspect: (card: DisplayCard) => void }) {
  const { game, selectedId } = session;
  const [player, opponent] = game.players;
  const selected = player.hand.find(card => card.instanceId === selectedId);
  const creatureView = (creature: Creature, owner: 0 | 1) => ({ ...creature, currentWisdom: getEffectiveCreatureWisdom(game, owner, creature.id) });
  return <section className="wd-board" aria-label="Duel board">
    <div className="wd-board-side wd-board-side-opponent">Bot’s creatures</div>
    <div className="wd-lanes">{player.creatures.map((creature, i) => {
      const enemy = opponent.creatures[i];
      const ours = player.field.find(slot => slot.creatureId === creature.id)?.knowledge ?? null;
      const theirs = opponent.field.find(slot => slot.creatureId === enemy?.id)?.knowledge ?? null;
      const action: TrainingAction = selected ? { type: 'SUMMON_KNOWLEDGE', payload: { playerId: HUMAN_ID, creatureId: creature.id, knowledgeId: selected.id, instanceId: selected.instanceId! } } : { type: 'ROTATE_CREATURE', payload: { playerId: HUMAN_ID, creatureId: creature.id } };
      const valid = validateTrainingAction(session, action);
      const highlighted = valid.isValid && (Boolean(selected) || (session.guide === 'rotate' && creature.id === 'tarasca'));
      return <div key={creature.id} className={`wd-lane ${highlighted ? 'is-target' : ''}`}>
        <div className="wd-creature-slot wd-enemy-creature">
          {enemy && <TrainingCard card={creatureView(enemy, 1)} rotation={(enemy.rotation ?? 0) + 180} board onInspect={onInspect} />}
          <div className="wd-creature-label"><span className="wd-creature-name">{enemy?.name}</span><span className="wd-card-stat" aria-label={`Wisdom ${enemy ? getEffectiveCreatureWisdom(game, 1, enemy.id) : 0}`}>W {enemy ? getEffectiveCreatureWisdom(game, 1, enemy.id) : 0}</span></div>
        </div>
        <KnowledgeSlot card={theirs} opponent inspect={onInspect} />
        <KnowledgeSlot card={ours} inspect={onInspect} />
        <div className="wd-creature-slot">
          <TrainingCard card={creatureView(creature, 0)} rotation={creature.rotation ?? 0} board onInspect={onInspect} />
          <div className="wd-creature-label"><span className="wd-creature-name">{creature.name}</span><span className="wd-card-stat" aria-label={`Wisdom ${getEffectiveCreatureWisdom(game, 0, creature.id)}`}>W {getEffectiveCreatureWisdom(game, 0, creature.id)}</span></div>
        </div>
        <button type="button" className={`wd-lane-action ${highlighted ? 'is-highlighted' : ''}`} aria-disabled={!valid.isValid} aria-label={selected ? `Play ${selected.name} on ${creature.name}${ours ? `, replacing ${ours.name}` : ''}` : `Rotate ${creature.name}`} title={valid.reason} data-guide-target={creature.id === 'tarasca' ? 'creature' : undefined} onClick={() => onAction(action)}>{selected ? <>Play here{ours && <span className="wd-replacement">Replaces {ours.name}</span>}</> : <><RotateCw size={14} />Rotate</>}</button>
      </div>;
    })}</div>
    <div className="wd-board-side">Your creatures · W = Wisdom · Tap artwork to inspect</div>
  </section>;
}
