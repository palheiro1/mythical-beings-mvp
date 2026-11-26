import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock3, Flag, History, Layers, RotateCcw, Smartphone, X } from 'lucide-react';
import { creatures as creatureData } from '@mythicalb/wisdom-duel-engine/catalog';
import { track } from '../analytics/productAnalytics.js';
import { isValidBotCreatureSelection, readBotCreatureSelection, clearBotCreatureSelection } from '../utils/botSelection.js';
import { formatGameHistoryEntry } from '../utils/gameHistory.js';
import { GUIDED_TEAM, rememberTutorial, trainingModeFromSearch, type TrainingMode } from '../utils/trainingMode.js';
import { BOT_ID, HUMAN_ID, createTrainingSession, trainingSessionReducer, type TrainingAction } from '../game/trainingSession.js';
import { useTurnTimer } from '../hooks/useTurnTimer.js';
import { useTrainingBot } from '../hooks/useTrainingBot.js';
import { usePortraitViewport } from '../hooks/usePortraitViewport.js';
import { useTrainingMotion } from '../hooks/useTrainingMotion.js';
import { useTrainingAudio } from '../hooks/useTrainingAudio.js';
import TrainingSoundControls from '../components/training/TrainingSoundControls.js';
import { useDirectCards } from '../hooks/useDirectCards.js';
import { guideGlowSequence, useGuideGlow } from '../hooks/useGuideGlow.js';
import CardDetailOverlay from '../components/CardDetailOverlay.js';
import CardFaceByImage from '../components/CardFaceByImage.js';
import { getPendingEffectCard } from '../utils/pendingEffectCard.js';
import TrainingBoard from '../components/training/TrainingBoard.js';
import PlayCardFace from '../components/training/PlayCardFace.js';
import TrainingTrays, { type TrayTab } from '../components/training/TrainingTrays.js';
import TrainingCoach from '../components/training/TrainingCoach.js';
import TrainingDialog from '../components/training/TrainingDialog.js';
import DuelTargetChoices from '../components/game/DuelTargetChoices.js';
import ActionLights from '../components/game/ActionLights.js';
import TrainingIntro, { type IntroProgress } from '../components/training/TrainingIntro.js';
import type { DisplayCard } from '../components/training/TrainingCard.js';
import '../trainingLandscape.css';
import '../trainingMotion.css';
import '../trainingArena.css';
import '../trainingAudio.css';
import '../trainingKai.css';
import '../trainingLesson.css';

function PowerMedallion({ power, side, handSize, actions }: {
  power: number;
  side: 'player' | 'opponent';
  handSize?: number;
  actions?: { remaining: number; total: number };
}) {
  const isPlayer = side === 'player';
  const value = Math.max(0, power);
  return <div className={`wd-power-medallion wd-power-${side}`} data-motion-anchor={isPlayer ? undefined : `hand:${BOT_ID}`} title={isPlayer ? undefined : `Bot · ${handSize} in hand`}>
    <strong className="wd-power-value" data-motion-anchor={`power:${isPlayer ? HUMAN_ID : BOT_ID}`} aria-label={`${isPlayer ? 'Your' : 'Bot'} Power: ${value}`}>{value}</strong>
    {actions && <ActionLights owner={isPlayer ? HUMAN_ID : BOT_ID} {...actions} />}
  </div>;
}

interface PracticeMatchProps {
  team: string[];
  mode: TrainingMode;
  gameId: string;
  rulesOpen: boolean;
  openRules: () => void;
  resumeDuel: () => void;
  onReplay: () => void;
}

