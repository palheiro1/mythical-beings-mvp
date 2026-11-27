import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { duelLobbyPath } from '../../game/duelInvitation.js';
import { openDuels, publishDuel } from '../../services/competitiveService.js';
import { ArenaButton } from '../ui/index.js';

export default function DuelInvitation({ matchId, retryListing = false }: { matchId: string; retryListing?: boolean }) {
  const url = new URL(duelLobbyPath(matchId), window.location.origin).href;
  const [notice, setNotice] = useState('');
  const [listed, setListed] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [listingError, setListingError] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    setListed(null);
    setListingError('');
    void openDuels(matchId).then(rooms => {
      if (live) setListed(rooms.some(room => room.match_id === matchId));
    }).catch(() => {
      if (live) setListingError('Could not check whether this duel is listed.');
    });
    return () => { live = false; };
  }, [matchId]);

  async function publish() {
    setPublishing(true);
    setListingError('');
    try {
      await publishDuel(matchId);
      setListed(true);
    } catch {
      setListingError('Could not list this duel. Check that the room is still open and try again.');
    } finally { setPublishing(false); }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Invitation link copied.');
    } catch {
      field.current?.select();
      setNotice('Select and copy the invitation link above.');
    }
  }
  async function share() {
    try {
      await navigator.share({ title: 'Wisdom Duel', text: 'Join me for a duel!', url });
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) await copy();
    }
  }
  return <div className="space-y-3">
    <h2 className="text-2xl font-bold">{listed ? 'Waiting for a public opponent' : 'Invite your opponent'}</h2>
    {listed ? <p role="status">Your room is listed in <Link to="/duels/public" className="text-cyan-200 underline">Public duels</Link>. The first player to join takes the open seat.</p>
      : <p>Send this link to the friend you want to play.</p>}
    {listingError && <p role="alert" className="text-red-200">{listingError}</p>}
    {retryListing && listed === false && !listingError && <p role="alert">Your room was created. List it publicly to let other players find it.</p>}
    <label className="block">Invitation link
      <input ref={field} className="mt-2 w-full rounded border border-white/20 bg-slate-950 p-3" value={url} readOnly onFocus={event => event.target.select()} />
    </label>
    <div className="flex flex-wrap gap-3">
      <ArenaButton onClick={() => void copy()}>Copy invitation</ArenaButton>
      {typeof navigator.share === 'function' && <ArenaButton variant="ghost" onClick={() => void share()}>Share invitation</ArenaButton>}
      {listed !== true && <ArenaButton variant="ghost" loading={publishing} disabled={listed === null && !listingError} onClick={() => void publish()}>List this duel publicly</ArenaButton>}
    </div>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
