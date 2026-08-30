import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Clock,
  Eye,
  FlaskConical,
  Play,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import {
  createCompetitiveSession,
  createPlayHubSession,
  getActiveGames,
  getAvailableGames,
  getProfile,
  joinCompetitiveSession,
  joinPlayHubSession,
  PLAYHUB_COMPETITIVE_MODE_ID,
  PLAYHUB_DEFAULT_STAKE_GEM,
  PLAYHUB_GAME_ID,
  PLAYHUB_MODE_ID,
  PlayHubSession,
  setPlayHubReady,
  supabase,
} from '../utils/supabase.js';
import { ArenaButton, CopyChip, EmptyState, Input, PageShell, Panel, Skeleton, StatusBadge, Toast } from '../components/ui/index.js';
import { clearBotCreatureSelection } from '../utils/botSelection.js';
import {
  CHAMPIONSHIP_MESSAGE,
  TRAINING_PREVIEW_ENABLED,
  TRAINING_PREVIEW_LABEL,
} from '../config/release.js';

interface SessionWithHost extends PlayHubSession {
  hostName: string | null;
  stakeGem?: string | null;
  competitionStatus?: string | null;
}

type LobbyMode = typeof PLAYHUB_MODE_ID | typeof PLAYHUB_COMPETITIVE_MODE_ID;

const POSITIVE_WHOLE_GEM_STAKE = /^[1-9]\d*$/;

function normalizeStakeInput(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function isValidStakeGem(value: string): boolean {
  return POSITIVE_WHOLE_GEM_STAKE.test(value.trim());
}

const trainingGoals = [
  {
    icon: BookOpenCheck,
    title: 'Master the rules',
    description: 'Learn the turn phases, card timing, and how each arena zone changes your decisions.',
  },
  {
    icon: FlaskConical,
    title: 'Test combinations',
    description: 'Shuffle your training hand and discover creature and knowledge-card interactions.',
  },
  {
    icon: Target,
    title: 'Refine your strategy',
    description: 'Practice sequencing, power management, and when to commit your strongest cards.',
  },
];

const TrainingPreviewLobby: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const playerName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Player';

  const startTraining = () => {
    clearBotCreatureSelection();
    navigate('/bot-selection');
  };

  return (
    <PageShell contentClassName="space-y-6 pb-24">
      <section className="arena-banner relative overflow-hidden rounded-xl border border-amber-200/20 px-6 py-10 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -bottom-20 right-[7%] hidden aspect-[921/1217] w-44 rotate-[9deg] overflow-hidden rounded-xl border border-cyan-200/15 opacity-55 shadow-2xl lg:block">
          <div className="card-back-face h-full w-full" aria-hidden>
            <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" />
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-24 right-[18%] hidden aspect-[921/1217] w-40 -rotate-[8deg] overflow-hidden rounded-xl border border-amber-200/15 opacity-45 shadow-2xl lg:block">
          <img src="/images/beings/zhar-ptitsa.webp" srcSet="/images/beings/zhar-ptitsa-360.webp 360w, /images/beings/zhar-ptitsa.webp 720w" sizes="160px" alt="" width="720" height="951" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>

        <div className="relative max-w-3xl">
          <StatusBadge tone="amber" className="mb-5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {TRAINING_PREVIEW_LABEL}
          </StatusBadge>
          <p className="mb-2 text-sm text-cyan-100">Welcome, {playerName}</p>
          <h1 className="font-display text-4xl font-black text-slate-50 sm:text-6xl">Enter the Training Grounds</h1>
          <p className="state-parchment mt-4 max-w-2xl text-base leading-7 sm:text-lg">
            Wisdom Duel is open for solo practice. Learn the game, try new lineups, and build the instincts you will need when the championship begins.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ArenaButton
              type="button"
              size="lg"
              icon={<Bot className="h-5 w-5" aria-hidden />}
              onClick={startTraining}
            >
              Choose Your Training Team
            </ArenaButton>
            <ArenaButton
              type="button"
              size="lg"
              variant="secondary"
              icon={<BookOpenCheck className="h-5 w-5" aria-hidden />}
              onClick={() => navigate('/how-to-play')}
            >
              Read How to Play
            </ArenaButton>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="training-goals-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-cyan-200">Make the preview count</p>
              <h2 id="training-goals-title" className="mt-1 font-display text-3xl font-bold text-slate-50">What to practice</h2>
            </div>
            <Bot className="hidden h-8 w-8 text-cyan-200/60 sm:block" aria-hidden />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {trainingGoals.map(({ icon: Icon, title, description }, index) => (
              <Panel key={title} as="article" className="relative overflow-hidden p-5">
                <span className="absolute right-4 top-3 font-display text-4xl text-white/[0.04]" aria-hidden>
                  0{index + 1}
                </span>
                <div className="state-arcane grid h-10 w-10 place-items-center rounded-lg border">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </Panel>
            ))}
          </div>
        </section>

        <Panel as="aside" className="trim-bronze flex flex-col justify-between border p-6">
          <div>
            <StatusBadge tone="violet">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              Championship
            </StatusBadge>
            <h2 className="mt-5 font-display text-2xl font-bold text-amber-100">The arena is preparing</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{CHAMPIONSHIP_MESSAGE}</p>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              PvP sessions, GEM stakes, rankings, and competitive rewards are not available during this preview.
            </p>
          </div>
          <button
            type="button"
            onClick={startTraining}
            className="mt-6 inline-flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-left text-sm font-bold text-cyan-100 transition hover:text-white"
          >
            Start preparing now
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </Panel>
      </div>
    </PageShell>
  );
};

