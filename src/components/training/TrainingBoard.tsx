import { cardAnchor } from '../../game/presentation.js';
import { BookOpen, Droplet, Flame, Leaf, RotateCw, Sparkles, Wind } from 'lucide-react';
import { getEffectiveCreatureWisdom } from '../../game/utils.js';
import { HUMAN_ID, validateTrainingAction, type TrainingAction, type TrainingSession } from '../../game/trainingSession.js';
import type { Creature, Knowledge } from '../../game/types.js';
import TrainingCard, { type DisplayCard } from './TrainingCard.js';

const elementMarks = { water: Droplet, earth: Leaf, air: Wind, fire: Flame, neutral: Sparkles };
function SeatMark({ element }: { element?: Creature['element'] }) {
  const Mark = elementMarks[element ?? 'neutral'];
  return <span className="wd-seat-mark" aria-hidden="true"><Mark size={12} /></span>;
}

function KnowledgeSlot({ card, inspect, direct }: { card: Knowledge | null; inspect: (card: DisplayCard) => void; direct: boolean }) {
  if (direct && !card) return null;
  return <div className="wd-knowledge-slot">
    {card ? <TrainingCard motionAnchor={cardAnchor('', card)} card={card} board playFace={direct} onInspect={inspect} /> : <div className="wd-empty-slot"><BookOpen size={18} aria-hidden="true" /><span>Knowledge</span></div>}
  </div>;
}

export default function TrainingBoard({ session, onAction, onInspect, direct = false }: { session: TrainingSession; onAction: (action: TrainingAction) => void; onInspect: (card: DisplayCard) => void; direct?: boolean }) {
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
      const actionLabel = selected ? `Play ${selected.name} on ${creature.name}${ours ? `, replacing ${ours.name}` : ''}` : `Rotate ${creature.name}`;
      return <div key={creature.id} className={`wd-lane ${highlighted ? 'is-target' : ''}`}>
        <div className="wd-card-pair wd-enemy-pair" data-element={enemy?.element} data-motion-anchor={`slot:${opponent.id}:${enemy?.id}`}>
        <SeatMark element={enemy?.element} />
        <div className="wd-creature-slot wd-enemy-creature">
          {enemy && <TrainingCard motionAnchor={cardAnchor(opponent.id, enemy)} card={creatureView(enemy, 1)} rotation={enemy.rotation ?? 0} board playFace={direct} onInspect={onInspect} />}
          {!direct && <div className="wd-creature-label"><span className="wd-creature-name">{enemy?.name}</span></div>}
        </div>
        <KnowledgeSlot card={theirs} inspect={onInspect} direct={direct} />
        </div>
        <div className={`wd-card-pair wd-player-pair ${highlighted ? 'is-target' : ''}`} data-element={creature.element} data-motion-anchor={`slot:${player.id}:${creature.id}`}>
        <SeatMark element={creature.element} />
        <KnowledgeSlot card={ours} inspect={onInspect} direct={direct} />
        <div className="wd-creature-slot">
          <TrainingCard motionAnchor={cardAnchor(player.id, creature)} card={creatureView(creature, 0)} rotation={creature.rotation ?? 0} board playFace={direct} onInspect={onInspect}
            action={direct ? { label: actionLabel, onActivate: () => onAction(action), valid: valid.isValid, reason: valid.reason, highlighted, guideTarget: creature.id === 'tarasca' ? 'creature' : undefined, replacement: selected && ours ? ours.name : undefined } : undefined} />
          {!direct && <div className="wd-creature-label"><span className="wd-creature-name">{creature.name}</span></div>}
        </div>
        </div>
        {!direct && <button type="button" className={`wd-lane-action ${highlighted ? 'is-highlighted' : ''}`} aria-disabled={!valid.isValid} aria-label={actionLabel} title={valid.reason} data-guide-target={creature.id === 'tarasca' ? 'creature' : undefined} onClick={() => onAction(action)}>{selected ? <>Play here{ours && <span className="wd-replacement">Replaces {ours.name}</span>}</> : <><RotateCw size={14} />Rotate</>}</button>}
      </div>;
    })}</div>
    <div className="wd-board-side">{direct ? selected ? 'Tap a highlighted creature to play' : 'Your creatures · Tap to rotate · ⓘ Details' : 'Your creatures · Click artwork for details'}</div>
  </section>;
}
