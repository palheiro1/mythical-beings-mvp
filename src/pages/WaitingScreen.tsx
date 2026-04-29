import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Signal, Users } from 'lucide-react';
import {
  getPlayHubSession,
  PlayHubSession,
  setPlayHubReady,
  startPlayHubSession,
  subscribeToParticipants,
  subscribeToSession,
  supabase,
} from '../utils/supabase';
import { useAuth } from '../hooks/useAuth.js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ArenaButton, CopyChip, ErrorRecoveryPanel, Panel, SpinnerEmblem, StatusBadge } from '../components/ui/index.js';

const WaitingScreen: React.FC = () => {
  const { gameId: sessionId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<PlayHubSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startAttemptedRef = useRef(false);

  const startAndDealIfHost = useCallback(async (currentSession: PlayHubSession) => {
    if (!sessionId || !user?.id || startAttemptedRef.current) return;
    if (currentSession.host_id !== user.id || currentSession.status !== 'waiting') return;

    const participants = currentSession.participants ?? [];
    const everyoneReady = participants.length >= currentSession.min_players && participants.every(p => p.is_ready);
    if (!everyoneReady) return;

    startAttemptedRef.current = true;
    setLoading(true);

    const started = await startPlayHubSession(sessionId);
    if (!started) {
      startAttemptedRef.current = false;
      setError('Could not start session.');
      setLoading(false);
      return;
    }

    const { error: dealError } = await supabase.functions.invoke('deal-cards', {
      body: { sessionId },
    });

    if (dealError) {
      startAttemptedRef.current = false;
      setError(`Could not deal cards: ${dealError.message}`);
      setLoading(false);
      return;
    }

    navigate(`/nft-selection/${sessionId}`, { replace: true });
  }, [navigate, sessionId, user?.id]);

  const refreshSession = useCallback(async () => {
    if (!sessionId) return null;
    const details = await getPlayHubSession(sessionId);
    setSession(details);
    return details;
  }, [sessionId]);

  useEffect(() => {
    if (authLoading || !sessionId || !user?.id) return;

    let sessionChannel: RealtimeChannel | null = null;
    let participantChannel: RealtimeChannel | null = null;
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

        await setPlayHubReady(sessionId, true);
        const readyDetails = await refreshSession();
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

        sessionChannel = subscribeToSession(sessionId, async (updated) => {
          if (!isMounted) return;
          setSession(updated);
          if (updated.status === 'playing') {
            navigate(`/nft-selection/${sessionId}`, { replace: true });
          }
        });

        participantChannel = subscribeToParticipants(sessionId, async () => {
          if (!isMounted) return;
          const latest = await refreshSession();
          if (latest) await startAndDealIfHost(latest);
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
      if (participantChannel) supabase.removeChannel(participantChannel);
    };
  }, [authLoading, navigate, refreshSession, sessionId, startAndDealIfHost, user?.id]);

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
            Live Session
          </StatusBadge>
          <h1 className="font-display text-4xl font-black text-slate-50">Waiting for Opponent...</h1>
          <p className="mt-3 text-sm text-slate-400">Share the session code with your opponent. The match starts automatically when everyone is ready.</p>

          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-slate-500">Session Code</p>
            {session?.code ? (
              <CopyChip value={session.code} className="mt-3 justify-center px-6 py-4 text-4xl font-black tracking-[0.18em] text-amber-100 sm:text-5xl" />
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-slate-500">No code available</div>
            )}
          </div>

          <div className="mt-6 flex justify-center">
            <CopyChip label="Game ID" value={sessionId || ''} className="max-w-full" />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Players Ready</p>
              <p className="mt-2 text-4xl font-black text-cyan-200">{session?.participants?.length ?? 0}<span className="text-slate-500">/{session?.max_players ?? 2}</span></p>
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
              <StatusBadge tone="green">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {session?.participants?.length ?? 0}/{session?.max_players ?? 2} ready
              </StatusBadge>
            </div>
          </div>

          <div className="mt-8">
            <SpinnerEmblem label="Waiting for realtime updates..." />
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