const MultiplayerLobby: React.FC = () => {
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
  const [selectedMode, setSelectedMode] = useState<LobbyMode>(PLAYHUB_MODE_ID);
  const [selectedStakeGem, setSelectedStakeGem] = useState(PLAYHUB_DEFAULT_STAKE_GEM);

  const enrichSessions = useCallback(async (sessions: PlayHubSession[], modeId: LobbyMode): Promise<SessionWithHost[]> => {
    const competitionBySession = new Map<string, { stake_gem?: string | number | null; status?: string | null }>();
    if (modeId === PLAYHUB_COMPETITIVE_MODE_ID && sessions.length > 0) {
      const { data, error } = await supabase
        .from('card_game_competitions')
        .select('session_id, stake_gem, status')
        .in('session_id', sessions.map((session) => session.id));

      if (!error) {
        (data ?? []).forEach((row: any) => {
          competitionBySession.set(row.session_id, row);
        });
      }
    }

    return Promise.all(sessions.map(async (session) => {
      const profile = await getProfile(session.host_id);
      const competition = competitionBySession.get(session.id);
      return {
        ...session,
        hostName: profile?.username || session.host_id.substring(0, 8),
        stakeGem: competition?.stake_gem != null ? String(competition.stake_gem) : null,
        competitionStatus: competition?.status ?? null,
      };
    }));
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!playerId) return;

    setLoadingSessions(true);
    setError(null);
    try {
      const [waiting, playing] = await Promise.all([
        getAvailableGames(selectedMode, playerId),
        getActiveGames(selectedMode),
      ]);

      const [waitingWithHosts, playingWithHosts] = await Promise.all([
        enrichSessions(waiting, selectedMode),
        enrichSessions(playing, selectedMode),
      ]);

      setAvailableSessions(waitingWithHosts);
      setActiveSessions(playingWithHosts);
    } catch (err: any) {
      console.error('[Lobby] Failed to fetch sessions:', err);
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, [enrichSessions, playerId, selectedMode]);

  useEffect(() => {
    if (!authLoading && playerId) {
      void fetchSessions();
    }
  }, [authLoading, fetchSessions, playerId]);

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
      showNotification('Please sign in with Play Hub and link a Polygon wallet to create a session.');
      return;
    }

    const stakeGem = selectedStakeGem.trim();
    if (selectedMode === PLAYHUB_COMPETITIVE_MODE_ID && !isValidStakeGem(stakeGem)) {
      showNotification('Enter a whole GEM stake greater than zero.');
      return;
    }

    setIsCreating(true);
    try {
      const session = selectedMode === PLAYHUB_COMPETITIVE_MODE_ID
        ? await createCompetitiveSession(stakeGem)
        : await createPlayHubSession();
      if (!session) throw new Error('Could not create session.');

      if (selectedMode === PLAYHUB_MODE_ID) {
        await setPlayHubReady(session.id, true);
      }
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
      showNotification('Please sign in with Play Hub and link a Polygon wallet to join a session.');
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      showNotification('Enter a session code.');
      return;
    }

    setIsJoining(true);
    try {
      const session = selectedMode === PLAYHUB_COMPETITIVE_MODE_ID
        ? await joinCompetitiveSession(trimmedCode)
        : await joinPlayHubSession(trimmedCode);
      if (!session) throw new Error('Could not join session.');

      if (selectedMode === PLAYHUB_MODE_ID) {
        await setPlayHubReady(session.id, true);
      }
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
  const isCompetitiveMode = selectedMode === PLAYHUB_COMPETITIVE_MODE_ID;
  const isStakeValid = isValidStakeGem(selectedStakeGem);

  return (
    <PageShell contentClassName="space-y-6 pb-24">
      <Panel className="arena-banner relative overflow-hidden p-6 sm:p-8" glow>
        <div className="pointer-events-none absolute bottom-[-28px] right-[18%] hidden h-44 w-32 rotate-[-10deg] overflow-hidden rounded-xl border border-amber-200/15 opacity-45 shadow-2xl lg:block">
          <div className="card-back-face h-full w-full" aria-hidden>
            <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" />
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-[-34px] right-[8%] hidden h-48 w-36 rotate-[9deg] overflow-hidden rounded-xl border border-cyan-200/15 opacity-45 shadow-2xl lg:block">
          <div className="card-back-face h-full w-full" aria-hidden>
            <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" />
          </div>
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <StatusBadge tone="violet" className="mb-4">
              <Swords className="h-3.5 w-3.5" aria-hidden />
              Play Hub
            </StatusBadge>
            <h1 className="font-display text-4xl font-black text-slate-50 sm:text-5xl">Enter the Arena</h1>
            <p className="state-parchment mt-3 max-w-2xl text-sm sm:text-base">Create a duel, join by code, rejoin an active match, or train locally against the bot.</p>
          </div>
          <div className="surface-obsidian grid min-w-[220px] gap-3 rounded-xl border p-4">
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
              <h2 className="font-display text-xl font-bold text-slate-100">Create or Join</h2>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-normal text-slate-400">Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMode(PLAYHUB_MODE_ID)}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold uppercase transition ${!isCompetitiveMode ? 'state-arcane' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'}`}
                  >
                    Casual
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode(PLAYHUB_COMPETITIVE_MODE_ID)}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold uppercase transition ${isCompetitiveMode ? 'state-relic' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'}`}
                  >
                    GEM
                  </button>
                </div>
              </div>

              {isCompetitiveMode && (
                <div>
                  <label htmlFor="stake-gem" className="mb-3 block text-xs font-bold uppercase tracking-normal text-slate-400">Stake</label>
                  <div className="relative">
                    <Input
                      id="stake-gem"
                      value={selectedStakeGem}
                      onChange={(event) => setSelectedStakeGem(normalizeStakeInput(event.target.value))}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      aria-invalid={!isStakeValid}
                      className="pr-16 font-mono text-lg font-black"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-normal text-amber-100/70">GEM</span>
                  </div>
                  {!isStakeValid && <p className="mt-2 text-xs text-amber-100/80">Enter a whole GEM amount greater than zero.</p>}
                </div>
              )}

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-normal text-slate-400">Create your own session</p>
                <ArenaButton
                  type="button"
                  onClick={handleCreateSession}
                  loading={isCreating}
                  disabled={isCompetitiveMode && !isStakeValid}
                  icon={<PlusCircle className="h-4 w-4" aria-hidden />}
                  fullWidth
                >
                  {isCreating ? 'Creating...' : isCompetitiveMode ? `Create ${selectedStakeGem || 'GEM'} Session` : 'Create Session'}
                </ArenaButton>
              </div>

              <div className="border-t border-white/10 pt-5">
                <label htmlFor="join-code" className="mb-2 block text-xs font-bold uppercase tracking-normal text-slate-400">Join with a session code</label>
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
              <h2 className="font-display text-xl font-bold text-slate-100">Available Sessions</h2>
              </div>
              <button type="button" onClick={() => void fetchSessions()} className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:text-white" aria-label="Refresh sessions">
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="arena-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
              {availableSessions.length > 0 ? (
                availableSessions.map((session) => {
                  const participantCount = session.participants?.length ?? 0;
                  const isParticipant = session.participants?.some(participant => participant.player_id === playerId) ?? false;
                  const isFull = participantCount >= session.max_players;
                  return (
                    <div key={session.id} className="surface-obsidian rounded-xl border p-4 transition hover:border-cyan-300/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-100">{session.hostName || 'Unknown Host'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                            <CopyChip label="Code" value={session.code} className="max-w-full" />
                            <StatusBadge tone={isFull ? 'amber' : 'green'}>{participantCount}/{session.max_players} players</StatusBadge>
                            {isCompetitiveMode ? (
                              <StatusBadge tone="amber">{session.stakeGem ?? '?'} GEM</StatusBadge>
                            ) : (
                              <StatusBadge tone="blue">Casual</StatusBadge>
                            )}
                          </div>
                        </div>
                        <ArenaButton
                          type="button"
                          size="sm"
                          variant={isParticipant ? 'primary' : 'secondary'}
                          disabled={!isParticipant && isFull}
                          onClick={() => isParticipant ? navigate(`/waiting/${session.id}`) : void joinSessionByCode(session.code)}
                        >
                          {isParticipant ? 'Rejoin' : isFull ? 'Full' : 'Join'}
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
              <h2 className="font-display text-xl font-bold text-slate-100">Active Sessions</h2>
            </div>
            <div className="arena-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
              {activeSessions.length > 0 ? (
                activeSessions.map((session) => {
                  const isParticipant = session.participants?.some(participant => participant.player_id === playerId);
                  return (
                    <div key={session.id} className="surface-obsidian rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-100">{session.hostName || 'Unknown Host'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <StatusBadge tone="violet">In progress</StatusBadge>
                            {isCompetitiveMode && <StatusBadge tone="amber">{session.stakeGem ?? '?'} GEM</StatusBadge>}
                            {isParticipant ? <StatusBadge tone="amber">Your match</StatusBadge> : <StatusBadge tone="muted">Playing</StatusBadge>}
                          </div>
                        </div>
                        {isParticipant ? (
                          <ArenaButton type="button" size="sm" icon={<Play className="h-4 w-4" aria-hidden />} onClick={() => navigate(`/game/${session.id}`)}>
                            Rejoin
                          </ArenaButton>
                        ) : (
                          <ArenaButton type="button" size="sm" variant="secondary" icon={<Eye className="h-4 w-4" aria-hidden />} onClick={() => navigate(`/game/${session.id}`)}>
                            Watch
                          </ArenaButton>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState title="No live sessions at the moment." description="Active matches you can watch or rejoin will appear here." />
              )}
            </div>
          </Panel>
        </div>
      )}

      <Toast message={notification} tone={notification?.toLowerCase().includes('failed') || notification?.toLowerCase().includes('enter') ? 'red' : 'green'} />
    </PageShell>
  );
};

const Lobby: React.FC = () => (
  TRAINING_PREVIEW_ENABLED ? <TrainingPreviewLobby /> : <MultiplayerLobby />
);

export default Lobby;
