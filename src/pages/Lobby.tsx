import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Clock, Play, PlusCircle, RefreshCw, Swords, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import {
  createPlayHubSession,
  getActiveGames,
  getAvailableGames,
  getOrCreatePlayHubProfile,
  getProfile,
  joinPlayHubSession,
  PLAYHUB_GAME_ID,
  PlayHubSession,
  setPlayHubReady,
  supabase,
} from '../utils/supabase.js';
import { ArenaButton, CopyChip, EmptyState, Input, PageShell, Panel, Skeleton, StatusBadge, Toast } from '../components/ui/index.js';
import { clearBotCreatureSelection } from '../utils/botSelection.js';

interface SessionWithHost extends PlayHubSession {
  hostName: string | null;
}

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, error: authError } = useAuth();
  const playerId = user?.id;
  const [availableSessions, setAvailableSessions] = useState<SessionWithHost[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionWithHost[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const enrichSessions = useCallback(async (sessions: PlayHubSession[]): Promise<SessionWithHost[]> => {
    return Promise.all(sessions.map(async (session) => {
      const profile = await getProfile(session.host_id);
      return {
        ...session,
        hostName: profile?.username || session.host_id.substring(0, 8),
      };
    }));
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!playerId) return;

    setLoadingSessions(true);
    setError(null);
    try {
      const [waiting, playing] = await Promise.all([
        getAvailableGames(),
        getActiveGames(),
      ]);

      const [waitingWithHosts, playingWithHosts] = await Promise.all([
        enrichSessions(waiting),
        enrichSessions(playing),
      ]);

      setAvailableSessions(waitingWithHosts);
      setActiveSessions(playingWithHosts);
    } catch (err: any) {
      console.error('[Lobby] Failed to fetch sessions:', err);
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, [enrichSessions, playerId]);

  useEffect(() => {
    if (!authLoading && playerId) {
      void getOrCreatePlayHubProfile(user?.user_metadata?.display_name ?? null);
      void fetchSessions();
    }
  }, [authLoading, fetchSessions, playerId, user?.user_metadata?.display_name]);

  useEffect(() => {
    if (!playerId) return;

    const sessionChannel = supabase
      .channel('playhub-card-game-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `game_id=eq.${PLAYHUB_GAME_ID}`,
        },
        () => {
          void fetchSessions();
        },
      )
      .subscribe();

    const participantsChannel = supabase
      .channel('playhub-card-game-participants')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
        },
        () => {
          void fetchSessions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [fetchSessions, playerId]);

  const showNotification = (message: string, timeout = 4000) => {
    setNotification(message);
    window.setTimeout(() => setNotification(null), timeout);
  };

  const handleCreateSession = async () => {
    if (!playerId) {
      showNotification('Please connect your wallet to create a session.');
      return;
    }

    setIsCreating(true);
    try {
      const profile = await getOrCreatePlayHubProfile(user?.user_metadata?.display_name ?? null);
      if (!profile) throw new Error('Could not create player profile.');

      const session = await createPlayHubSession();
      if (!session) throw new Error('Could not create session.');

      await setPlayHubReady(session.id, true);
      navigate(`/waiting/${session.id}`);
    } catch (err: any) {
      console.error('[Lobby] Create session failed:', err);
      showNotification(err.message || 'Failed to create session.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinSessionByCode = async (code: string) => {
    if (!playerId) {
      showNotification('Please connect your wallet to join a session.');
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      showNotification('Enter a session code.');
      return;
    }

    setIsJoining(true);
    try {
      const profile = await getOrCreatePlayHubProfile(user?.user_metadata?.display_name ?? null);
      if (!profile) throw new Error('Could not create player profile.');

      const session = await joinPlayHubSession(trimmedCode);
      if (!session) throw new Error('Could not join session.');

      await setPlayHubReady(session.id, true);
      navigate(`/waiting/${session.id}`);
    } catch (err: any) {
      console.error('[Lobby] Join session failed:', err);
      showNotification(err.message || 'Failed to join session.');
      void fetchSessions();
    } finally {
      setIsJoining(false);
    }
  };

  if (!authLoading && !playerId) {
    navigate('/');
    return null;
  }

  const isLoading = authLoading || loadingSessions;

  return (
    <PageShell contentClassName="space-y-6 pb-24">
      <Panel className="arena-banner overflow-hidden p-6 sm:p-8" glow>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <StatusBadge tone="violet" className="mb-4">
              <Swords className="h-3.5 w-3.5" aria-hidden />
              Play Hub
            </StatusBadge>
            <h1 className="font-display text-4xl font-black uppercase text-slate-50 sm:text-5xl">Welcome to Mythical Arena</h1>
            <p className="mt-3 max-w-2xl text-slate-300">Create a duel, join by code, rejoin an active match, or train locally against the bot.</p>
          </div>
          <div className="grid min-w-[220px] gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-400">Available</span>
              <strong className="text-2xl text-emerald-300">{availableSessions.length}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-400">Active</span>
              <strong className="text-2xl text-cyan-300">{activeSessions.length}</strong>
            </div>
          </div>
        </div>
      </Panel>

      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)_380px]">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : authError ? (
        <Panel className="p-6 text-center" glow>
          <StatusBadge tone="red">Authentication</StatusBadge>
          <p className="mt-4 text-red-100">We could not verify your session. Please sign in again.</p>
        </Panel>
      ) : error ? (
        <Panel className="p-6 text-center" glow>
          <StatusBadge tone="red">Sessions unavailable</StatusBadge>
          <p className="mt-4 text-slate-300">We could not load sessions right now.</p>
          <ArenaButton type="button" variant="secondary" className="mt-5" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={() => void fetchSessions()}>
            Retry
          </ArenaButton>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)_380px]">
          <Panel className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Users className="h-5 w-5 text-violet-200" aria-hidden />
              <h2 className="font-display text-xl font-bold uppercase text-slate-100">Create or Join</h2>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Create your own session</p>
                <ArenaButton
                  type="button"
                  onClick={handleCreateSession}
                  loading={isCreating}
                  icon={<PlusCircle className="h-4 w-4" aria-hidden />}
                  fullWidth
                >
                  {isCreating ? 'Creating...' : 'Create Session'}
                </ArenaButton>
              </div>

              <div className="border-t border-white/10 pt-5">
                <label htmlFor="join-code" className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Join with a session code</label>
                <Input
                  id="join-code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void joinSessionByCode(joinCode);
                  }}
                  maxLength={8}
                  className="font-mono uppercase"
                  placeholder="ABC123"
                />
                <ArenaButton
                  type="button"
                  onClick={() => void joinSessionByCode(joinCode)}
                  loading={isJoining}
                  variant="secondary"
                  className="mt-3"
                  fullWidth
                >
                  Join
                </ArenaButton>
              </div>

              <div className="border-t border-white/10 pt-5">
                <ArenaButton
                  type="button"
                  onClick={() => {
                    clearBotCreatureSelection();
                    navigate('/bot-selection');
                  }}
                  variant="ghost"
                  icon={<Bot className="h-4 w-4 text-cyan-200" aria-hidden />}
                  fullWidth
                >
                  Train with a Bot
                </ArenaButton>
                <p className="mt-3 text-xs text-cyan-200">Practice mode. No competitive stats are changed.</p>
              </div>
            </div>
          </Panel>

          <Panel className="flex min-h-[440px] flex-col p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Swords className="h-5 w-5 text-amber-200" aria-hidden />
                <h2 className="font-display text-xl font-bold uppercase text-slate-100">Available Sessions</h2>
              </div>
              <button type="button" onClick={() => void fetchSessions()} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:text-white" aria-label="Refresh sessions">
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="arena-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
              {availableSessions.length > 0 ? (
                availableSessions.map((session) => {
                  const isHost = session.host_id === playerId;
                  return (
                    <div key={session.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-violet-300/35 hover:bg-white/[0.06]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-100">{session.hostName || 'Unknown Host'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                            <CopyChip label="Code" value={session.code} className="max-w-full" />
                            <StatusBadge tone="green">{session.participants?.length ?? 0}/{session.max_players} players</StatusBadge>
                          </div>
                        </div>
                        <ArenaButton
                          type="button"
                          size="sm"
                          variant={isHost ? 'primary' : 'secondary'}
                          onClick={() => isHost ? navigate(`/waiting/${session.id}`) : void joinSessionByCode(session.code)}
                        >
                          {isHost ? 'Rejoin' : 'Join'}
                        </ArenaButton>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState title="No available sessions right now." description="Create a new session or train with the bot while you wait." />
              )}
            </div>
          </Panel>

          <Panel className="flex min-h-[440px] flex-col p-5">
            <div className="mb-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-cyan-200" aria-hidden />
              <h2 className="font-display text-xl font-bold uppercase text-slate-100">Active Sessions</h2>
            </div>
            <div className="arena-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
              {activeSessions.length > 0 ? (
                activeSessions.map((session) => {
                  const isParticipant = session.participants?.some(participant => participant.player_id === playerId);
                  return (
                    <div key={session.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-100">{session.hostName || 'Unknown Host'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <StatusBadge tone="violet">In progress</StatusBadge>
                            {isParticipant ? <StatusBadge tone="amber">Your match</StatusBadge> : <StatusBadge tone="muted">Playing</StatusBadge>}
                          </div>
                        </div>
                        {isParticipant ? (
                          <ArenaButton type="button" size="sm" icon={<Play className="h-4 w-4" aria-hidden />} onClick={() => navigate(`/game/${session.id}`)}>
                            Rejoin
                          </ArenaButton>
                        ) : (
                          <StatusBadge tone="muted">Playing</StatusBadge>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState title="No live sessions at the moment." description="Active matches you can rejoin will appear here." />
              )}
            </div>
          </Panel>
        </div>
      )}

      <Toast message={notification} tone={notification?.toLowerCase().includes('failed') || notification?.toLowerCase().includes('enter') ? 'red' : 'green'} />
    </PageShell>
  );
};

export default Lobby;
