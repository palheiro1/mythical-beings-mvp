import type { PublicMatchEvent } from '@mythicalb/wisdom-duel-engine';
import { describeMotion } from '../../utils/trainingMotion.js';
import { formatMatchEvent } from '../../utils/gameHistory.js';

export default function DuelEffectHistory({ events, viewer }: { events: PublicMatchEvent[]; viewer: string }) {
  return (
    <ol className="wd-history">
      {events.map((event) => (
        <li key={event.sequence}>
          {event.sequence}. {event.actorId === viewer ? 'You' : event.actorId ? 'Opponent' : 'Match'} ·{' '}
          {formatMatchEvent(event.type)}
          {event.cues?.length ? (
            <ul>
              {event.cues.map((cue, i) => (
                <li key={i}>{describeMotion(cue, viewer)}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
