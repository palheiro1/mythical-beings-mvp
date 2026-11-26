import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArenaButton, Input, PageShell, Panel } from '../components/ui/index.js';
import { duelAccountPath, invitationCode } from '../game/duelInvitation.js';
import { useAuth } from '../hooks/useAuth.js';
import { competitive, competitiveError } from '../services/competitiveService.js';

export default function CasualDuels() {
  const { user, loading } = useAuth();
  const player = user && !user.isGuest ? user.id : null;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invitation = params.get('join') ?? '';
  const [room, setRoom] = useState(invitation);
  const [activeRoom, setActiveRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);

  useEffect(() => { setRoom(invitation); setError(''); }, [invitation]);
  useEffect(() => {
    let live = true;
    setActiveRoom('');
    if (player) void competitive.queue('queue_status').then(status => {
      if (live) setActiveRoom(status.match?.matchId ?? '');
    }).catch(() => { /* Creating or joining also checks for an active room. */ });
    return () => { live = false; };
  }, [player]);

  async function enter(join: boolean) {
    if (loading || sending.current) return;
    const code = join ? invitationCode(room) : null;
    setError('');
    if (join && !code) {
      setError('Enter the invitation link or the room code your friend shared.');
      return;
    }
    if (!player) {
      navigate(duelAccountPath(code));
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const match = code ? await competitive.joinCasual(code) : await competitive.createCasual();
      navigate(`/duel/${match.matchId}`);
    } catch (cause) {
      setError(competitiveError(cause));
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
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void enter(true); }}>
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
    <h1 className="text-4xl font-bold">Challenge a friend</h1>
    <p>Create a private duel and send the invitation to one other player. Both players need a Play Hub account. Entry is free.</p>
    {activeRoom && <Panel className="space-y-2 p-6" role="status">
      <h2 className="text-xl font-bold">You already have a duel</h2>
      <Link className="text-cyan-200 underline" to={`/duel/${activeRoom}`}>Return to your duel</Link>
    </Panel>}
    {invitation && joinForm}
    <Panel className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Create a private duel</h2>
      <p>Your friend has 15 minutes to join. Once you are both in the room, you can choose your Creatures.</p>
      <ArenaButton loading={busy} disabled={loading || Boolean(activeRoom)} onClick={() => void enter(false)}>
        {player ? 'Create duel' : 'Sign in to create a duel'}
      </ArenaButton>
    </Panel>
    {!invitation && joinForm}
    {error && <p role="alert" className="text-red-200">{error}</p>}
  </PageShell>;
}
