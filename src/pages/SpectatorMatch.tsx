import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, Eye } from 'lucide-react';
import CardDetailOverlay from '../components/CardDetailOverlay.js';
import { DuelBoard } from '../components/training/TrainingBoard.js';
import TrainingCard from '../components/training/TrainingCard.js';
import { PageShell } from '../components/ui/index.js';
import { useSpectatorFeed } from '../hooks/useSpectatorFeed.js';
import { duelKindNames, readWatchedDuel, type PublicCard, type Seat, type SpectatorSide, type WatchedDuel } from '../services/spectatorService.js';
import { getDisplayCardById, type DisplayCard } from '../utils/cardCatalog.js';
import '../spectator.css';

const playerName = (seat: Seat) => `Player ${seat + 1}`;
const finished = (frame: WatchedDuel | null) => frame?.status === 'finished';
function visibleCard(card: PublicCard) {
  const base = getDisplayCardById(card.id);
  return base && { ...base, rotation: card.rotation, ...(card.wisdom === undefined ? {} : { currentWisdom: card.wisdom }) };
}
function boardSide(side: SpectatorSide, seat: Seat) {
  return {
    id: String(seat),
    creatures: side.creatures.flatMap(card => {
      const face = visibleCard(card);
      return face && 'passiveAbility' in face ? [face] : [];
    }),
    field: side.field.map(slot => {
      const face = slot.knowledge && visibleCard(slot.knowledge);
      return { creatureId: slot.creatureId, knowledge: face && 'cost' in face ? face : null };
    }),
  };
}
function turnLabel(frame: WatchedDuel): string {
  if (frame.outcome) return frame.outcome.winner === null ? 'Draw' : `${playerName(frame.outcome.winner)} wins`;
  if (frame.status === 'suspended') return 'Duel paused';
  if (frame.choosing && frame.clock.runningSeat !== null) return `${playerName(frame.clock.runningSeat)} is choosing`;
  return `${playerName(frame.currentSeat)}’s turn`;
}
function playLabel(event: WatchedDuel['events'][number]) {
  const who = event.seat === null ? '' : playerName(event.seat) + ' ';
  const card = event.creatureId ? getDisplayCardById(event.creatureId)?.name : undefined;
  switch (event.kind) {
    case 'initialize': return 'The duel started.';
    case 'rotate_creature': return who + 'rotated ' + (card ?? 'a Creature') + '.';
    case 'summon_knowledge': return who + 'played a Knowledge card' + (card ? ' on ' + card : '') + '.';
    case 'rotate_knowledge': return who + 'rotated a Knowledge card' + (card ? ' on ' + card : '') + '.';
    case 'draw_knowledge': return who + 'drew from the Market.';
    case 'resolve_pending_effect': return who + 'resolved a card effect.';
    case 'end_turn': return who + 'ended the turn.';
    case 'resign': return who + 'conceded.';
    case 'timeout': return 'A player ran out of time.';
    case 'suspend': return 'The duel was paused.';
    case 'resume': return 'The duel resumed.';
    default: return 'The board was updated.';
  }
}

function Scores({ frame }: { frame: WatchedDuel }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const received = performance.now();
    setElapsed(0);
    if (frame.clock.runningSeat === null) return;
    const timer = window.setInterval(() => setElapsed(performance.now() - received), 250);
    return () => clearInterval(timer);
  }, [frame.serverNow, frame.clock.runningSeat]);
  const atRead = Math.max(0, Date.parse(frame.serverNow) - Date.parse(frame.clock.updatedAt));
  return <div className="ws-scores">{([0,1] as const).map(seat => {
    const active = frame.clock.runningSeat === seat;
    const seconds = Math.ceil(Math.max(0, frame.clock.remainingMs[seat] - (active ? atRead + elapsed : 0)) / 1000);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return <section className="ws-seat" key={seat} data-active={active} aria-label={playerName(seat)}>
      <strong>{playerName(seat)}</strong><span className="ws-power" key={frame.players[seat].power}>{frame.players[seat].power} Power</span>
      <small>{frame.players[seat].handCount} in hand</small><span className="ws-clock" aria-label={`${playerName(seat)} clock ${time}`}><Clock3 size={14} aria-hidden />{time}</span>
    </section>;
  })}</div>;
}

