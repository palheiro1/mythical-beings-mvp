import { useTrainingMotion } from '../../hooks/useTrainingMotion.js';
import { ArenaHeader, DuelArena, PowerMedallion, TurnCallout } from '../game/DuelArena.js';
import type { ArenaProjection } from '../../utils/trainingMotion.js';
import { useTrainingAudio } from '../../hooks/useTrainingAudio.js';
import TrainingSoundControls from '../training/TrainingSoundControls.js';
import DuelTargetChoices from '../game/DuelTargetChoices.js';
import DuelEffectHistory from '../game/DuelEffectHistory.js';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Flag, History, Layers, Swords, Trophy, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompetitiveCommand } from '@mythicalb/wisdom-duel-engine';
import { useDirectCards } from '../../hooks/useDirectCards.js';
import { useMatchClock } from '../../hooks/useCompetitiveMatch.js';
import CardDetailOverlay from '../CardDetailOverlay.js';
import CardFaceByImage from '../CardFaceByImage.js';
import { DuelBoard } from '../training/TrainingBoard.js';
import type { DisplayCard } from '../training/TrainingCard.js';
import TrainingDialog from '../training/TrainingDialog.js';
import PlayCardFace from '../training/PlayCardFace.js';
import { DuelTrays, type TrayTab } from '../training/TrainingTrays.js';
import { getCardPresentation } from '../../utils/digitalCards.js';
function LiveHeader({ projection, onRules, children }: { projection: ArenaProjection; onRules: () => void; children: ReactNode }) {
  const remaining = useMatchClock(projection);
  const running = projection.clock.runningPlayerId;
  const seconds = running ? Math.ceil(remaining(running) / 1000) : 0;
  const time = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  return <ArenaHeader onRules={onRules} clock={projection.outcome ? undefined : projection.clock.suspendedAt ? 'Clock paused' : time}
    warning={running && !projection.clock.suspendedAt && seconds <= 10 ? seconds <= 5 ? 'red' : 'amber' : undefined}>{children}</ArenaHeader>;
}

const outcomeReasons = {
  timeout: 'One player ran out of time.',
  resign: 'One player conceded the duel.',
  power: 'One player ran out of Power.',
  draw: 'The duel ended in a draw.',
};

