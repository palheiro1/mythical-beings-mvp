import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import { useSpectatorFeed } from '../hooks/useSpectatorFeed.js';
import { duelKindNames, listLiveDuels, LIVE_PAGE_SIZE } from '../services/spectatorService.js';

export default function LiveDuels() {
  const [offset, setOffset] = useState(0);
  const read = useCallback(() => listLiveDuels(offset), [offset]);
  const { data, error, refresh } = useSpectatorFeed('wisdom-live-duels', read, undefined, String(offset));
  return <PageShell contentClassName="max-w-3xl space-y-5">
    <h1 className="text-4xl font-bold">Watch live</h1>
    <p>Watch any player duel once both teams are ready. You can follow the board without a Play Hub account.</p>
    <Panel className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Duels in progress</h2>
        <button type="button" className="min-h-11 text-cyan-200 underline" onClick={refresh}>Refresh duels</button></div>
      {error && <p role="alert">The live list could not refresh. Reconnecting…</p>}
      {!data && !error && <p role="status">Loading live duels…</p>}
      {data && !data.length && <p>{offset ? 'This page has no live duels.' : 'No duels are live right now.'}</p>}
      {data && data.length > 0 && <ul className="divide-y divide-white/15">{data.slice(0, LIVE_PAGE_SIZE).map(duel =>
        <li key={duel.match_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><strong>{duelKindNames[duel.kind]} · {duel.match_id.slice(0,8).toUpperCase()}</strong>
            <p className="text-sm text-slate-300">{duel.paused ? 'Paused' : 'Live'} · Turn {duel.turn_number}</p></div>
          <Link className="duel-lobby-link" aria-label={`Watch duel ${duel.match_id.slice(0,8).toUpperCase()}`} to={`/watch/${duel.match_id}`}>Watch duel</Link>
        </li>)}</ul>}
      {data && (offset > 0 || data.length > LIVE_PAGE_SIZE) && <div className="flex gap-3">
        <ArenaButton variant="ghost" disabled={!offset} onClick={() => setOffset(n => Math.max(0, n-LIVE_PAGE_SIZE))}>Previous duels</ArenaButton>
        <ArenaButton variant="ghost" disabled={data.length <= LIVE_PAGE_SIZE} onClick={() => setOffset(n => n+LIVE_PAGE_SIZE)}>More duels</ArenaButton>
      </div>}
    </Panel>
    <Link className="text-cyan-200 underline" to="/duels/public">Play a public duel</Link>
  </PageShell>;
}