function PracticeMatch({ team, mode, gameId, rulesOpen, openRules, resumeDuel, onReplay }: PracticeMatchProps) {
  const navigate = useNavigate();
  const [session, dispatch] = useReducer(trainingSessionReducer, { team, mode, gameId }, args => createTrainingSession(args.team, args.mode, args.gameId));
  const { game, guide } = session;
  const pending = game.pendingEffect;
  const lessonBonus = guide === 'end' && pending?.playerId === HUMAN_ID && pending.type === 'chooseCreatureToRotate'
    && pending.sourceKnowledgeName === 'Tulpar' && pending.optional === true;
  const [tab, setTab] = useState<TrayTab>('market');
  const [inspection, setInspection] = useState<DisplayCard | null>(null);
  const closeInspection = useCallback(() => setInspection(null), []);
  const [boardDialog, setDialog] = useState<'history' | 'resign' | 'discard' | 'sound' | null>(null);
  const dialog = rulesOpen ? 'rules' : boardDialog;
  const [resultDismissed, setResultDismissed] = useState(false);
  const portrait = usePortraitViewport();
  const directCards = useDirectCards();
  const [allowPortrait, setAllowPortrait] = useState(false);
  const orientationPaused = portrait && !allowPortrait;
  // Keep the introduction in match state so a change of orientation preserves progress.
  const [intro, setIntro] = useState<IntroProgress | null>(() =>
    mode === 'guided' && !rulesOpen ? { step: 0, turnBeat: 0, rotated: false } : null);
  const introOpen = intro !== null;
  const introFinished = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (introOpen || !introFinished.current) return;
    introFinished.current = false;
    containerRef.current?.querySelector<HTMLElement>('[data-guide-target="market"]')?.focus({ preventScroll: true });
  }, [introOpen]);
  const motionLayerRef = useRef<HTMLDivElement>(null);
  const audio = useTrainingAudio(orientationPaused);
  const { capture, announcement, summary, history, presenting, finish } = useTrainingMotion(game, containerRef, motionLayerRef, `${directCards}-${tab}`, orientationPaused || rulesOpen || introOpen, audio.presentation, !lessonBonus);
  // One pulse per guided step, on whatever the player must touch next.
  const glowTarget = useGuideGlow(guide, session.selectedId, introOpen || orientationPaused || rulesOpen, presenting);
  const onAction = useCallback((action: TrainingAction) => { finish(); capture(); dispatch({ type: 'play', action }); }, [capture, finish]);
  useTrainingBot(game, onAction, orientationPaused || rulesOpen || introOpen || presenting);
  const playerTurn = game.currentPlayerIndex === 0;
  const isMyTurn = playerTurn && game.phase === 'action';
  const gameOver = game.phase === 'gameOver';
  const lastSoundTurn = useRef(game.turn);
  const resultSoundPlayed = useRef(false);
  useEffect(() => {
    if (orientationPaused || presenting) return;
    // Let presentation state settle before announcing a new turn/result.
    const timer = window.setTimeout(() => {
      if (gameOver && !resultSoundPlayed.current) {
        resultSoundPlayed.current = true;
        audio.presentation.play({ kind: game.winner === HUMAN_ID ? 'victory' : game.winner === BOT_ID ? 'defeat' : 'turn' });
      } else if (isMyTurn && game.turn !== lastSoundTurn.current) {
        lastSoundTurn.current = game.turn;
        audio.presentation.play({ kind: 'turn' });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gameOver, game.winner, game.turn, isMyTurn, presenting, orientationPaused, audio.presentation]);
  const paused = guide !== 'free';
  const endTurn = useCallback(() => {
    if (lessonBonus) {
      finish();
      capture();
      dispatch({ type: 'end-guided-turn' });
      return;
    }
    onAction({ type: 'END_TURN', payload: { playerId: HUMAN_ID } });
  }, [lessonBonus, finish, capture, onAction]);
  const remainingTime = useTurnTimer({ isMyTurn: isMyTurn && !paused, phase: game.phase === 'action' ? 'action' : null,
    turnDurationSeconds: 30, onTimerEnd: endTurn, gameTurn: game.turn, currentPlayerIndex: game.currentPlayerIndex, paused: orientationPaused || rulesOpen || introOpen || presenting || !!pending });
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
    if (presenting) return;
    if (guide === 'draw') setTab('market');
    if (guide === 'summon') setTab('hand');
  }, [guide, session.tutorialCompleted, presenting]);
  useEffect(() => {
    const target = guideGlowSequence(guide, session.selectedId).at(-1);
    if (!target || presenting) return;
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
  }, [guide, session.selectedId, orientationPaused, presenting]);
  const [player, bot] = game.players;
  const selected = player.hand.find(card => card.instanceId === session.selectedId);
  const actionsLeft = Math.max(0, game.actionsPerTurn - game.actionsTakenThisTurn);
  const clockPaused = paused || !!pending || rulesOpen || presenting;
  const clockRunning = isMyTurn && !clockPaused;
  const clockWarning = isMyTurn && !paused && remainingTime <= 10 ? remainingTime <= 5 ? 'red' : 'amber' : undefined;
  const clockText = `${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, '0')}`;
  let message = directCards ? 'Tap a Creature to rotate it, a Knowledge card in the Market to draw it, or a card in your hand to select it.' : 'Draw from the Market, rotate a Creature, or select a Knowledge card in your hand.';
  if (gameOver) message = 'The duel is over.';
  else if (pending && !lessonBonus) message = pending.playerId === HUMAN_ID ? 'Choose a target to resolve the card effect.' : 'The bot is resolving a card effect.';
  else if (!isMyTurn) message = 'The bot is thinking. Your next turn is coming.';
  else if (guide === 'welcome') message = 'Start the lesson whenever you are ready.';
  else if (guide === 'strike') message = 'Take a moment to look at the bot’s Power.';
  else if (guide === 'complete' || guide === 'handoff') message = 'Continue Practice starts the turn clock.';
  else if (paused) message = 'Follow the highlighted lesson action. Take your time.';
  else if (selected) message = `Play ${selected.name} on a highlighted Creature.`;
  if (orientationPaused) return <div className="wd wd-rotate-notice">
    <Smartphone size={64} strokeWidth={1.2} aria-hidden="true" />
    <p className="wd-eyebrow">Wisdom Duel · Landscape play</p>
    <h1>Turn your phone to play.</h1>
    <p>The board, your hand and the Market fit side by side in landscape.</p>
    <p role="status">Your match and clock are paused. Rotate your phone to continue.</p>
    <Link className="wd-button" to="/">Back to Home</Link>
    <button className="wd-button" onClick={() => setAllowPortrait(true)}>Can’t rotate? Continue in portrait</button>
  </div>;
  return <div ref={containerRef} onPointerDownCapture={audio.unlock} onKeyDownCapture={audio.unlock} className={`wd wd-match wd-confluence wd-kai ${paused && !gameOver ? 'has-guide' : ''} ${directCards ? 'wd-direct' : ''}`} data-active-side={gameOver ? undefined : playerTurn ? 'player' : 'opponent'}>
    <h1 className="sr-only">Wisdom Duel — Solo practice</h1>
    <div ref={motionLayerRef} className="wd-motion-layer" aria-hidden="true" inert />
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    <header className="wd-match-header" data-clock-warning={clockWarning}>
      {clockWarning && <span key={clockWarning} className="wd-clock-flare" aria-hidden="true" />}
      <Link to="/" className="wd-brand" aria-label="Wisdom Duel home"><img src="/logos/logo-header-dark.webp" alt="" width="44" height="34" /><span>Wisdom Duel</span></Link>
      <div className="wd-match-controls">
        {!gameOver && <div className={`wd-match-clock ${clockRunning && clockWarning === 'red' ? 'wd-clock-low' : ''}`} role="timer" aria-label="Turn clock">
          <Clock3 size={15} aria-hidden="true" />
          {clockPaused ? 'Clock paused' : clockRunning ? clockText : '—'}
        </div>}
        <button type="button" className="wd-button wd-match-rules" aria-label="Rules" onClick={openRules}><BookOpen size={17} aria-hidden="true" /><span>Rules</span></button>
        <TrainingSoundControls preferences={audio.preferences} update={audio.update} error={audio.error} play={audio.presentation.play} open={dialog === 'sound' && !pending && !inspection && (!gameOver || resultDismissed)} onOpen={() => setDialog('sound')} onClose={() => setDialog(null)} />
      </div>
    </header>
    {!gameOver && !introOpen && <TrainingCoach session={session} direct={directCards} lessonBonus={lessonBonus} glow={glowTarget} onStart={() => dispatch({ type: 'start-guide' })} onSkip={() => dispatch({ type: 'skip-guide' })} onShowBonus={() => dispatch({ type: 'show-bonus' })} onContinue={() => dispatch({ type: 'continue' })} />}
    <div className="wd-game-layout">
      <TrainingBoard direct={directCards} session={session} onAction={onAction} onInspect={setInspection} glow={glowTarget} hud={{
        opponent: <PowerMedallion power={bot.power} side="opponent" handSize={bot.hand.length} actions={!playerTurn ? { remaining: actionsLeft, total: game.actionsPerTurn } : undefined} />,
        turn: <div className="wd-turn"><span>Turn {game.turn}</span><strong key={`${game.turn}:${game.currentPlayerIndex}`} className={gameOver ? undefined : 'wd-turn-callout'}>{gameOver ? 'Duel complete' : playerTurn ? 'Your turn' : 'Bot’s turn'}</strong></div>,
        player: <PowerMedallion power={player.power} side="player" actions={playerTurn ? { remaining: actionsLeft, total: game.actionsPerTurn } : undefined} />,
      }} />
      <TrainingTrays direct={directCards} session={session} tab={tab} setTab={setTab} onAction={onAction} onSelect={instanceId => dispatch({ type: 'select', instanceId })} onInspect={setInspection} glow={glowTarget} />
    </div>
    <footer className="wd-actionbar">
      <div className="wd-action-context">{summary && <p className="wd-effect-summary" aria-label="Latest effects">{summary}</p>}<p className={session.rejected ? 'wd-error' : summary && !selected && !pending && !session.feedback ? 'wd-idle-hint' : ''} role={session.rejected ? 'alert' : 'status'}>{session.feedback || message}</p></div>
      <div className="wd-action-buttons">
        {selected && <button className="wd-icon-button" aria-label="Cancel card selection" onClick={() => dispatch({ type: 'select', instanceId: null })}><X size={18} /></button>}
        <button className="wd-discard-button" data-motion-anchor="discard" aria-label={`Discard pile, ${game.discardPile.length} ${game.discardPile.length === 1 ? 'card' : 'cards'}`} onClick={() => setDialog('discard')}><Layers size={17} /><span>{game.discardPile.length}</span><span className="wd-discard-label">Discards</span></button>
        <button className="wd-icon-button" aria-label="Game history" onClick={() => setDialog('history')}><History size={18} /></button>
        {!gameOver && <button className="wd-icon-button" aria-label="Concede match" onClick={() => setDialog('resign')}><Flag size={17} /></button>}
        {gameOver ? <button className="wd-button wd-button-primary" onClick={() => setResultDismissed(false)}>View Result</button> : <button className={`wd-button wd-button-primary ${guide === 'end' ? 'is-highlighted' : ''} ${glowTarget === 'end' ? 'wd-guide-glow' : ''}`} data-guide-target="end" disabled={!isMyTurn || (!!pending && !lessonBonus) || (paused && guide !== 'end')} onClick={endTurn}>End Turn <ArrowRight size={16} /></button>}
      </div>
    </footer>
    <div className="wd-match-links"><button className="wd-text-button" onClick={() => navigate('/bot-selection?mode=guided')}><RotateCcw size={14} />Repeat tutorial</button><span>Solo practice · No competitive rewards</span></div>
    <CardDetailOverlay card={inspection} open={!!inspection && !rulesOpen} onClose={closeInspection} contextLabel="Card details" />
    {intro && <TrainingIntro team={player} opponent={bot} market={game.market} direct={directCards}
      progress={intro} onProgress={setIntro} onFinish={() => { introFinished.current = true; setIntro(null); dispatch({ type: 'start-guide' }); }} />}
    {rulesOpen && <TrainingDialog title="Duel rules" onClose={resumeDuel}>
      <p>Turn {game.turn} · Duel paused</p>
      <ul className="wd-rules-list">
        <li>Each team’s three Creatures share 20 starting Power. Reduce your opponent’s Power to zero to win.</li>
        <li>During your Knowledge Phase, your Knowledge cards in play automatically resolve at their current rotation, then rotate one step. On final rotation, they resolve and leave play.</li>
        <li>In your Action Phase, draw from the Market, rotate a Creature, or play a Knowledge card from your hand. You normally get two actions, and card effects can change that number.</li>
        <li>Rotate a Creature to advance its Wisdom. You can play an Ally or a Spell on a Creature that meets its Wisdom requirement. It keeps its Wisdom.</li>
      </ul>
      <div className="wd-dialog-actions">
        <button type="button" className="wd-button wd-button-primary" onClick={resumeDuel}>Resume duel</button>
        <Link className="wd-button" to="/how-to-play" target="_blank" rel="noopener">Full rules (new tab)</Link>
      </div>
    </TrainingDialog>}
    {pending?.playerId === HUMAN_ID && !lessonBonus && !rulesOpen && !inspection && !presenting && <TrainingDialog showBoard title={pending.sourceKnowledgeName || 'Choose a target'}>
      <p>{pending.prompt}</p>
      <DuelTargetChoices view={game} board={containerRef} className="wd-effect-choices">{pending.choices.map((choice, index) => { const targetCard = getPendingEffectCard(game, choice); return <button key={index} data-choice-index={index} className="wd-effect-choice" onClick={() => onAction({ type: 'RESOLVE_PENDING_EFFECT', payload: { playerId: HUMAN_ID, resolution: { effectId: pending.id, choice } } })}>{directCards && targetCard ? <span className="wd-effect-art"><PlayCardFace card={targetCard} /></span> : choice.image && <CardFaceByImage src={choice.image} alt={choice.label} card={targetCard} className="mx-auto mb-2 w-[100px]" />}<span>{choice.label}</span></button>; })}</DuelTargetChoices>
      <div className="wd-dialog-actions">
        {pending.optional && <button className="wd-button" onClick={() => onAction({ type: 'RESOLVE_PENDING_EFFECT', payload: { playerId: HUMAN_ID, resolution: { effectId: pending.id, skip: true } } })}>Skip effect</button>}
        <button className="wd-button" onClick={openRules}>Rules</button>
      </div>
    </TrainingDialog>}
    {dialog === 'discard' && !pending && (!gameOver || resultDismissed) && <TrainingDialog title="Discard pile" onClose={() => setDialog(null)}><p>{game.discardPile.length ? `${game.discardPile.length} ${game.discardPile.length === 1 ? 'card' : 'cards'} · Most recent first` : 'Cards that leave play arrive here.'}</p><div className="wd-discard-grid">{[...game.discardPile].reverse().map(card => <button key={card.instanceId} className="wd-discard-card" aria-label={`Inspect discarded ${card.name}`} onClick={() => { setDialog(null); setInspection(card); }}><PlayCardFace card={card} /><span>{card.name}</span></button>)}</div></TrainingDialog>}
    {dialog === 'history' && !pending && (!gameOver || resultDismissed) && <TrainingDialog title="Game history" onClose={() => setDialog(null)}><ol className="wd-history">{history.map((entry, i) => <li key={i}>Turn {entry.turn}<ul>{entry.lines.map((line, j) => <li key={j}>{line}</li>)}</ul></li>)}</ol><details><summary>Game log</summary><ol className="wd-history">{game.log.map((entry, index) => <li key={index}>{formatGameHistoryEntry(entry, { [HUMAN_ID]: 'You', [BOT_ID]: 'Bot' })}</li>)}</ol></details></TrainingDialog>}
    {dialog === 'resign' && !pending && !gameOver && <TrainingDialog title="Concede this match?" onClose={() => setDialog(null)}><p>You can start another practice match at any time.</p><div className="wd-dialog-actions"><button className="wd-button" onClick={() => setDialog(null)}>Keep Playing</button><button className="wd-button wd-button-primary" onClick={() => { setDialog(null); dispatch({ type: 'resign' }); }}>Concede Match</button></div></TrainingDialog>}
    {gameOver && !rulesOpen && !resultDismissed && !inspection && !presenting && <TrainingDialog title={session.resigned ? 'Match conceded' : game.winner === HUMAN_ID ? 'Victory is yours.' : game.winner === BOT_ID ? 'The bot wins this duel.' : 'A draw between legends.'} onClose={() => setResultDismissed(true)}>
      <p className="wd-eyebrow">Practice complete · Turn {game.turn}</p><div className="wd-result-score"><span>You <strong>{Math.max(0, player.power)}</strong></span><span>Power</span><span>Bot <strong>{Math.max(0, bot.power)}</strong></span></div>
      <p>{game.winner === HUMAN_ID ? 'Your Creatures and Knowledge cards won the duel. Try another combination.' : 'Every duel is a chance to discover a new combination. Your next one starts here.'}</p>
      <div className="wd-dialog-actions"><button className="wd-button wd-button-primary" onClick={onReplay}><RotateCcw size={17} />Play Again</button><button className="wd-button" onClick={() => navigate('/bot-selection?mode=free')}>Choose Another Team</button></div><button className="wd-text-button" onClick={() => setResultDismissed(true)}>Review the board</button>
    </TrainingDialog>}
  </div>;
}

