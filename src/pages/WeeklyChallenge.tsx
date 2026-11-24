import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CompetitiveQueue from '../components/CompetitiveQueue.js';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import { useAuth } from '../hooks/useAuth.js';
import {
  challengeStandings, competitiveError, localDate, type WisdomChallengeResponse,
} from '../services/competitiveService.js';

const PAGE_SIZE = 50;
const OUTCOMES = { win: 'Vitória', loss: 'Derrota', draw: 'Empate' } as const;

export default function WeeklyChallenge() {
  const [params, setParams] = useSearchParams();
  const { user, loading } = useAuth();
  const actor = user && !user.isGuest ? user.id : null;
  const requested = params.get('period') ?? undefined;
  const offsetParam = Number(params.get('offset'));
  const offset = Number.isSafeInteger(offsetParam) && offsetParam > 0 && offsetParam <= 1000000 ? offsetParam : 0;
  const key = JSON.stringify([requested, offset, actor]);
  const [snapshot, setSnapshot] = useState<{ key: string; data: WisdomChallengeResponse } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const data = snapshot?.key === key ? snapshot.data : null;
  const period = data?.periods.find((p) => p.id === data.periodId);
  const queueOpensAt = period?.startsAt;
  const queueClosesAt = period?.queueClosesAt;

  useEffect(() => {
    let live = true;
    setError('');
    void challengeStandings(requested, offset)
      .then((next) => {
        if (live) setSnapshot({ key, data: next });
      })
      .catch((e) => {
        if (live) setError(competitiveError(e));
      });
    return () => { live = false; };
  }, [key, requested, offset, revision]);

  useEffect(() => {
    const now = Date.now();
    const next = [queueOpensAt, queueClosesAt]
      .map((date) => date ? Date.parse(date) : 0)
      .filter((time) => time > now)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const timer = window.setTimeout(() => setRevision((value) => value + 1), Math.min(next - now + 1000, 2147483647));
    return () => window.clearTimeout(timer);
  }, [queueOpensAt, queueClosesAt, revision]);

  const refresh = () => setRevision((value) => value + 1);
  const selectPage = (id: string, from = 0) =>
    setParams(from ? { period: id, offset: String(from) } : { period: id });

  return (
    <PageShell contentClassName="max-w-4xl space-y-6">
      <Link className="text-cyan-200" to="/">← Wisdom Duel</Link>
      <h1 className="text-4xl font-bold">Repto semanal</h1>
      {error ? (
        <Panel className="space-y-3 p-5">
          <p role="alert" className="text-red-200">{error}</p>
          <ArenaButton variant="ghost" onClick={refresh}>Tentar novamente</ArenaButton>
        </Panel>
      ) : !data ? <p role="status">A carregar o repto…</p> : null}
      {data && !data.periods.length ? <p>Ainda não há edições publicadas.</p> : null}
      {data && data.periods.length > 0 ? (
        <label className="block">
          Edição
          <select
            className="ml-3 rounded border border-white/20 bg-slate-900 p-3"
            value={period?.id ?? ''}
            onChange={(e) => selectPage(e.target.value)}
          >
            {!period ? <option value="" disabled>Edição indisponível</option> : null}
            {data.periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      ) : null}
      {period ? (
        <Panel className="space-y-3 p-6">
          <h2 className="text-2xl font-bold text-amber-200">{period.name}</h2>
          <p>{localDate(period.startsAt)} — {localDate(period.endsAt)} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p>
          <p>{period.admissionOpen ? `Fila aberta até ${localDate(period.queueClosesAt)}.` : 'A fila está fechada.'}</p>
          <p>Ambos recebem as mesmas cinco criaturas e escolhem três em segredo. A entrada é gratuita com uma conta Play Hub.</p>
          <p>Cada jogador tem dez minutos acumulados para decidir. Quem esgotar o relógio perde a partida.</p>
          <p>Só contam as partidas que terminam durante a edição, até duas por par de adversários em 24 horas. Cada edição começa com Elo 1500.</p>
          {!actor && !loading && period.admissionOpen ? (
            <Link className="text-cyan-200 underline" to="/#account">Entrar com uma conta Play Hub</Link>
          ) : null}
        </Panel>
      ) : null}
      {actor ? <CompetitiveQueue group={period?.admissionOpen ? { challengeId: period.id } : null} /> : null}
      {data && period ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Classificação</h2>
            <ArenaButton variant="ghost" onClick={refresh}>Atualizar resultados</ArenaButton>
          </div>
          {data.standings.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Classificação da edição {period.name}</caption>
                <thead>
                  <tr className="border-b border-white/20">
                    {['Posição', 'Jogador', 'Elo', 'Partidas'].map((label) =>
                      <th key={label} className="p-3" scope="col">{label}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.standings.slice(0, PAGE_SIZE).map((row, index) => (
                    <tr key={offset + index} className="border-b border-white/10">
                      <td className="p-3">{row.position}</td>
                      <th className="p-3" scope="row">{row.isMe ? 'Tu' : row.playerName}</th>
                      <td className="p-3">{Number(row.rating).toLocaleString('pt-PT', { maximumFractionDigits: 6 })}</td>
                      <td className="p-3">{row.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>{offset ? 'Esta página está vazia.' : 'Ainda não há partidas a contar para a classificação.'}</p>}
          {offset || data.standings.length > PAGE_SIZE ? (
            <div className="flex gap-3">
              <ArenaButton variant="ghost" disabled={!offset} onClick={() => selectPage(period.id, Math.max(0, offset - PAGE_SIZE))}>Anterior</ArenaButton>
              <ArenaButton variant="ghost" disabled={data.standings.length <= PAGE_SIZE} onClick={() => selectPage(period.id, offset + PAGE_SIZE)}>Seguinte</ArenaButton>
            </div>
          ) : null}
          {actor && data.myResults.length ? (
            <Panel className="space-y-3 p-6">
              <h2 className="text-2xl font-bold">As tuas partidas recentes</h2>
              <ul className="space-y-2">
                {data.myResults.map((result) => (
                  <li key={result.matchId}>
                    {OUTCOMES[result.outcome]} · {localDate(result.finishedAt)}
                    {!result.ranked ? ' · Fora da classificação' : ''}{' '}
                    <Link to={`/replay/${result.matchId}`} className="text-cyan-200 underline">Ver repetição</Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