function Board({ frame }: { frame: WatchedDuel }) {
  const [inspection, setInspection] = useState<DisplayCard | null>(null);
  const [tray, setTray] = useState<'market'|'discard'>('market');
  const close = useCallback(() => setInspection(null), []);
  const cards = tray === 'market' ? frame.market : frame.discard;
  const phase = frame.phase === 'knowledge' ? 'Knowledge phase' : frame.phase === 'action' ? 'Action phase' : null;
  return <>
    <header className="ws-heading"><h1>{duelKindNames[frame.kind]} <small>· {frame.matchId.slice(0,8).toUpperCase()}</small></h1>
      <span className="ws-live" data-status={frame.status}><Eye size={16} aria-hidden />{frame.status === 'playing' ? 'Live' : frame.status === 'suspended' ? 'Paused' : 'Finished'}</span></header>
    <Scores frame={frame} />
    <div className="ws-turn" aria-live="polite"><strong>{turnLabel(frame)}</strong><span>Turn {frame.turn}
      {frame.status === 'playing' && phase ? ` · ${phase}` : ''}
      {frame.status === 'playing' && frame.phase === 'action' ? ` · ${frame.actionsLeft}/${frame.actionsPerTurn} actions left` : ''}</span></div>
    <div className="ws-layout">
      <DuelBoard direct player={boardSide(frame.players[0],0)} opponent={boardSide(frame.players[1],1)}
        opponentLabel="Player 2’s Creatures" guidance="Player 1’s Creatures" onInspect={setInspection}/>
      <aside className="ws-sidebar">
        <section aria-label="Public cards"><div className="ws-trays">
          <button type="button" aria-pressed={tray === 'market'} onClick={() => setTray('market')}>Market</button>
          <button type="button" aria-pressed={tray === 'discard'} onClick={() => setTray('discard')}>Discard pile ({frame.discard.length})</button>
        </div>
          <div className="ws-cards">{cards.map((card,index) => {
            const face = visibleCard(card);
            return face ? <TrainingCard key={`${index}-${card.id}`} card={face} playFace onInspect={setInspection} /> : null;
          })}</div>
          {!cards.length && <p>{tray === 'market' ? 'The Market is empty.' : 'No discarded cards yet.'}</p>}
          {tray === 'market' && <p>{frame.deckCount} cards in the deck</p>}
        </section>
        <section aria-label="Latest plays"><h2>Latest plays</h2>
          {frame.events.length ? <ol>{frame.events.map(event => <li key={event.sequence}>{playLabel(event)}</li>)}</ol> : <p>The duel has just started.</p>}
        </section>
      </aside>
    </div>
    <CardDetailOverlay card={inspection} open={inspection !== null} onClose={close} contextLabel="Card details"/>
  </>;
}

function Watch({ matchId }: { matchId: string }) {
  const latest = useRef<WatchedDuel | null>(null);
  const read = useCallback(async () => {
    const frame = await readWatchedDuel(matchId);
    if (frame && latest.current && frame.version < latest.current.version) return latest.current;
    latest.current = frame;
    return frame;
  }, [matchId]);
  const { data, error, refresh } = useSpectatorFeed('wisdom-watch:' + matchId, read, finished);
  return <section className="wd ws-watch" aria-label="Spectator view">
    <Link className="ws-back" to="/watch"><ArrowLeft size={16} aria-hidden /> Live duels</Link>
    {error && <div role="alert">The live board could not refresh. <button className="ws-retry" onClick={refresh}>Reconnect</button></div>}
    {data === undefined && !error && <p role="status">Connecting to the live board…</p>}
    {data === null && <p role="status">This duel is no longer live or has not started yet.</p>}
    {data && <Board frame={data}/>}
  </section>;
}

export default function SpectatorMatch() {
  const { matchId = '' } = useParams();
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(matchId)) {
    return <PageShell><h1 className="text-2xl">Duel unavailable</h1><Link to="/watch" className="text-cyan-200 underline">View live duels</Link></PageShell>;
  }
  return <Watch key={matchId} matchId={matchId}/>;
}
