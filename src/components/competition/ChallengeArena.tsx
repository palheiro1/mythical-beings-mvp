import { useCallback, useState } from 'react';
import { ArrowRight, Clock3, Flag, History, Layers, Trophy, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompetitiveCommand, CompetitiveProjection } from '@mythicalb/wisdom-duel-engine';
import { useDirectCards } from '../../hooks/useDirectCards.js';
import { useMatchClock } from '../../hooks/useCompetitiveMatch.js';
import CardDetailOverlay from '../CardDetailOverlay.js';
import { DuelBoard } from '../training/TrainingBoard.js';
import type { DisplayCard } from '../training/TrainingCard.js';
import TrainingDialog from '../training/TrainingDialog.js';
import PlayCardFace from '../training/PlayCardFace.js';
import { DuelTrays, type TrayTab } from '../training/TrainingTrays.js';
import '../../trainingLandscape.css';
import '../../trainingMotion.css';
import '../../trainingArena.css';

function Scorebar({ projection, mine, rival }: {
  projection: CompetitiveProjection;
  mine: CompetitiveProjection['players'][number];
  rival: CompetitiveProjection['players'][number];
}) {
  const remaining = useMatchClock(projection);
  const playerId = mine.id;
  const opponentId = rival.id;
  const clock = (id: string) => {
    const seconds = Math.ceil(remaining(id) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const active = projection.clock.runningPlayerId;
  return <header className="wd-scorebar">
    <div className="wd-score">
      <span>You</span><strong aria-label={`Your Power: ${Math.max(0, mine.power)}`}>{Math.max(0, mine.power)}</strong>
      <small className={active === playerId && remaining(playerId) <= 60000 ? 'wd-clock-low' : undefined} aria-label={`Your clock: ${clock(playerId)}`}>{clock(playerId)}</small>
    </div>
    <div className="wd-turn">
      <span>Turn {projection.turn}</span>
      <strong>{projection.outcome ? 'Duel complete' : projection.clock.suspendedAt ? 'Paused' : projection.decisionPlayerId === playerId ? 'Your decision' : 'Opponent’s decision'}</strong>
    </div>
    <div className="wd-score wd-score-bot">
      <small className={active === opponentId && remaining(opponentId) <= 60000 ? 'wd-clock-low' : undefined} aria-label={`Opponent’s clock: ${clock(opponentId)}`}>{clock(opponentId)}</small>
      <strong aria-label={`Opponent’s Power: ${Math.max(0, rival.power)}`}>{Math.max(0, rival.power)}</strong><span>Opponent <small>{rival.hand.count} in hand</small></span>
    </div>
  </header>;
}

const outcomeReasons = {
  timeout: 'One player ran out of time.',
  resign: 'One player conceded the duel.',
  power: 'One player ran out of Power.',
  draw: 'The duel ended in a draw.',
};

export default function ChallengeArena({ projection, playerId, standingsPath, sending, retryable, error, send }: {
  projection: CompetitiveProjection; playerId: string; standingsPath: string; sending: boolean; retryable: boolean;
  error: string; send: (command?: CompetitiveCommand) => Promise<unknown>;
}) {
  const [tab, setTab] = useState<TrayTab>('market');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<DisplayCard | null>(null);
  const [dialog, setDialog] = useState<'history' | 'discard' | 'resign' | null>(null);
  const [resultDismissed, setResultDismissed] = useState(false);
  const closeInspection = useCallback(() => setInspection(null), []);
  const direct = useDirectCards();
  const mine = projection.players.find(player => player.id === playerId)!;
  const rival = projection.players.find(player => player.id !== playerId)!;
  const hand = mine.hand.visibility === 'visible' ? mine.hand.cards : [];
  const selected = hand.find(card => card.instanceId === selectedId);
  const { outcome, pendingEffect: pending } = projection;
  const suspended = Boolean(projection.clock.suspendedAt);
  const canDecide = !sending && !retryable && !suspended && !outcome && projection.decisionPlayerId === playerId;
  const canAct = canDecide && !pending && projection.phase === 'action' && projection.currentPlayerId === playerId;
  const actionsLeft = Math.max(0, projection.actionsPerTurn - projection.actionsTakenThisTurn);
  const canSpend = canAct && actionsLeft > 0;
  const hasResultDialog = Boolean(outcome && !resultDismissed && !retryable);
  const hasPendingDialog = Boolean(pending && !inspection && !outcome && !suspended);
  const activeSide = outcome || suspended ? undefined : projection.decisionPlayerId === playerId ? 'player' : 'opponent';
  const message = error || (outcome ? 'The duel is over.' : suspended ? 'The clocks are paused while this duel is reviewed.' : pending ? 'Choose a target to resolve the effect.' : !canAct ? 'Waiting for the opponent.' : selected ? `Play ${selected.name} on one of your creatures.` : 'Draw from the market, rotate a card in play, or select a card from your hand.');

  const play = async (command: CompetitiveCommand) => {
    const status = await send(command);
    if (status === 'accepted' || status === 'duplicate') setSelectedId(null);
  };

  return <div className={`wd wd-match wd-confluence ${direct ? 'wd-direct' : ''}`} data-active-side={activeSide}>
    <h1 className="sr-only">Wisdom Duel — Weekly Challenge duel</h1>
    <Scorebar projection={projection} mine={mine} rival={rival} />
    <div className="wd-game-layout">
      <DuelBoard player={mine} opponent={rival} opponentLabel="Opponent’s creatures" direct={direct} onInspect={setInspection}
        guidance={direct ? 'Your creatures · Tap to play · ⓘ Details' : undefined}
        creatureAction={(creature, knowledge) => {
          const handInstanceId = selected?.instanceId;
          const valid = canSpend && (Boolean(handInstanceId) || (creature.rotation ?? 0) < 270);
          return {
            playing: Boolean(handInstanceId),
            label: selected ? `Play ${selected.name} on ${creature.name}` : `Rotate ${creature.name}`,
            replacement: selected ? knowledge?.name : undefined,
            highlighted: valid && Boolean(selected),
            valid,
            onActivate: () => {
              if (valid) void play(handInstanceId
                ? { type: 'summon_knowledge', creatureId: creature.id, handInstanceId }
                : { type: 'rotate_creature', creatureId: creature.id });
            },
          };
        }}
        knowledgeAction={(creature, card) => ({
          label: `Rotate knowledge: ${card.name}`,
          reason: `Rotate knowledge: ${card.name}`,
          valid: canSpend && Boolean(card.instanceId),
          onActivate: () => {
            if (canSpend && card.instanceId) void play({ type: 'rotate_knowledge', creatureId: creature.id, fieldInstanceId: card.instanceId });
          },
        })} />
      <DuelTrays playerId={playerId} hand={hand} market={projection.market} deckCount={projection.deckCount} tab={tab}
        setTab={setTab} selectedId={selected?.instanceId ?? null} direct={direct} onInspect={setInspection}
        cardAction={(card, inMarket) => ({
          label: `${inMarket ? 'Draw' : 'Select'} ${card.name}`,
          valid: canSpend && Boolean(card.instanceId),
          pressed: inMarket ? undefined : card.instanceId === selectedId,
          onActivate: () => {
            if (!canSpend || !card.instanceId) return;
            if (inMarket) void play({ type: 'draw_knowledge', marketInstanceId: card.instanceId });
            else setSelectedId(previous => previous === card.instanceId ? null : card.instanceId!);
          },
        })} />
    </div>
    <footer className="wd-actionbar">
      <div className="wd-action-context">
        <p className={error ? 'wd-error' : undefined} role={error ? 'alert' : 'status'}>{message}</p>
        <div className="wd-action-meta">
          <span>{canAct ? `${actionsLeft} / ${projection.actionsPerTurn} actions left` : 'Weekly challenge'}</span>
          <span><Clock3 size={14} aria-hidden="true" />10 min per player · total decision time</span>
        </div>
      </div>
      <div className="wd-action-buttons">
        <Link to={standingsPath} className="wd-icon-button" aria-label="Standings" title="Standings"><Trophy size={18} /></Link>
        {selected ? <button type="button" className="wd-icon-button" aria-label="Cancel card selection" onClick={() => setSelectedId(null)}><X size={18} /></button> : null}
        <button type="button" className="wd-discard-button" aria-label="Discard pile" onClick={() => setDialog('discard')}><Layers size={17} /><span>{projection.discardPile.length}</span><span className="wd-discard-label">Discards</span></button>
        <button type="button" className="wd-icon-button" aria-label="Game history" onClick={() => setDialog('history')}><History size={18} /></button>
        {!outcome && !suspended ? <button type="button" className="wd-icon-button" aria-label="Concede match" disabled={sending || retryable} onClick={() => setDialog('resign')}><Flag size={17} /></button> : null}
        {retryable ? <button type="button" className="wd-button wd-button-primary" disabled={sending} onClick={() => void send()}>Retry last move</button>
          : outcome ? <button type="button" className="wd-button wd-button-primary" onClick={() => setResultDismissed(false)}>View Result</button>
            : <button type="button" className="wd-button wd-button-primary" disabled={!canAct} onClick={() => void play({ type: 'end_turn' })}>End Turn <ArrowRight size={16} /></button>}
      </div>
    </footer>
    <div className="wd-match-links"><Link className="wd-text-button" to={standingsPath}>Challenge standings</Link><span>Weekly challenge · Play Hub</span></div>

    {hasResultDialog && outcome ? <TrainingDialog title={outcome.winnerId === null ? 'Draw' : outcome.winnerId === playerId ? 'Victory' : 'Defeat'} onClose={() => setResultDismissed(true)}>
      <p>{outcomeReasons[outcome.reason]}</p>
      <div className="wd-dialog-actions">
        <Link className="wd-button wd-button-primary" to={standingsPath}>Standings</Link>
        <Link className="wd-button" to={`/replay/${projection.matchId}`}>View full replay</Link>
      </div>
    </TrainingDialog> : null}

    {hasPendingDialog && pending ? <TrainingDialog title="Resolve the card effect">
      <p>{pending.prompt}</p>
      <div className="wd-effect-choices">{pending.choices.map(choice => <button type="button" key={choice.key} className="wd-effect-choice"
        disabled={!canDecide} onClick={() => void play({ type: 'resolve_pending_effect', effectId: pending.id, choiceKey: choice.key })}>{choice.label}</button>)}</div>
      {pending.optional ? <button type="button" className="wd-button" disabled={!canDecide} onClick={() => void play({ type: 'resolve_pending_effect', effectId: pending.id, skip: true })}>Skip effect</button> : null}
      {error ? <p role="alert">{error}</p> : null}
      {retryable ? <button type="button" className="wd-button wd-button-primary" disabled={sending} onClick={() => void send()}>Retry last move</button> : null}
    </TrainingDialog> : null}

    {!hasPendingDialog && !hasResultDialog && dialog === 'resign' && !outcome && !suspended ? <TrainingDialog title="Concede match" onClose={() => setDialog(null)}>
      <p>Conceding records a loss for this duel.</p>
      <div className="wd-dialog-actions"><button type="button" className="wd-button wd-button-primary" disabled={sending || retryable}
        onClick={() => { setDialog(null); void play({ type: 'resign' }); }}>Confirm concession</button></div>
    </TrainingDialog> : null}

    {!hasPendingDialog && !hasResultDialog && dialog === 'discard' ? <TrainingDialog title="Discard pile" onClose={() => setDialog(null)}>
      <p>{projection.discardPile.length ? 'Cards can be shuffled back into the deck when the market refills.' : 'No discarded cards yet.'}</p>
      <div className="wd-discard-grid">{[...projection.discardPile].reverse().map(card => <button type="button" key={card.instanceId} className="wd-discard-card"
        aria-label={`Inspect discarded ${card.name}`} onClick={() => { setDialog(null); setInspection(card); }}><PlayCardFace card={card} /><span>{card.name}</span></button>)}</div>
    </TrainingDialog> : null}

    {!hasPendingDialog && !hasResultDialog && dialog === 'history' ? <TrainingDialog title="Game history" onClose={() => setDialog(null)}>
      <ol>{projection.events.slice(-12).map(event => <li key={event.sequence}>
        {event.sequence}. {event.actorId === playerId ? 'You' : event.actorId ? 'Opponent' : 'Match'} · {event.type.replace(/_/g, ' ')}
      </li>)}</ol>
    </TrainingDialog> : null}
    <CardDetailOverlay card={inspection} open={Boolean(inspection) && !hasResultDialog} onClose={closeInspection} contextLabel="Card details" />
  </div>;
}
