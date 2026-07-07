import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Signal, Users } from 'lucide-react';
import {
  depositCompetitionStake,
  getCompetitionStatus,
  getPlayHubSession,
  PLAYHUB_COMPETITIVE_MODE_ID,
  PlayHubSession,
  setPlayHubReady,
  startPlayHubSession,
  subscribeToSessionLifecycle,
  supabase,
} from '../utils/supabase';
import { useAuth } from '../hooks/useAuth.js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ArenaButton, CopyChip, ErrorRecoveryPanel, Panel, SpinnerEmblem, StatusBadge } from '../components/ui/index.js';
import type { CompetitionStatus } from '@mythicalb/sdk';
import { formatAddress, formatShortId } from '../utils/format.js';

const STATUS_POLL_INTERVAL_MS = 4000;

const WaitingScreen: React.FC = () => {
  const { gameId: sessionId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<PlayHubSession | null>(null);
  const [competitionStatus, setCompetitionStatus] = useState<CompetitionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const startAttemptedRef = useRef(false);

  const startAndDealIfHost = useCallback(async (currentSession: PlayHubSession) => {
    if (!sessionId || !user?.id || startAttemptedRef.current) return;
    if (currentSession.host_id !== user.id || currentSession.status !== 'waiting') return;

    const participants = currentSession.participants ?? [];
    const everyoneReady = participants.length >= currentSession.min_players && participants.every(p => p.is_ready);
    if (!everyoneReady) return;

    startAttemptedRef.current = true;
    setLoading(true);

    const isCompetitive = currentSession.mode_id === PLAYHUB_COMPETITIVE_MODE_ID;
    let dealError: { message?: string } | null = null;

    if (isCompetitive) {
      ({ error: dealError } = await supabase.functions.invoke('deal-cards', {
        body: { sessionId },
      }));
    }

    if (dealError) {
      startAttemptedRef.current = false;
      setError(`Could not deal cards: ${dealError.message}`);
      setLoading(false);
      return;
    }

    const started = await startPlayHubSession(sessionId);
    if (!started) {
      startAttemptedRef.current = false;
      setError('Could not start session.');
      setLoading(false);
      return;
    }

    if (!isCompetitive) {
      ({ error: dealError } = await supabase.functions.invoke('deal-cards', {
        body: { sessionId },
      }));

      if (dealError) {
        startAttemptedRef.current = false;
        setError(`Could not deal cards: ${dealError.message}`);
        setLoading(false);
        return;
      }
    }

    navigate(`/nft-selection/${sessionId}`, { replace: true });
  }, [navigate, sessionId, user?.id]);

  const refreshSession = useCallback(async () => {
    if (!sessionId) return null;
    const details = await getPlayHubSession(sessionId);
    setSession(details);
    return details;
  }, [sessionId]);

  const refreshCompetition = useCallback(async () => {
    if (!sessionId) return null;
    const status = await getCompetitionStatus(sessionId);
    setCompetitionStatus(status);
    return status;
  }, [sessionId]);

  const ensureCompetitiveReady = useCallback(async (currentSession: PlayHubSession) => {
    if (!sessionId || !user?.id || currentSession.mode_id !== PLAYHUB_COMPETITIVE_MODE_ID) return currentSession;
    const status = await refreshCompetition();
    const currentDeposit = status?.deposits.find((deposit) => deposit.player_id === user.id);
    const currentParticipant = currentSession.participants?.find((participant) => participant.player_id === user.id);

    if (currentDeposit?.status === 'confirmed' && currentParticipant?.is_ready !== true) {
      await setPlayHubReady(sessionId, true);
      return await refreshSession() ?? currentSession;
    }

    return currentSession;
  }, [refreshCompetition, refreshSession, sessionId, user?.id]);

  useEffect(() => {
    if (authLoading || !sessionId || !user?.id) return;

    let sessionChannel: RealtimeChannel | null = null;
    let isMounted = true;

    const setup = async () => {
      setLoading(true);
      setError(null);

      try {
        const details = await refreshSession();
        if (!isMounted) return;
        if (!details) throw new Error('Session not found.');

        const isParticipant = details.participants?.some(p => p.player_id === user.id);
        if (!isParticipant) {
          navigate('/lobby', { replace: true, state: { message: 'You are not part of that session.' } });
          return;
        }

        let readyDetails = details;
        if (details.mode_id === PLAYHUB_COMPETITIVE_MODE_ID) {
          readyDetails = await ensureCompetitiveReady(details);
        } else {
          await setPlayHubReady(sessionId, true);
          readyDetails = await refreshSession() ?? details;
        }
        if (!isMounted || !readyDetails) return;

        if (readyDetails.status === 'playing') {
          navigate(`/nft-selection/${sessionId}`, { replace: true });
          return;
        }
        if (readyDetails.status !== 'waiting') {
          navigate('/lobby', { replace: true, state: { message: `Session status is ${readyDetails.status}.` } });
          return;
        }

        await startAndDealIfHost(readyDetails);
        setLoading(false);

        sessionChannel = subscribeToSessionLifecycle(sessionId, {
          onSessionChange: async (updated) => {
            if (!isMounted) return;
            setSession(updated);
            let latest = updated;
            if (updated.mode_id === PLAYHUB_COMPETITIVE_MODE_ID && updated.status === 'waiting') {
              latest = await ensureCompetitiveReady(updated);
            }
            if (latest.status === 'playing') {
              navigate(`/nft-selection/${sessionId}`, { replace: true });
              return;
            }
            if (latest.status === 'waiting') {
              await startAndDealIfHost(latest);
            }
          },
          onParticipantsChange: async () => {
            if (!isMounted) return;
            const refreshed = await refreshSession();
            const latest = refreshed?.mode_id === PLAYHUB_COMPETITIVE_MODE_ID
              ? await ensureCompetitiveReady(refreshed)
              : refreshed;
            if (latest) await startAndDealIfHost(latest);
          },
          onError: (error) => {
            console.error('[WaitingScreen] Realtime session subscription failed:', error);
          },
        });
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load session.');
        setLoading(false);
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (sessionChannel) supabase.removeChannel(sessionChannel);
    };
  }, [authLoading, ensureCompetitiveReady, navigate, refreshSession, sessionId, startAndDealIfHost, user?.id]);

  useEffect(() => {
    if (authLoading || loading || error || !sessionId || !user?.id || session?.status !== 'waiting') return;

    let cancelled = false;

    const tick = async () => {
      try {
        const refreshed = await refreshSession();
        if (cancelled || !refreshed) return;

        let latest = refreshed;
        if (refreshed.mode_id === PLAYHUB_COMPETITIVE_MODE_ID) {
          latest = await ensureCompetitiveReady(refreshed);
        } else {
          const currentParticipant = refreshed.participants?.find((participant) => participant.player_id === user.id);
          if (currentParticipant?.is_ready !== true) {
            await setPlayHubReady(sessionId, true);
            latest = await refreshSession() ?? refreshed;
          }
        }
        if (cancelled) return;

        if (latest.status === 'playing') {
          navigate(`/nft-selection/${sessionId}`, { replace: true });
          return;
        }

        if (latest.status === 'waiting') {
          await startAndDealIfHost(latest);
        }
      } catch (err) {
        console.warn('[WaitingScreen] Polling refresh failed:', err);
      }
    };

    const intervalId = window.setInterval(() => void tick(), STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    authLoading,
    ensureCompetitiveReady,
    error,
    loading,
    navigate,
    refreshSession,
    session?.status,
    sessionId,
    startAndDealIfHost,
    user?.id,
  ]);

  const handleDepositStake = async () => {
    if (!sessionId) return;
    setDepositing(true);
    setError(null);

    try {
      const result = await depositCompetitionStake(sessionId);
      setCompetitionStatus(result.status);
      await setPlayHubReady(sessionId, true);
      const latest = await refreshSession();
      if (latest) await startAndDealIfHost(latest);
    } catch (err: any) {
      setError(err.message || 'Could not deposit GEM stake.');
    } finally {
      setDepositing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="arena-page flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
        <SpinnerEmblem label="Loading session..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="arena-page flex h-[calc(100vh-var(--navbar-height))] items-center justify-center px-4">
        <ErrorRecoveryPanel
          title="Session unavailable"
          message={error}
          onBack={() => navigate('/lobby')}
          onRetry={() => window.location.reload()}
          backLabel="Back to Lobby"
        />
      </div>
    );
  }

  const isCompetitive = session?.mode_id === PLAYHUB_COMPETITIVE_MODE_ID;
  const currentDeposit = competitionStatus?.deposits.find((deposit) => deposit.player_id === user?.id);
  const confirmedDeposits = competitionStatus?.deposits.filter((deposit) => deposit.status === 'confirmed').length ?? 0;
  const participantCount = session?.participants?.length ?? 0;
  const readyCount = session?.participants?.filter((participant) => participant.is_ready).length ?? 0;
  const maxPlayers = session?.max_players ?? 2;
  const hasTwoPlayers = participantCount >= 2;
  const canDeposit = Boolean(isCompetitive && hasTwoPlayers && currentDeposit?.status !== 'confirmed');
  const waitingForDepositAuth = Boolean(isCompetitive && hasTwoPlayers && currentDeposit?.status !== 'confirmed' && !competitionStatus?.depositAuthorization);
  const sessionCode = session?.code ?? '';
  let waitingStatus = 'Waiting for session update...';

  if (isCompetitive) {
    if (!hasTwoPlayers) {
      waitingStatus = 'Waiting for opponent to join with this code.';
    } else if (!competitionStatus) {
      waitingStatus = 'Loading Polygon escrow status...';
    } else if (waitingForDepositAuth) {
      waitingStatus = 'Preparing Polygon deposit authorization...';
    } else if (canDeposit) {
      waitingStatus = 'Deposit your GEM stake to continue.';
    } else if (currentDeposit?.status === 'confirmed' && confirmedDeposits < maxPlayers) {
      waitingStatus = 'Waiting for opponent deposit.';
    } else if (confirmedDeposits >= maxPlayers) {
      waitingStatus = 'Deposits confirmed. Starting match...';
    }
  } else if (participantCount < maxPlayers) {
    waitingStatus = 'Waiting for opponent to join with this code.';
  } else if (readyCount < maxPlayers) {
    waitingStatus = 'Waiting for players to be ready.';
  }

  return (
    <div className="arena-page relative flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute left-[10%] top-[18%] h-52 w-36 -rotate-12 rounded-2xl border border-white/10 bg-white/[0.03]" />
        <div className="absolute right-[12%] top-[28%] h-60 w-40 rotate-12 rounded-2xl border border-white/10 bg-white/[0.03]" />
        <div className="absolute bottom-[16%] left-[18%] h-48 w-32 rotate-6 rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center">
        <Panel className="p-6 sm:p-8" glow>
          <StatusBadge tone="violet" className="mb-5">
            <Signal className="h-3.5 w-3.5" aria-hidden />
            {isCompetitive ? 'Competitive GEM' : 'Live Session'}
          </StatusBadge>
          <h1 className="font-display text-4xl font-black text-slate-50">Waiting for Opponent...</h1>
          <p className="mt-3 text-sm text-slate-400">
            {isCompetitive
              ? 'The match starts after both players deposit their GEM stake on Polygon.'
              : 'Share the session code with your opponent. The match starts automatically when everyone is ready.'}
          </p>

          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-slate-500">Session Code</p>
            {session?.code ? (
              <CopyChip value={session.code} className="mt-3 justify-center px-6 py-4 text-4xl font-black tracking-[0.18em] text-amber-100 sm:text-5xl" />
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-slate-500">No code available</div>
            )}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Players Ready</p>
              <p className="mt-2 text-4xl font-black text-cyan-200">{readyCount}<span className="text-slate-500">/{maxPlayers}</span></p>
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
              <StatusBadge tone="green">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {participantCount}/{maxPlayers} players
              </StatusBadge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Mode</p>
              <p className="mt-2 text-lg font-black text-slate-100">{isCompetitive ? 'Competitive GEM' : 'Casual'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Session</p>
              <p className="mt-2 font-mono text-lg font-black text-amber-100">{sessionCode || formatShortId(sessionId, 6)}</p>
            </div>
          </div>

          {isCompetitive && (
            <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-left">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-100/70">Polygon escrow</p>
                  <p className="mt-1 text-2xl font-black text-amber-100">{competitionStatus?.stake_gem ?? '?'} GEM</p>
                </div>
                <StatusBadge tone={competitionStatus?.status === 'ready' ? 'green' : 'amber'}>
                  {confirmedDeposits}/{maxPlayers} deposits
                </StatusBadge>
              </div>

              <div className="mt-4 grid gap-2">
                {(competitionStatus?.deposits ?? []).map((deposit) => (
                  <div key={deposit.player_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                    <span className="truncate font-mono text-slate-300">{formatAddress(deposit.wallet_address)}</span>
                    <StatusBadge tone={deposit.status === 'confirmed' ? 'green' : 'muted'}>{deposit.status}</StatusBadge>
                  </div>
                ))}
              </div>

              {canDeposit && (
                <ArenaButton
                  type="button"
                  className="mt-4"
                  variant="success"
                  loading={depositing}
                  disabled={waitingForDepositAuth}
                  onClick={() => void handleDepositStake()}
                  fullWidth
                >
                  {waitingForDepositAuth ? 'Waiting for authorization' : `Deposit ${competitionStatus?.stake_gem ?? ''} GEM`}
                </ArenaButton>
              )}
            </div>
          )}

          <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-slate-400">
              Technical details
            </summary>
            <div className="mt-4 grid gap-3">
              {sessionId && <CopyChip label="Session ID" value={sessionId} className="max-w-full" />}
              {sessionCode && <CopyChip label="Code" value={sessionCode} className="max-w-full" />}
              {(competitionStatus?.deposits ?? []).map((deposit) => (
                <CopyChip key={`wallet-${deposit.player_id}`} label="Wallet" value={deposit.wallet_address} className="max-w-full" />
              ))}
            </div>
          </details>

          <div className="mt-8">
            <SpinnerEmblem label={waitingStatus} />
          </div>
        </Panel>

        <ArenaButton
          type="button"
          variant="ghost"
          className="mt-6"
          icon={<ArrowLeft className="h-4 w-4" aria-hidden />}
          onClick={() => navigate('/lobby')}
        >
          Back to Lobby
        </ArenaButton>
      </div>
    </div>
  );
};

export default WaitingScreen;
