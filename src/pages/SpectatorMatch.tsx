import { useCallback, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChallengeArena from '../components/competition/ChallengeArena.js';
import type { ArenaProjection } from '../utils/trainingMotion.js';
import { PageShell } from '../components/ui/index.js';
import { useSpectatorFeed } from '../hooks/useSpectatorFeed.js';
import { readWatchedDuel, type PublicCard, type Seat, type SpectatorSide, type WatchedDuel } from '../services/spectatorService.js';
import { getDisplayCardById } from '../utils/cardCatalog.js';

const playerName = (seat: Seat) => `Player ${seat + 1}`;
const finished = (frame: WatchedDuel | null) => frame?.status === 'finished';
function visibleCard(card: PublicCard) {
  const base = getDisplayCardById(card.id);
  return base && { ...base, rotation: card.rotation, ...(card.wisdom === undefined ? {} : { currentWisdom: card.wisdom }) };
}
function boardSide(side: SpectatorSide, seat: Seat) {
  return {
    id: String(seat), power: side.power, hand: { visibility: 'hidden' as const, count: side.handCount },
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
    case 'turn_timeout': return who + 'ran out of turn time.';
    case 'end_turn': return who + 'ended the turn.';
    case 'resign': return who + 'conceded.';
    case 'timeout': return 'A player ran out of time.';
    case 'suspend': return 'The duel was paused.';
    case 'resume': return 'The duel resumed.';
    default: return 'The board was updated.';
  }
}

function spectatorBoard(frame: WatchedDuel): ArenaProjection {
  const pile = (cards: PublicCard[], zone: string) => cards.flatMap((card, index) => {
    const face = visibleCard(card);
    return face && 'cost' in face ? [{ ...face, instanceId: zone + '-' + index }] : [];
  });
  const reason = frame.outcome?.reason;
  return {
    matchId: frame.matchId, mode: frame.kind === 'weekly' ? 'casual' : frame.kind, stateVersion: frame.version,
    players: [boardSide(frame.players[0], 0), boardSide(frame.players[1], 1)], market: pile(frame.market, 'market'),
    discardPile: pile(frame.discard, 'discard'), deckCount: frame.deckCount, pendingEffect: null,
    currentPlayerId: String(frame.currentSeat), decisionPlayerId: frame.clock.runningSeat === null ? null : String(frame.clock.runningSeat),
    serverNow: frame.serverNow, turn: frame.turn, phase: frame.status === 'finished' ? 'gameOver' : frame.phase === 'knowledge' ? 'knowledge' : 'action',
    actionsPerTurn: frame.actionsPerTurn, actionsTakenThisTurn: frame.actionsPerTurn - frame.actionsLeft,
    clock: { updatedAt: frame.clock.updatedAt, turnMs: frame.clock.turnMs ?? undefined,
      runningPlayerId: frame.clock.runningSeat === null ? null : String(frame.clock.runningSeat),
      suspendedAt: frame.status === 'suspended' ? frame.clock.updatedAt : null,
      remainingMs: { 0: frame.clock.remainingMs[0], 1: frame.clock.remainingMs[1] } },
    outcome: frame.outcome && { reason: reason === 'resign' || reason === 'timeout' || reason === 'draw' ? reason : 'power',
      winnerId: frame.outcome.winner === null ? null : String(frame.outcome.winner), finishedAt: frame.serverNow },
    events: [...frame.events].reverse().flatMap(event => {
      if (!event.cues?.length || event.kind === 'initialize') return [];
      return [{ sequence: event.sequence, actorId: event.seat === null ? null : String(event.seat), at: frame.serverNow,
        type: event.kind, cues: event.cues }];
    }),
  };
}

function Board({ frame }: { frame: WatchedDuel }) {
  const projection = useMemo(() => spectatorBoard(frame), [frame]);
  return <ChallengeArena projection={projection} lobbyPath="/watch" casualDuel={frame.kind === 'casual'}
    observer={{ turnLabel: turnLabel(frame), latest: frame.events[0] ? playLabel(frame.events[0]) : 'Watching live',
      history: <ol className="wd-history">{frame.events.map(event => <li key={event.sequence}>{playLabel(event)}</li>)}</ol> }} />;
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
  if (data) return <>{error && <div role="alert">Reconnecting to the live board…</div>}<Board frame={data} /></>;
  return <PageShell><Link className="text-cyan-200 underline" to="/watch">Live duels</Link>
    {error ? <div role="alert">The live board could not refresh. <button onClick={refresh}>Reconnect</button></div> :
      <p role="status">{data === null ? 'This duel is no longer live or has not started yet.' : 'Connecting to the live board…'}</p>}
  </PageShell>;
}

export default function SpectatorMatch() {
  const { matchId = '' } = useParams();
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(matchId)) {
    return <PageShell><h1 className="text-2xl">Duel unavailable</h1><Link to="/watch" className="text-cyan-200 underline">View live duels</Link></PageShell>;
  }
  return <Watch key={matchId} matchId={matchId}/>;
}
