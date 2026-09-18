import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Flag, History, Home, Layers, RotateCcw, Smartphone, X } from 'lucide-react';
import creatureData from '../assets/creatures.json';
import { track } from '../analytics/productAnalytics.js';
import { isValidBotCreatureSelection, readBotCreatureSelection, clearBotCreatureSelection } from '../utils/botSelection.js';
import { GUIDED_TEAM, rememberTutorial, trainingModeFromSearch, type TrainingMode } from '../utils/trainingMode.js';
import { BOT_ID, HUMAN_ID, createTrainingSession, trainingSessionReducer, type TrainingAction } from '../game/trainingSession.js';
import { useTurnTimer } from '../hooks/useTurnTimer.js';
import { useTrainingBot } from '../hooks/useTrainingBot.js';
import { usePortraitViewport } from '../hooks/usePortraitViewport.js';
import { useTrainingMotion } from '../hooks/useTrainingMotion.js';
import { useDirectCards } from '../hooks/useDirectCards.js';
import CardDetailOverlay from '../components/CardDetailOverlay.js';
import CardFaceByImage from '../components/CardFaceByImage.js';
import { getPendingEffectCard } from '../utils/pendingEffectCard.js';
import TrainingBoard from '../components/training/TrainingBoard.js';
import PlayCardFace from '../components/training/PlayCardFace.js';
import TrainingTrays, { type TrayTab } from '../components/training/TrainingTrays.js';
import TrainingCoach from '../components/training/TrainingCoach.js';
import TrainingDialog from '../components/training/TrainingDialog.js';
import type { DisplayCard } from '../components/training/TrainingCard.js';
import '../trainingLandscape.css';
import '../trainingMotion.css';

