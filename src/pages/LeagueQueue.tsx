import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import {
  competitive,
  competitiveError,
  localDate,
  type WisdomQueueState,
  type WisdomSeason,
} from '../services/competitiveService.js';

export default function LeagueQueue() {
  const [season, setSeason] = useState<WisdomSeason | null>(null),
    [queue, setQueue] = useState<WisdomQueueState | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const apply = useCallback(
    (next: WisdomQueueState) => {
      setQueue(next);
      if (next.match && next.match.status !== 'confirming') navigate(`/duel/${next.match.matchId}`);
    },
    [navigate],
  );
  useEffect(() => {
    let live = true;
    void Promise.all([competitive.league(), competitive.queue('queue_status')])
      .then(([league, status]) => {
        if (live) {
          setSeason(league.seasons.find((s) => s.status === 'active') ?? null);
          apply(status);
        }
      })
      .catch((e) => {
        if (live) setError(competitiveError(e));
      });
    const poll = setInterval(
      () =>
        void competitive
          .queue('queue_status')
          .then((s) => {
            if (live) apply(s);
          })
          .catch((e) => {
            if (live) setError(competitiveError(e));
          }),
      3000,
    );
    return () => {
      live = false;
      clearInterval(poll);
    };
  }, [apply]);
  const queued = Boolean(queue?.ticket);
  useEffect(() => {
    if (!queued) return;
    const heartbeat = setInterval(
      () =>
        void competitive
          .queue('queue_heartbeat')
          .then(apply)
          .catch((e) => setError(competitiveError(e))),
      15000,
    );
    return () => clearInterval(heartbeat);
  }, [queued, apply]);
  const act = async (action: 'queue_enter' | 'queue_leave' | 'queue_accept') => {
    setBusy(true);
    setError('');
    try {
      apply(
        await competitive.queue(
          action,
          action === 'queue_enter'
            ? { seasonId: season?.id }
            : action === 'queue_accept'
              ? { matchId: queue?.match?.matchId }
              : {},
        ),
      );
    } catch (e) {
      setError(competitiveError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageShell contentClassName="max-w-3xl space-y-6">
      <Link to="/competition" className="text-cyan-200">
        ← Modos de jogo
      </Link>
      <h1 className="text-4xl font-bold">Jogar na liga</h1>
      <p>
        Os dois jogadores recebem as mesmas cinco criaturas e escolhem três em segredo. Tens dez minutos para
        todas as tuas decisões.
      </p>
      {season ? (
        <p>
          <strong>{season.name}</strong> · termina {localDate(season.endsAt)}
        </p>
      ) : (
        <p>Ainda não há uma temporada aberta. O financiamento tem de estar confirmado antes da abertura.</p>
      )}
      <Panel className="space-y-4 p-6">
        <p aria-live="polite">{queue?.searchingCount ?? 0} pessoas à procura de partida.</p>
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
            <p>A procurar desde {localDate(queue.ticket.joinedAt)}. A pesquisa alarga-se com o tempo.</p>
            <ArenaButton variant="ghost" loading={busy} onClick={() => void act('queue_leave')}>
              Cancelar procura
            </ArenaButton>
          </>
        ) : (
          <ArenaButton
            loading={busy}
            disabled={!season || Boolean(queue?.cooldownUntil)}
            onClick={() => void act('queue_enter')}
          >
            Procurar adversário
          </ArenaButton>
        )}
        {queue?.cooldownUntil ? <p>Nova entrada disponível às {localDate(queue.cooldownUntil)}.</p> : null}
        {error ? (
          <p role="alert" className="text-red-200">
            {error}
          </p>
        ) : null}
      </Panel>
      <p className="text-sm text-slate-300">
        Só duas partidas contra o mesmo adversário contam em 24 horas.{' '}
        <Link className="text-cyan-200 underline" to="/wagers?mode=casual">
          Criar um encontro casual
        </Link>
        .
      </p>
      <Link className="text-cyan-200 underline" to="/standings">
        Ver classificação e critérios dos prémios
      </Link>
    </PageShell>
  );
}
