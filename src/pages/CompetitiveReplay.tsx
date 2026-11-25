import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  advanceMatch,
  projectMatch,
  resumeMatch,
  suspendMatch,
  type CompetitiveSnapshot,
} from '@mythicalb/wisdom-duel-engine';
import { useAuth } from '../hooks/useAuth.js';
import { competitive, competitiveError } from '../services/competitiveService.js';
import { PageShell, Panel } from '../components/ui/index.js';
import CardFaceByImage from '../components/CardFaceByImage.js';

export default function CompetitiveReplay() {
  const { matchId = '' } = useParams(),
    { user } = useAuth();
  const [frames, setFrames] = useState<CompetitiveSnapshot[]>([]),
    [index, setIndex] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        let page = await competitive.replay(matchId),
          current = page.initial as CompetitiveSnapshot;
        if (!current) throw new Error('The initial replay state is unavailable.');
        const snapshots = [current];
        let cursor = 0;
        for (;;) {
          for (const event of page.events) {
            current =
              event.event_type === 'suspend'
                ? suspendMatch(current, event.occurred_at)
                : event.event_type === 'resume'
                  ? resumeMatch(current, event.occurred_at)
                  : advanceMatch(current, event.actor_id, event.envelope, event.occurred_at);
            if (current.version !== event.sequence)
              throw new Error('The replay sequence does not match the recorded events.');
            snapshots.push(current);
            cursor = event.sequence;
          }
          if (cursor >= page.version) break;
          if (!page.events.length) throw new Error('Some replay events are missing.');
          page = await competitive.replay(matchId, cursor);
        }
        if (live) {
          setFrames(snapshots);
          setIndex(0);
        }
      } catch (e) {
        if (live) setError(competitiveError(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [matchId]);
  const frame = frames[index],
    projection =
      frame && user
        ? projectMatch(
            frame,
            frame.state.players.some((p) => p.id === user.id) ? user.id : frame.state.players[0].id,
            frame.clock.updatedAt,
          )
        : null;
  return (
    <PageShell contentClassName="space-y-6">
      <Link className="text-cyan-200" to={`/duel/${matchId}`}>
        ← Back to result
      </Link>
      <h1 className="text-4xl font-bold">Full replay</h1>
      <p>This replay uses the original game engine version and the events recorded during the duel.</p>
      {frames.length ? (
        <label className="block">
          Event {index} of {frames.length - 1}
          <input
            aria-label="Replay event"
            className="mt-3 w-full"
            type="range"
            min="0"
            max={frames.length - 1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
          />
        </label>
      ) : (
        <p>Loading replay events…</p>
      )}
      {projection?.players.map((player) => (
        <Panel className="space-y-3 p-5" key={player.id}>
          <h2 className="text-2xl font-bold">
            {player.id === user?.id ? 'You' : 'Opponent'} · {player.power} Power
          </h2>
          <div className="flex gap-4 overflow-x-auto">
            {player.creatures.map((c) => (
              <div className="w-36 shrink-0 space-y-2" key={c.id}>
                <CardFaceByImage card={c} src={c.image} alt={c.name} />
                {player.field.find((f) => f.creatureId === c.id)?.knowledge ? (
                  <CardFaceByImage
                    card={player.field.find((f) => f.creatureId === c.id)!.knowledge!}
                    src={player.field.find((f) => f.creatureId === c.id)!.knowledge!.image}
                    alt="Knowledge card in play"
                  />
                ) : null}
              </div>
            ))}
          </div>
          <p>Cards in hand · {player.hand.count}</p>
        </Panel>
      ))}
      {frame ? (
        <p>
          Turn {frame.state.turn} · {frame.events[frame.events.length - 1]?.type ?? 'Start'}
          {frame.outcome ? ` · ${frame.outcome.reason}` : ''}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      ) : null}
    </PageShell>
  );
}