function PracticeMatch({ team, mode, gameId, onReplay }: { team: string[]; mode: TrainingMode; gameId: string; onReplay: () => void }) {
  const navigate = useNavigate();
  const [session, dispatch] = useReducer(trainingSessionReducer, { team, mode, gameId }, args => createTrainingSession(args.team, args.mode, args.gameId));
  const { game, guide } = session;
  const [tab, setTab] = useState<TrayTab>('market');
  const [inspection, setInspection] = useState<DisplayCard | null>(null);
  const closeInspection = useCallback(() => setInspection(null), []);
  const [dialog, setDialog] = useState<'history' | 'resign' | 'discard' | null>(null);
  const [resultDismissed, setResultDismissed] = useState(false);
  const portrait = usePortraitViewport();
  const directCards = useDirectCards();
  const [allowPortrait, setAllowPortrait] = useState(false);
  const orientationPaused = portrait && !allowPortrait;
  const containerRef = useRef<HTMLDivElement>(null);
  const motionLayerRef = useRef<HTMLDivElement>(null);
  const { capture, announcement, presenting } = useTrainingMotion(game, containerRef, motionLayerRef, `${directCards}-${tab}`, orientationPaused);
  const onAction = useCallback((action: TrainingAction) => { capture(); dispatch({ type: 'play', action }); }, [capture]);
  useTrainingBot(game, onAction, orientationPaused);
  const isMyTurn = game.currentPlayerIndex === 0 && game.phase === 'action';
  const gameOver = game.phase === 'gameOver';
  const paused = guide !== 'free';
  const endTurn = useCallback(() => onAction({ type: 'END_TURN', payload: { playerId: HUMAN_ID } }), [onAction]);
  const remainingTime = useTurnTimer({ isMyTurn: isMyTurn && !game.pendingEffect && !paused, phase: game.phase === 'action' ? 'action' : null,
    turnDurationSeconds: 30, onTimerEnd: endTurn, gameTurn: game.turn, currentPlayerIndex: game.currentPlayerIndex, paused: orientationPaused });
  const observed = useRef({ started: false, first: false, ended: false, abandonTimeout: 0 });
  useEffect(() => {
    window.clearTimeout(observed.current.abandonTimeout);
    if (!observed.current.started) { observed.current.started = true; track('training_start'); }
    const observation = observed.current;
    return () => {
      observation.abandonTimeout = window.setTimeout(() => {
        if (!observation.ended) { observation.ended = true; track('training_complete', { outcome: 'abandoned', termination_reason: 'navigation' }); }
      }, 0);
    };
  }, []);
  useEffect(() => {
    if (session.humanActions && !observed.current.first) observed.current.first = track('first_action');
    if (gameOver && !observed.current.ended) {
      observed.current.ended = true;
      track('training_complete', { outcome: session.resigned ? 'abandoned' : game.winner === BOT_ID ? 'lost' : game.winner === HUMAN_ID ? 'won' : 'draw', termination_reason: session.resigned ? 'resigned' : 'completed' });
    }
  }, [session.humanActions, session.resigned, gameOver, game.winner]);
  useEffect(() => {
    if (guide === 'complete' || guide === 'handoff') rememberTutorial(session.tutorialCompleted);
    if (guide === 'draw') setTab('market');
    if (guide === 'summon') setTab('hand');
    const target = guide === 'draw' ? 'market' : guide === 'rotate' ? 'creature' : guide === 'summon' ? 'hand' : guide === 'end' ? 'end' : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      const element = containerRef.current?.querySelector<HTMLElement>(`[data-guide-target="${target}"]`);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const coachBottom = containerRef.current?.querySelector('.wd-coach')?.getBoundingClientRect().bottom ?? 60;
      const actionHeight = target === 'end' ? 0 : containerRef.current?.querySelector('.wd-actionbar')?.getBoundingClientRect().height ?? 0;
      if (rect.top < Math.max(60, coachBottom) + 8 || rect.bottom > window.innerHeight - actionHeight - 8) {
        element.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [guide, session.tutorialCompleted, orientationPaused]);
  const [player, bot] = game.players;
  const selected = player.hand.find(card => card.instanceId === session.selectedId);
  const actionsLeft = Math.max(0, game.actionsPerTurn - game.actionsTakenThisTurn);
  const pending = game.pendingEffect;
  const message = session.feedback || (paused && !gameOver && !game.pendingEffect && isMyTurn ? guide === 'welcome' ? 'Start the lesson whenever you are ready.' : guide === 'complete' || guide === 'handoff' ? 'Continue Practice starts the turn clock.' : 'Follow the highlighted lesson action. Take your time.' : gameOver ? 'The duel is over.' : pending ? pending.playerId === HUMAN_ID ? 'Choose a target to resolve the card effect.' : 'The bot is resolving a card effect.' : !isMyTurn ? 'The bot is thinking. Your next turn is coming.' : selected ? `Play ${selected.name} on a highlighted creature.` : directCards ? 'Tap a creature to rotate, a market card to draw, or a hand card to select.' : 'Rotate a creature, draw from the market, or select a card in your hand.');
  if (orientationPaused) return <div className="wd wd-rotate-notice">
    <Smartphone size={64} strokeWidth={1.2} aria-hidden="true" />
    <p className="wd-eyebrow">Wisdom Duel · Landscape play</p>
    <h1>Turn your phone to play.</h1>
    <p>The board, your hand and the market fit side by side in landscape.</p>
    <p role="status">Your match and clock are paused. Rotate your phone to continue.</p>
    <Link className="wd-button" to="/">Back to Home</Link>
    <button className="wd-text-button" onClick={() => setAllowPortrait(true)}>Can’t rotate? Continue in portrait</button>
  </div>;
  return <div ref={containerRef} className={`wd wd-match ${paused && !gameOver ? 'has-guide' : ''} ${directCards ? 'wd-direct' : ''}`}>
    <h1 className="sr-only">Wisdom Duel — Solo practice</h1>
    <div ref={motionLayerRef} className="wd-motion-layer" aria-hidden="true" inert />
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    <header className="wd-scorebar">
      <div className="wd-score"><span>You</span><strong data-motion-anchor={`power:${HUMAN_ID}`} aria-label={`Your Power: ${Math.max(0, player.power)}`}>{Math.max(0, player.power)}</strong><small>Power</small></div>
      <div className="wd-turn"><span>Turn {game.turn}</span><strong>{gameOver ? 'Duel complete' : isMyTurn ? 'Your turn' : 'Bot’s turn'}</strong></div>
      <div className="wd-score wd-score-bot"><small>Power</small><strong data-motion-anchor={`power:${BOT_ID}`} aria-label={`Bot Power: ${Math.max(0, bot.power)}`}>{Math.max(0, bot.power)}</strong><span data-motion-anchor={`hand:${BOT_ID}`}>Bot <small>{bot.hand.length} in hand</small></span></div>
    </header>
    {!gameOver && <TrainingCoach direct={directCards} resolvingEffect={!!game.pendingEffect} step={guide} onStart={() => dispatch({ type: 'start-guide' })} onSkip={() => dispatch({ type: 'skip-guide' })} onContinue={() => dispatch({ type: 'continue' })} />}
    <div className="wd-game-layout">
      <TrainingBoard direct={directCards} session={session} onAction={onAction} onInspect={setInspection} />
      <TrainingTrays direct={directCards} session={session} tab={tab} setTab={setTab} onAction={onAction} onSelect={instanceId => dispatch({ type: 'select', instanceId })} onInspect={setInspection} />
    </div>
    <footer className="wd-actionbar">
      <div className="wd-action-context"><p className={session.rejected ? 'wd-error' : ''} role={session.rejected ? 'alert' : 'status'}>{message}</p><div className="wd-action-meta"><span>{gameOver ? 'Practice match' : isMyTurn ? `${actionsLeft} / ${game.actionsPerTurn} actions left` : 'Waiting for bot'}</span><span className={remainingTime <= 8 && !paused && isMyTurn ? 'wd-clock-low' : ''}><Clock3 size={14} />{paused ? 'Clock paused' : isMyTurn ? `${remainingTime}s` : '30s per turn'}</span></div></div>
      <div className="wd-action-buttons">
        <Link to="/" className="wd-icon-button wd-landscape-only" aria-label="Back to Home"><Home size={18} /></Link>
        {selected && <button className="wd-icon-button" aria-label="Cancel card selection" onClick={() => dispatch({ type: 'select', instanceId: null })}><X size={18} /></button>}
        <button className="wd-discard-button" data-motion-anchor="discard" aria-label={`Discard pile, ${game.discardPile.length} ${game.discardPile.length === 1 ? 'card' : 'cards'}`} onClick={() => setDialog('discard')}><Layers size={17} /><span>{game.discardPile.length}</span><span className="wd-discard-label">Discards</span></button>
        <button className="wd-icon-button" aria-label="Game history" onClick={() => setDialog('history')}><History size={18} /></button>
        {!gameOver && <button className="wd-icon-button" aria-label="Concede match" onClick={() => setDialog('resign')}><Flag size={17} /></button>}
        {gameOver ? <button className="wd-button wd-button-primary" onClick={() => setResultDismissed(false)}>View Result</button> : <button className={`wd-button wd-button-primary ${guide === 'end' ? 'is-highlighted' : ''}`} data-guide-target="end" disabled={!isMyTurn || !!pending || (paused && guide !== 'end')} onClick={endTurn}>End Turn <ArrowRight size={16} /></button>}
      </div>
    </footer>
    <div className="wd-match-links"><button className="wd-text-button" onClick={() => navigate('/bot-selection?mode=guided')}><RotateCcw size={14} />Repeat tutorial</button><span>Solo practice · No competitive rewards</span></div>
    <CardDetailOverlay card={inspection} open={!!inspection} onClose={closeInspection} contextLabel="Card details" />
    {pending?.playerId === HUMAN_ID && !inspection && !presenting && <TrainingDialog title={pending.sourceKnowledgeName || 'Choose a target'}><p>{pending.prompt}</p><div className="wd-effect-choices">{pending.choices.map((choice, index) => { const targetCard = getPendingEffectCard(game, choice); return <button key={index} className="wd-effect-choice" onClick={() => onAction({ type: 'RESOLVE_PENDING_EFFECT', payload: { playerId: HUMAN_ID, resolution: { effectId: pending.id, choice } } })}>{directCards && targetCard ? <span className="wd-effect-art"><PlayCardFace card={targetCard} /></span> : choice.image && <CardFaceByImage src={choice.image} alt={choice.label} card={targetCard} className="mx-auto mb-2 w-[100px]" />}<span>{choice.label}</span></button>; })}</div>{pending.optional && <button className="wd-button" onClick={() => onAction({ type: 'RESOLVE_PENDING_EFFECT', payload: { playerId: HUMAN_ID, resolution: { effectId: pending.id, skip: true } } })}>Skip effect</button>}</TrainingDialog>}
    {dialog === 'discard' && !pending && (!gameOver || resultDismissed) && <TrainingDialog title="Discard pile" onClose={() => setDialog(null)}><p>{game.discardPile.length ? `${game.discardPile.length} ${game.discardPile.length === 1 ? 'card' : 'cards'} · Most recent first` : 'Cards that leave play arrive here.'}</p><div className="wd-discard-grid">{[...game.discardPile].reverse().map(card => <button key={card.instanceId} className="wd-discard-card" aria-label={`Inspect discarded ${card.name}`} onClick={() => { setDialog(null); setInspection(card); }}><PlayCardFace card={card} /><span>{card.name}</span></button>)}</div></TrainingDialog>}
    {dialog === 'history' && !pending && (!gameOver || resultDismissed) && <TrainingDialog title="Game history" onClose={() => setDialog(null)}><ol className="wd-history">{game.log.map((entry, index) => <li key={index}>{entry.split(HUMAN_ID).join('You').split(BOT_ID).join('Bot').replace(/^\[[^\]]+\]\s*/, '')}</li>)}</ol></TrainingDialog>}
    {dialog === 'resign' && !pending && !gameOver && <TrainingDialog title="Concede this match?" onClose={() => setDialog(null)}><p>You can start another practice match at any time.</p><div className="wd-dialog-actions"><button className="wd-button" onClick={() => setDialog(null)}>Keep Playing</button><button className="wd-button wd-button-primary" onClick={() => { setDialog(null); dispatch({ type: 'resign' }); }}>Concede Match</button></div></TrainingDialog>}
    {gameOver && !resultDismissed && !inspection && !presenting && <TrainingDialog title={session.resigned ? 'Match conceded' : game.winner === HUMAN_ID ? 'Victory is yours.' : game.winner === BOT_ID ? 'The bot wins this duel.' : 'A draw between legends.'} onClose={() => setResultDismissed(true)}>
      <p className="wd-eyebrow">Practice complete · Turn {game.turn}</p><div className="wd-result-score"><span>You <strong>{Math.max(0, player.power)}</strong></span><span>Power</span><span>Bot <strong>{Math.max(0, bot.power)}</strong></span></div>
      <p>{game.winner === HUMAN_ID ? 'Your creatures and knowledge found their rhythm. Try another combination.' : 'Every duel is a chance to discover a new combination. Your next one starts here.'}</p>
      <div className="wd-dialog-actions"><button className="wd-button wd-button-primary" onClick={onReplay}><RotateCcw size={17} />Play Again</button><button className="wd-button" onClick={() => navigate('/bot-selection?mode=free')}>Choose Another Team</button></div><button className="wd-text-button" onClick={() => setResultDismissed(true)}>Review the board</button>
    </TrainingDialog>}
  </div>;
}

export default function BotGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = trainingModeFromSearch(location.search);
  const routeState = location.state as { selectedCreatures?: unknown } | null;
  const selected = routeState?.selectedCreatures;
  const team = mode === 'guided' ? GUIDED_TEAM : isValidBotCreatureSelection(selected) ? selected : readBotCreatureSelection();
  const valid = !!team && team.every(id => creatureData.some(card => card.id === id));
  const [prefix] = useState(() => `practice-${crypto.randomUUID()}`);
  useEffect(() => {
    if (!valid) { try { clearBotCreatureSelection(); } catch { /* Storage is optional. */ } navigate('/bot-selection?mode=free', { replace: true }); }
  }, [valid, navigate]);
  if (!team || !valid) return <div className="wd wd-loading" role="status">Choose three creatures to begin.</div>;
  return <PracticeMatch key={`${location.key}-${mode}-${team.join('-')}`} team={team} mode={mode} gameId={`${prefix}-${location.key}`} onReplay={() => {
    navigate('/bot-game?mode=free', { replace: true, state: { selectedCreatures: team } });
  }} />;
}
