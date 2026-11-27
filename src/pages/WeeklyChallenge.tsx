import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CompetitiveQueue from '../components/CompetitiveQueue.js';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import { useAuth } from '../hooks/useAuth.js';
import {
  challengeStandings, competitiveError, localDate, type WisdomChallengeResponse,
} from '../services/competitiveService.js';

const PAGE_SIZE = 50;
const OUTCOMES = { win: 'Win', loss: 'Loss', draw: 'Draw' } as const;

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
      <h1 className="text-4xl font-bold">Weekly Challenge</h1>
      <Link className="text-cyan-200 underline" to="/watch">Watch live duels</Link>
      {error ? (
        <Panel className="space-y-3 p-5">
          <p role="alert" className="text-red-200">{error}</p>
          <ArenaButton variant="ghost" onClick={refresh}>Try again</ArenaButton>
        </Panel>
      ) : !data ? <p role="status">Loading the weekly challenge…</p> : null}
      {data && !data.periods.length ? <p>No editions have been published yet.</p> : null}
      {data && data.periods.length > 0 ? (
        <label className="block">
          Edition
          <select
            className="ml-3 rounded border border-white/20 bg-slate-900 p-3"
            value={period?.id ?? ''}
            onChange={(e) => selectPage(e.target.value)}
          >
            {!period ? <option value="" disabled>Edition unavailable</option> : null}
            {data.periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      ) : null}
      {period ? (
        <Panel className="space-y-3 p-6">
          <h2 className="text-2xl font-bold text-amber-200">{period.name}</h2>
          <p>{localDate(period.startsAt, 'en-GB')} — {localDate(period.endsAt, 'en-GB')} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p>
          <p>{period.admissionOpen ? `The queue is open until ${localDate(period.queueClosesAt, 'en-GB')}.` : 'The queue is closed.'}</p>
          <p>Both players get the same five creatures and secretly choose three. Entry is free with a permanent Play Hub account.</p>
          <p>Each turn lasts 30 seconds. When time runs out, the turn passes. Let two of your turns pass in a row without making a move and you lose the duel.</p>
          <p>You start each edition with an Elo rating of 1,500. Only duels that finish during the edition count, up to two per pair of opponents in 24 hours.</p>
          {!actor && !loading && period.admissionOpen ? (
            <Link className="text-cyan-200 underline" to="/#account">Sign in with a Play Hub account</Link>
          ) : null}
        </Panel>
      ) : null}
      {actor ? <CompetitiveQueue group={period?.admissionOpen ? { challengeId: period.id } : null} /> : null}
      {data && period ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Standings</h2>
            <ArenaButton variant="ghost" onClick={refresh}>Refresh results</ArenaButton>
          </div>
          {data.standings.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Standings for {period.name}</caption>
                <thead>
                  <tr className="border-b border-white/20">
                    {['Rank', 'Player', 'Elo', 'Duels'].map((label) =>
                      <th key={label} className="p-3" scope="col">{label}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.standings.slice(0, PAGE_SIZE).map((row, index) => (
                    <tr key={offset + index} className="border-b border-white/10">
                      <td className="p-3">{row.position}</td>
                      <th className="p-3" scope="row">{row.isMe ? 'You' : row.playerName}</th>
                      <td className="p-3">{Number(row.rating).toLocaleString('en-GB', { maximumFractionDigits: 6 })}</td>
                      <td className="p-3">{row.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>{offset ? 'No results on this page.' : 'No ranked duels yet.'}</p>}
          {offset || data.standings.length > PAGE_SIZE ? (
            <div className="flex gap-3">
              <ArenaButton variant="ghost" disabled={!offset} onClick={() => selectPage(period.id, Math.max(0, offset - PAGE_SIZE))}>Previous</ArenaButton>
              <ArenaButton variant="ghost" disabled={data.standings.length <= PAGE_SIZE} onClick={() => selectPage(period.id, offset + PAGE_SIZE)}>Next</ArenaButton>
            </div>
          ) : null}
          {actor && data.myResults.length ? (
            <Panel className="space-y-3 p-6">
              <h2 className="text-2xl font-bold">Your recent duels</h2>
              <ul className="space-y-2">
                {data.myResults.map((result) => (
                  <li key={result.matchId}>
                    {OUTCOMES[result.outcome]} · {localDate(result.finishedAt, 'en-GB')}
                    {!result.ranked ? ' · Unranked' : ''}{' '}
                    <Link to={`/replay/${result.matchId}`} className="text-cyan-200 underline">View replay</Link>
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
