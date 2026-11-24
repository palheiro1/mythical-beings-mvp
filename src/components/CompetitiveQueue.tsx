import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArenaButton, Panel } from './ui/index.js';
import { competitive, competitiveError, localDate, type WisdomQueueState } from '../services/competitiveService.js';

type QueueGroup = { seasonId: string } | { challengeId: string };
type QueueAction = 'queue_enter' | 'queue_leave' | 'queue_accept';

export default function CompetitiveQueue({ group }: { group: QueueGroup | null }) {
  const [queue, setQueue] = useState<WisdomQueueState | null>(null);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const generation = useRef(0);
  const navigate = useNavigate();

  const apply = useCallback(
    (next: WisdomQueueState) => {
      setQueue(next);
      if (next.match && next.match.status !== 'confirming') navigate(`/duel/${next.match.matchId}`);
    },
    [navigate],
  );

  const queued = Boolean(queue?.ticket);
  useEffect(() => {
    let live = true;
    let pending = false;
    const read = async (action: 'queue_status' | 'queue_heartbeat') => {
      if (mutation.current || pending) return;
      const current = generation.current;
      pending = true;
      try {
        const next = await competitive.queue(action);
        if (live && current === generation.current) {
          apply(next);
          setConnectionError('');
        }
      } catch (e) {
        if (live && current === generation.current) setConnectionError(competitiveError(e));
      } finally {
        pending = false;
      }
    };

    void read('queue_status');
    const poll = setInterval(() => void read('queue_status'), 3000);
    const heartbeat = queued ? setInterval(() => void read('queue_heartbeat'), 14000) : undefined;
    return () => {
      live = false;
      clearInterval(poll);
      clearInterval(heartbeat);
    };
  }, [apply, queued]);

  const act = async (action: QueueAction) => {
    if (mutation.current || (action === 'queue_enter' && !group)) return;
    mutation.current = true;
    generation.current += 1;
    setBusy(true);
    setError('');
    try {
      const params =
        action === 'queue_enter'
          ? (group ?? {})
          : action === 'queue_accept'
            ? { matchId: queue?.match?.matchId }
            : {};
      apply(await competitive.queue(action, params));
      setConnectionError('');
    } catch (e) {
      setError(competitiveError(e));
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  };

  return (
    <Panel className="space-y-4 p-6">
      {queue?.match ? (
        <div role="status" className="space-y-3">
          <h2 className="text-2xl text-amber-200">Adversário encontrado</h2>
          <p>Confirma até {localDate(queue.match.deadline)}.</p>
          <ArenaButton
            loading={busy}
            disabled={queue.match.accepted}
            onClick={() => void act('queue_accept')}
          >
            {queue.match.accepted ? 'À espera do adversário' : 'Aceitar partida'}
          </ArenaButton>
        </div>
      ) : queue?.ticket ? (
        <>
          <p aria-live="polite">{queue.searchingCount} pessoas à procura de partida.</p>
          <p>A procurar desde {localDate(queue.ticket.joinedAt)}. A pesquisa alarga-se com o tempo.</p>
          <ArenaButton variant="ghost" loading={busy} onClick={() => void act('queue_leave')}>
            Cancelar procura
          </ArenaButton>
        </>
      ) : (
        <ArenaButton
          loading={busy}
          disabled={!group || !queue || Boolean(queue.cooldownUntil)}
          onClick={() => void act('queue_enter')}
        >
          Procurar adversário
        </ArenaButton>
      )}
      {queue?.cooldownUntil ? <p>Nova entrada disponível às {localDate(queue.cooldownUntil)}.</p> : null}
      {error || connectionError ? <p role="alert" className="text-red-200">{error || connectionError}</p> : null}
    </Panel>
  );
}
