import { useEffect, useState } from 'react';
import { OPEN_DUELS_PER_PAGE, openDuels, type OpenDuel } from '../../services/competitiveService.js';
import { ArenaButton, Panel } from '../ui/index.js';

export default function OpenDuels({ selected, signedIn, disabled, revision, onJoin }: {
  selected: string; signedIn: boolean; disabled: boolean; revision: number; onJoin: (code: string) => void;
}) {
  const [rooms, setRooms] = useState<OpenDuel[] | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<OpenDuel | null>(null);
  useEffect(() => {
    let live = true;
    let pending = false;
    const read = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const [next, target] = await Promise.all([openDuels(undefined, offset), selected ? openDuels(selected) : []]);
        if (live) { setRooms(next); setPicked(target[0] ?? null); setError(false); }
      } catch {
        if (live) setError(true);
      } finally { pending = false; }
    };
    void read();
    const timer = window.setInterval(() => void read(), 6000);
    document.addEventListener('visibilitychange', read);
    window.addEventListener('focus', read);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', read);
      window.removeEventListener('focus', read);
    };
  }, [refresh, revision, offset, selected]);

  const available = rooms?.slice(0, OPEN_DUELS_PER_PAGE).filter(room => Date.parse(room.expires_at) > Date.now());
  if (picked && picked.match_id === selected && Date.parse(picked.expires_at) > Date.now() && available && !available.some(room => room.match_id === selected)) available.unshift(picked);
  return <Panel className="space-y-4 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Open rooms</h2>
      <button type="button" className="min-h-11 text-cyan-200 underline" onClick={() => setRefresh(value => value + 1)}>Refresh rooms</button>
    </div>
    {error ? <p role="alert">Could not refresh the rooms. Try again.</p> : !available ? <p role="status">Loading open rooms…</p> : <>
      {selected && !available.some(room => room.match_id === selected) && <p role="status">The duel you selected is no longer open.</p>}
      {!available.length ? <p>{offset ? 'This page has no open rooms.' : 'No public duels are open. Create one to wait for an opponent.'}</p> :
        <ul className="divide-y divide-white/15">{available.map(room => {
          const label = 'Duel ' + room.match_id.slice(0, 8).toUpperCase();
          return <li key={room.match_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><strong>{label}</strong>{room.match_id === selected && <span className="ml-2 text-amber-200">Your selection</span>}
              <p className="text-sm text-slate-300">Open until <time dateTime={room.expires_at}>{new Date(room.expires_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></p>
            </div>
            <ArenaButton disabled={disabled} aria-label={`${signedIn ? 'Join' : 'Sign in to join'} ${label}`} onClick={() => onJoin(room.match_id)}>
              {signedIn ? 'Join duel' : 'Sign in to join'}
            </ArenaButton>
          </li>;
        })}</ul>}
      {(offset > 0 || (rooms && rooms.length > OPEN_DUELS_PER_PAGE)) && <div className="flex gap-3">
        <ArenaButton variant="ghost" disabled={!offset} onClick={() => { setRooms(null); setOffset(value => Math.max(0, value - OPEN_DUELS_PER_PAGE)); }}>Previous rooms</ArenaButton>
        <ArenaButton variant="ghost" disabled={!rooms || rooms.length <= OPEN_DUELS_PER_PAGE} onClick={() => { setRooms(null); setOffset(value => value + OPEN_DUELS_PER_PAGE); }}>More rooms</ArenaButton>
      </div>}
    </>}
  </Panel>;
}