export default function BotGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = trainingModeFromSearch(location.search);
  const routeState = location.state as { selectedCreatures?: unknown; rulesFor?: string } | null;
  const matchKey = routeState?.rulesFor ?? location.key;
  const selected = routeState?.selectedCreatures;
  const team = mode === 'guided' ? GUIDED_TEAM : isValidBotCreatureSelection(selected) ? selected : readBotCreatureSelection();
  const valid = !!team && team.every(id => creatureData.some(card => card.id === id));
  const [prefix] = useState(() => `practice-${crypto.randomUUID()}`);
  useEffect(() => {
    if (!valid) { try { clearBotCreatureSelection(); } catch { /* Storage is optional. */ } navigate('/bot-selection?mode=free', { replace: true }); }
  }, [valid, navigate]);
  if (!team || !valid) return <div className="wd wd-loading" role="status">Choose three creatures to begin.</div>;
  return <PracticeMatch key={`${matchKey}-${mode}-${team.join('-')}`} team={team} mode={mode} gameId={`${prefix}-${matchKey}`}
    rulesOpen={!!routeState?.rulesFor}
    openRules={() => navigate({ pathname: location.pathname, search: location.search }, { state: { ...routeState, rulesFor: matchKey }, preventScrollReset: true })}
    resumeDuel={() => navigate(-1)} onReplay={() => {
    navigate('/bot-game?mode=free', { replace: true, state: { selectedCreatures: team } });
  }} />;
}
