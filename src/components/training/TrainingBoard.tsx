import type { ReactNode } from 'react';
import { cardAnchor } from '../../game/presentation.js';
import { BookOpen, RotateCw } from 'lucide-react';
import ElementIcon from '../ElementIcon.js';
import { getCreatureWisdom } from '../../game/utils.js';
import { HUMAN_ID, validateTrainingAction, type TrainingAction, type TrainingSession } from '../../game/trainingSession.js';
import type { Creature, Knowledge, PlayerState } from '../../game/types.js';
import type { GuideGlowTarget } from '../../hooks/useGuideGlow.js';
import TrainingCard, { type CardAction, type DisplayCard } from './TrainingCard.js';

type BoardSide = Pick<PlayerState, 'id' | 'creatures' | 'field'>;
type CreatureAction = CardAction & { playing: boolean };
type BoardHud = { opponent: ReactNode; player: ReactNode; turn: ReactNode };

function SeatMark({ element }: { element?: Creature['element'] }) {
  return <span className="wd-seat-mark" aria-hidden="true"><ElementIcon element={element} size={12} aria-hidden="true" /></span>;
}

export function CreatureStatus({ owl, hurricane }: { owl: boolean; hurricane: boolean }) {
  if (!owl && !hurricane) return null;
  return <span className="wd-board-status">
    {owl && <small>Owl +1 Wisdom</small>}
    {hurricane && <small>⊘ Hurricane · Play blocked</small>}
  </span>;
}

function KnowledgeSlot({ card, inspect, direct, action, showEmpty }: {
  card: Knowledge | null; inspect: (card: DisplayCard) => void; direct: boolean; action?: CardAction; showEmpty?: boolean;
}) {
  if (direct && !card && !showEmpty) return null;
  return <div className="wd-knowledge-slot">
    {card ? <TrainingCard motionAnchor={cardAnchor('', card)} card={card} board playFace={direct} onInspect={inspect} action={action} /> : <div className="wd-empty-slot" aria-hidden={showEmpty || undefined}><BookOpen size={18} aria-hidden="true" /><span>Knowledge</span></div>}
  </div>;
}

