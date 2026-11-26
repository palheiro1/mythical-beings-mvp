import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import OpenDuels from '../components/competition/OpenDuels.js';
import { ArenaButton, Input, PageShell, Panel } from '../components/ui/index.js';
import { duelAccountPath, invitationCode } from '../game/duelInvitation.js';
import { useAuth } from '../hooks/useAuth.js';
import { competitive, competitiveError, publishDuel } from '../services/competitiveService.js';

export default function CasualDuels({ publicLobby = false }: { publicLobby?: boolean }) {
  const { user, loading } = useAuth();
  const player = user && !user.isGuest ? user.id : null;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invitation = params.get('join') ?? '';
  const [room, setRoom] = useState(invitation);
  const [activeRoom, setActiveRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const sending = useRef(false);

  useEffect(() => { setRoom(invitation); setError(''); }, [invitation, publicLobby]);
  useEffect(() => {
    let live = true;
    setActiveRoom('');
    if (player) void competitive.queue('queue_status').then(status => {
      if (live) setActiveRoom(status.match?.matchId ?? '');
    }).catch(() => { /* Creating or joining also checks for an active room. */ });
    return () => { live = false; };
  }, [player]);

  async function enter(input?: string) {
    if (loading || sending.current) return;
    const code = input === undefined ? null : invitationCode(input);
    setError('');
    if (input !== undefined && !code) {
      setError('Enter the invitation link or the room code your friend shared.');
      return;
    }
    if (!player) {
      navigate(duelAccountPath(code, publicLobby));
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const match = code ? await competitive.joinCasual(code) : await competitive.createCasual();
      if (publicLobby && !code) {
        try {
          await publishDuel(match.matchId);
        } catch {
          navigate(`/duel/${match.matchId}`, { state: { retryListing: true } });
          return;
        }
      }
      navigate(`/duel/${match.matchId}`);
    } catch (cause) {
      setError(competitiveError(cause));
      if (publicLobby) setRevision(value => value + 1);
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'already_active') {
        const status = await competitive.queue('queue_status').catch(() => null);
        setActiveRoom(status?.match?.matchId ?? '');
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const joinForm = (
    <Panel className="space-y-4 p-6">
      <h2 className="text-xl font-bold">{invitation ? 'You have a duel invitation' : 'Join a friend'}</h2>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void enter(room); }}>
        <label className="block">Invitation link or room code
          <Input className="mt-2" autoCapitalize="none" autoComplete="off" spellCheck={false} required value={room} onChange={event => setRoom(event.target.value)} />
        </label>
        <ArenaButton type="submit" loading={busy} disabled={loading || !room.trim() || Boolean(activeRoom)}>
          {player ? 'Join duel' : 'Sign in to join duel'}
        </ArenaButton>
      </form>
    </Panel>
  );

  return <PageShell contentClassName="max-w-2xl space-y-5">
    <h1 className="text-4xl font-bold">{publicLobby ? 'Public duels' : 'Challenge a friend'}</h1>
    <nav aria-label="Duel lobbies" className="flex flex-wrap gap-3">
      <NavLink end to="/duels/public" className="duel-lobby-link">Public duels</NavLink>
      <NavLink end to="/duels" className="duel-lobby-link">Private invitations</NavLink>
    </nav>
    <p>{publicLobby ? 'Join an open room or create a duel that any Play Hub player can join. Entry is free.' : 'Create a private duel and send the invitation to one other player. Both players need a Play Hub account. Entry is free.'}</p>
    {activeRoom && <Panel className="space-y-2 p-6" role="status">
      <h2 className="text-xl font-bold">You already have a duel</h2>
      <Link className="text-cyan-200 underline" to={`/duel/${activeRoom}`}>Return to your duel</Link>
    </Panel>}
    {publicLobby ? <OpenDuels selected={invitationCode(invitation) ?? ''} signedIn={Boolean(player)} disabled={loading || busy || Boolean(activeRoom)}
      revision={revision} onJoin={code => void enter(code)} /> : invitation && joinForm}
    <Panel className="space-y-4 p-6">
      <h2 className="text-xl font-bold">{publicLobby ? 'Create a public duel' : 'Create a private duel'}</h2>
      <p>{publicLobby ? 'Your room stays open for up to 15 minutes. The first player to join becomes your opponent.' : 'Your friend has 15 minutes to join. Once you are both in the room, you can choose your Creatures.'}</p>
      <ArenaButton loading={busy} disabled={loading || Boolean(activeRoom)} onClick={() => void enter()}>
        {publicLobby ? (player ? 'Create public duel' : 'Sign in to create a public duel') : (player ? 'Create duel' : 'Sign in to create a duel')}
      </ArenaButton>
    </Panel>
    {!publicLobby && !invitation && joinForm}
    {error && <p role="alert" className="text-red-200">{error}</p>}
  </PageShell>;
}