export default function ChallengeArena({ projection, playerId, lobbyPath, casualDuel = false, sending = false, retryable = false, error = '', send, observer, callControls }: {
  projection: ArenaProjection; playerId?: string; lobbyPath: string; casualDuel?: boolean; sending?: boolean; retryable?: boolean;
  callControls?: ReactNode; error?: string; send?: (command?: CompetitiveCommand) => Promise<unknown>;
  observer?: { turnLabel: string; latest: string; history: ReactNode };
}) {
  const seat = playerId ?? projection.players[0].id;
  const modeName = casualDuel ? 'Casual duel' : projection.mode === 'wager' ? 'Wager duel' : projection.mode === 'league' && !lobbyPath.startsWith('/challenge') ? 'League duel' : 'Weekly challenge';
  const lobbyLabel = observer ? 'Live duels' : casualDuel ? 'Player duels' : projection.mode === 'wager' ? 'Wagers' : 'Standings';
  const [tab, setTab] = useState<TrayTab>('market');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<DisplayCard | null>(null);
  const [dialog, setDialog] = useState<'history' | 'discard' | 'resign' | 'sound' | 'rules' | null>(null);
  const [resultDismissed, setResultDismissed] = useState(false);
  const closeInspection = useCallback(() => setInspection(null), []);
  const direct = useDirectCards();
  const mine = projection.players.find(player => player.id === seat)!;
  const rival = projection.players.find(player => player.id !== seat)!;
  const hand = mine.hand.visibility === 'visible' ? mine.hand.cards : [];
  const selected = hand.find(card => card.instanceId === selectedId);
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const audio = useTrainingAudio(false);
  const motion = useTrainingMotion(projection, root, layer, `${tab}:${direct}`, false, audio.presentation, !observer, observer ? 'spectator' : seat);
  const { outcome, pendingEffect: pending } = projection;
  const suspended = Boolean(projection.clock.suspendedAt);
  const canDecide = Boolean(send) && !observer && !sending && !retryable && !suspended && !outcome && projection.decisionPlayerId === playerId;
  const canAct = canDecide && !pending && projection.phase === 'action' && projection.currentPlayerId === playerId;
  const actionsLeft = Math.max(0, projection.actionsPerTurn - projection.actionsTakenThisTurn);
  const canSpend = canAct && actionsLeft > 0;
  const hasResultDialog = Boolean(outcome && !resultDismissed && !retryable && !motion.presenting);
  const hasPendingDialog = !observer && Boolean(pending && !inspection && !outcome && !suspended);
  const activeSide = outcome || suspended ? undefined : projection.decisionPlayerId === seat ? 'player' : 'opponent';
  const selectedHint = selected && (getCardPresentation(selected, 0).current.kind === 'damage'
    ? `Play ${selected.name} on a creature. Its cycle damage resolves in your next Knowledge Phase.`
    : `Play ${selected.name} on one of your creatures.`);
  const message = error || observer?.latest || (outcome ? 'The duel is over.' : suspended ? 'The clocks are paused while this duel is reviewed.' : pending ? 'Choose a target to resolve the effect.' : !canAct ? 'Waiting for the opponent.' : selectedHint || 'Draw from the market, rotate a card in play, or select a card from your hand.');

  const play = async (command: CompetitiveCommand) => {
    if (!send || observer) return;
    motion.finish();
    motion.capture();
    const status = await send(command);
    if (status === 'accepted' || status === 'duplicate') setSelectedId(null);
  };

  const myTurn = projection.currentPlayerId === seat;
  const lights = { remaining: actionsLeft, total: projection.actionsPerTurn };
  const turnLabel = observer?.turnLabel ?? (outcome ? 'Duel complete' : suspended ? 'Duel paused' : pending ? 'Your decision' : myTurn ? 'Your turn' : 'Opponent’s turn');
  const title = observer ? 'Spectating — ' + modeName : 'Wisdom Duel — ' + (modeName === 'Weekly challenge' ? 'Weekly Challenge duel' : modeName);
  return <DuelArena root={root} layer={layer} direct={direct} activeSide={activeSide} unlock={audio.unlock} title={title} announcement={motion.announcement}
    header={<LiveHeader projection={projection} onRules={() => setDialog('rules')}>
      {callControls}
      <TrainingSoundControls preferences={audio.preferences} update={audio.update} error={audio.error} play={audio.presentation.play}
        open={dialog === 'sound' && !inspection} onOpen={() => setDialog('sound')} onClose={() => setDialog(null)} />
    </LiveHeader>}>
    <div className="wd-game-layout">
      <DuelBoard player={mine} opponent={rival} opponentLabel="Opponent’s creatures" direct={direct} onInspect={setInspection}
        guidance={direct ? 'Your creatures · Tap to play · ⓘ Details' : undefined}
        hud={{
          player: <PowerMedallion owner={seat} side="player" label={observer ? 'Player 1' : 'Your'} power={mine.power} actions={myTurn && !outcome ? lights : undefined} />,
          opponent: <PowerMedallion owner={rival.id} side="opponent" label={observer ? 'Player 2' : 'Opponent’s'} power={rival.power} handSize={rival.hand.count} actions={!myTurn && !outcome ? lights : undefined} />,
          turn: <TurnCallout turn={projection.turn} playerId={projection.currentPlayerId} label={turnLabel} complete={!!outcome} />,
        }}
        creatureAction={observer ? undefined : (creature, knowledge) => {
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
        knowledgeAction={observer ? undefined : (creature, card) => ({
          label: `Rotate Knowledge card ${card.name}`,
          reason: `Rotate Knowledge card ${card.name}`,
          valid: canSpend && Boolean(card.instanceId),
          onActivate: () => {
            if (canSpend && card.instanceId) void play({ type: 'rotate_knowledge', creatureId: creature.id, fieldInstanceId: card.instanceId });
          },
        })} />
      <DuelTrays playerId={seat} hiddenHands={observer ? [mine.hand.count, rival.hand.count] : undefined} marketList hand={hand} market={projection.market} deckCount={projection.deckCount} tab={tab}
        setTab={setTab} selectedId={selected?.instanceId ?? null} direct={direct} onInspect={setInspection}
        cardAction={observer ? undefined : (card, inMarket) => ({
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
        {motion.summary && <p className="wd-effect-summary" role="status" aria-label="Latest effects">{motion.summary}</p>}
        <p className={error ? 'wd-error' : motion.summary && !selected && !pending ? 'wd-idle-hint' : undefined} role={error ? 'alert' : 'status'}>{message}</p>
        <div className="wd-action-meta">
          <span>{canAct ? `${actionsLeft} / ${projection.actionsPerTurn} actions left` : modeName}</span>

        </div>
      </div>
      <div className="wd-action-buttons">
        <Link to={lobbyPath} className="wd-icon-button" aria-label={lobbyLabel} title={lobbyLabel}>{casualDuel ? <Swords size={18} /> : <Trophy size={18} />}</Link>
        {selected ? <button type="button" className="wd-icon-button" aria-label="Cancel card selection" onClick={() => setSelectedId(null)}><X size={18} /></button> : null}
        <button type="button" className="wd-discard-button" data-motion-anchor="discard" aria-label="Discard pile" onClick={() => setDialog('discard')}><Layers size={17} /><span>{projection.discardPile.length}</span><span className="wd-discard-label">Discards</span></button>
        <button type="button" className="wd-icon-button" aria-label="Game history" onClick={() => setDialog('history')}><History size={18} /></button>
        {!observer && !outcome && !suspended ? <button type="button" className="wd-icon-button" aria-label="Concede match" disabled={sending || retryable} onClick={() => setDialog('resign')}><Flag size={17} /></button> : null}
        {observer ? null : retryable ? <button type="button" className="wd-button wd-button-primary" disabled={sending} onClick={() => void send?.()}>Retry last move</button>
          : outcome ? <button type="button" className="wd-button wd-button-primary" onClick={() => setResultDismissed(false)}>View Result</button>
            : <button type="button" className="wd-button wd-button-primary" disabled={!canAct} onClick={() => void play({ type: 'end_turn' })}>End Turn <ArrowRight size={16} /></button>}
      </div>
    </footer>
    <div className="wd-match-links"><Link className="wd-text-button" to={lobbyPath}>{lobbyLabel}</Link>
      {!observer && !outcome && <Link className="wd-text-button" to={`/watch/${projection.matchId}`} target="_blank" rel="noopener noreferrer">Open spectator view</Link>}
      <span>{modeName} · Play Hub</span></div>

    {hasResultDialog && outcome ? <TrainingDialog title={observer ? observer.turnLabel : outcome.winnerId === null ? 'Draw' : outcome.winnerId === playerId ? 'Victory' : 'Defeat'} onClose={() => setResultDismissed(true)}>
      <p>{projection.clock.turnMs && outcome.reason === 'timeout' ? 'Two consecutive turns passed without a move.' : outcomeReasons[outcome.reason]}</p>
      <div className="wd-dialog-actions">
        <Link className="wd-button wd-button-primary" to={lobbyPath}>{lobbyLabel}</Link>
        {!observer && <Link className="wd-button" to={`/replay/${projection.matchId}`}>View full replay</Link>}
      </div>
    </TrainingDialog> : null}

    {hasPendingDialog && pending ? <section className="wd-live-choice" aria-label="Resolve the card effect">
      <p>{pending.prompt}</p>
      <DuelTargetChoices view={projection} board={root} className="wd-effect-choices">{pending.choices.map((choice, index) => {
        const handDiscard = pending.type === 'chooseOpponentHandDiscard' && choice.kind === 'hand';
        return <button type="button" key={choice.key} data-choice-index={index} className="wd-effect-choice"
          aria-label={handDiscard ? `Discard ${choice.label}` : undefined}
          disabled={!canDecide} onClick={() => void play({ type: 'resolve_pending_effect', effectId: pending.id, choiceKey: choice.key })}>
          {handDiscard && <span className="wd-discard-option-art" aria-hidden="true">
            {choice.image ? <CardFaceByImage src={choice.image} alt="" />
              : <img src="/images/spells/back-360.webp" alt="" />}
          </span>}
          {choice.label}
        </button>;
      })}</DuelTargetChoices>
      {pending.optional ? <button type="button" className="wd-button" disabled={!canDecide} onClick={() => void play({ type: 'resolve_pending_effect', effectId: pending.id, skip: true })}>Skip effect</button> : null}
      {error ? <p role="alert">{error}</p> : null}
      {observer ? null : retryable ? <button type="button" className="wd-button wd-button-primary" disabled={sending} onClick={() => void send?.()}>Retry last move</button> : null}
    </section> : null}

    {!hasPendingDialog && !hasResultDialog && dialog === 'resign' && !outcome && !suspended ? <TrainingDialog title="Concede match" onClose={() => setDialog(null)}>
      <p>{projection.mode === 'wager' ? 'Conceding loses the wager and one staked card.' : 'Conceding records a loss for this duel.'}</p>
      <div className="wd-dialog-actions"><button type="button" className="wd-button wd-button-primary" disabled={sending || retryable}
        onClick={() => { setDialog(null); void play({ type: 'resign' }); }}>Confirm concession</button></div>
    </TrainingDialog> : null}

    {!hasPendingDialog && !hasResultDialog && dialog === 'discard' ? <TrainingDialog title="Discard pile" onClose={() => setDialog(null)}>
      <p>{projection.discardPile.length ? 'Cards can be shuffled back into the deck when the market refills.' : 'No discarded cards yet.'}</p>
      <div className="wd-discard-grid">{[...projection.discardPile].reverse().map(card => <button type="button" key={card.instanceId} className="wd-discard-card"
        aria-label={`Inspect discarded ${card.name}`} onClick={() => { setDialog(null); setInspection(card); }}><PlayCardFace card={card} /><span>{card.name}</span></button>)}</div>
    </TrainingDialog> : null}

    {!hasPendingDialog && !hasResultDialog && dialog === 'history' ? <TrainingDialog title="Game history" onClose={() => setDialog(null)}>
      {observer ? observer.history : <DuelEffectHistory events={projection.events} viewer={seat} />}
    </TrainingDialog> : null}
    {dialog === 'rules' && <TrainingDialog title="Duel rules" onClose={() => setDialog(null)}>
      <p>Reduce the other team’s Power to zero. Drawing adds a card to your hand. Play it on a creature to use it. On-play abilities happen immediately. Cycle damage resolves in your Knowledge Phase.</p>
      <p>Defense absorbs damage before it reaches Power. Open Game history to see which card attacked, what blocked it and how much Power changed.</p>
      <p>You normally have two actions in the Action Phase.</p>
      <p>{projection.clock.turnMs ? 'Each turn has 30 seconds. When time runs out the turn passes. Missing two of your turns in a row without making a move loses the duel.' : 'This duel started with a ten-minute decision clock per player.'}</p>
      <Link className="wd-button" to="/how-to-play" target="_blank" rel="noopener">Full rules</Link>
    </TrainingDialog>}
    <CardDetailOverlay card={inspection} open={Boolean(inspection) && !hasResultDialog} onClose={closeInspection} contextLabel="Card details" />
  </DuelArena>;
}