export function DuelBoard({ player, opponent, opponentLabel, guidance, direct = false, creatureAction, knowledgeAction, onInspect, hud }: {
  player: BoardSide;
  opponent: BoardSide;
  opponentLabel: string;
  guidance?: string;
  direct?: boolean;
  creatureAction?: (creature: Creature, knowledge: Knowledge | null) => CreatureAction;
  knowledgeAction?: (creature: Creature, knowledge: Knowledge) => CardAction;
  onInspect: (card: DisplayCard) => void;
  hud?: BoardHud;
}) {
  const ourOwl = player.field.some(slot => slot.knowledge?.id === 'aerial3');
  const theirOwl = opponent.field.some(slot => slot.knowledge?.id === 'aerial3');
  return <section className="wd-board" aria-label="Duel board">
    {hud?.opponent ?? <div className="wd-board-side wd-board-side-opponent">{opponentLabel}</div>}
    <div className="wd-lanes">{player.creatures.map((creature, i) => {
      const enemy = opponent.creatures[i];
      const ours = player.field.find(slot => slot.creatureId === creature.id)?.knowledge ?? null;
      const theirs = opponent.field.find(slot => slot.creatureId === enemy?.id)?.knowledge ?? null;
      const action = creatureAction?.(creature, ours);
      const ourKnowledge = <KnowledgeSlot card={ours} inspect={onInspect} direct={direct} showEmpty={!!hud} action={ours ? knowledgeAction?.(creature, ours) : undefined} />;
      return <div key={creature.id} className={`wd-lane ${action?.highlighted ? 'is-target' : ''}`}>
        <div className="wd-card-pair wd-enemy-pair" data-element={enemy?.element} data-motion-anchor={`slot:${opponent.id}:${enemy?.id}`}>
          {!hud && <SeatMark element={enemy?.element} />}
          <div className="wd-creature-slot wd-enemy-creature">
            <CreatureStatus owl={theirOwl} hurricane={ours?.id === 'aquatic3'} />
            {enemy && <TrainingCard motionAnchor={cardAnchor(opponent.id, enemy)} card={theirOwl ? { ...enemy, currentWisdom: (enemy.currentWisdom ?? getCreatureWisdom(enemy)) + 1 } : enemy} board playFace={direct} onInspect={onInspect} />}
            {!direct && !hud && <div className="wd-creature-label"><span className="wd-creature-name">{enemy?.name}</span></div>}
          </div>
          <KnowledgeSlot card={theirs} inspect={onInspect} direct={direct} showEmpty={!!hud} />
        </div>
        <div className={`wd-card-pair wd-player-pair ${action?.highlighted ? 'is-target' : ''}`} data-element={creature.element} data-motion-anchor={`slot:${player.id}:${creature.id}`}>
          {!hud && <><SeatMark element={creature.element} />{ourKnowledge}</>}
          <div className="wd-creature-slot">
            <CreatureStatus owl={ourOwl} hurricane={theirs?.id === 'aquatic3'} />
            <TrainingCard motionAnchor={cardAnchor(player.id, creature)} card={ourOwl ? { ...creature, currentWisdom: (creature.currentWisdom ?? getCreatureWisdom(creature)) + 1 } : creature} board playFace={direct} onInspect={onInspect} action={direct ? action : undefined} />
            {!direct && !hud && <div className="wd-creature-label"><span className="wd-creature-name">{creature.name}</span></div>}
          </div>
          {hud && ourKnowledge}
        </div>
        {!direct && action && <button type="button" className={`wd-lane-action ${action.highlighted ? 'is-highlighted' : ''} ${action.glowing ? 'wd-guide-glow' : ''}`} aria-disabled={!action.valid} aria-label={action.label} title={action.reason} data-guide-target={action.guideTarget} onClick={action.onActivate}>{action.playing ? <>Play here{action.replacement && <span className="wd-replacement">Replaces {action.replacement}</span>}</> : <><RotateCw size={14} />Rotate</>}</button>}
      </div>;
    })}{hud?.turn}</div>
    {hud?.player ?? <div className="wd-board-side">{guidance ?? 'Your creatures · Click artwork for details'}</div>}
  </section>;
}

export default function TrainingBoard({ session, onAction, onInspect, hud, direct = false, glow }: {
  session: TrainingSession; onAction: (action: TrainingAction) => void; onInspect: (card: DisplayCard) => void; hud: BoardHud; direct?: boolean;
  glow?: GuideGlowTarget | null;
}) {
  const { game, selectedId } = session;
  const selected = game.players[0].hand.find(card => card.instanceId === selectedId);
  return <DuelBoard player={game.players[0]} opponent={game.players[1]} opponentLabel="Bot’s creatures" direct={direct} hud={hud} onInspect={onInspect}
    creatureAction={(creature, knowledge) => {
      const action: TrainingAction = selected ? { type: 'SUMMON_KNOWLEDGE', payload: { playerId: HUMAN_ID, creatureId: creature.id, knowledgeId: selected.id, instanceId: selected.instanceId! } } : { type: 'ROTATE_CREATURE', payload: { playerId: HUMAN_ID, creatureId: creature.id } };
      const validation = validateTrainingAction(session, action);
      const replacement = selected ? knowledge?.name : undefined;
      const guideTarget = creature.id === 'tarasca' ? 'creature' : undefined;
      return {
        playing: Boolean(selected),
        label: selected ? `Play ${selected.name} on ${creature.name}${replacement ? `, replacing ${replacement}` : ''}` : `Rotate ${creature.name}`,
        onActivate: () => onAction(action),
        valid: validation.isValid,
        reason: validation.reason,
        highlighted: validation.isValid && (Boolean(selected) || (session.guide === 'rotate' && creature.id === 'tarasca')),
        guideTarget,
        glowing: glow != null && guideTarget === glow,
        replacement,
      };
    }} />
}
