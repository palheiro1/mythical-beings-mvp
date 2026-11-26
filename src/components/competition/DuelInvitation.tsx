import { useRef, useState } from 'react';
import { duelLobbyPath } from '../../game/duelInvitation.js';
import { ArenaButton } from '../ui/index.js';

export default function DuelInvitation({ matchId }: { matchId: string }) {
  const url = new URL(duelLobbyPath(matchId), window.location.origin).href;
  const [notice, setNotice] = useState('');
  const field = useRef<HTMLInputElement>(null);
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
    <h2 className="text-2xl font-bold">Invite your opponent</h2>
    <p>Send this link to the friend you want to play.</p>
    <label className="block">Invitation link
      <input ref={field} className="mt-2 w-full rounded border border-white/20 bg-slate-950 p-3" value={url} readOnly onFocus={event => event.target.select()} />
    </label>
    <div className="flex flex-wrap gap-3">
      <ArenaButton onClick={() => void copy()}>Copy invitation</ArenaButton>
      {typeof navigator.share === 'function' && <ArenaButton variant="ghost" onClick={() => void share()}>Share invitation</ArenaButton>}
    </div>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
