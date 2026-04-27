import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
      <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-400">
        <p>Loading session...</p>
        <div className="animate-pulse text-lg mt-4">...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-red-500">
        <p>Error: {error}</p>
        <button onClick={() => navigate('/lobby')} className="mt-4 underline text-blue-400 hover:text-blue-300">
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-300">
      <h1 className="text-2xl text-white mb-4">Waiting for Opponent...</h1>
      <p className="mb-2">Session code: <span className="text-yellow-500">{session?.code}</span></p>
      <p className="mb-2">Session ID: <span className="text-gray-500">{sessionId}</span></p>
      <p className="mb-6">{session?.participants?.length ?? 0}/{session?.max_players ?? 2} players ready</p>
      <div className="animate-pulse text-lg mb-8">...</div>
      <button
        onClick={() => navigate('/lobby')}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
      >
        Back to Lobby
      </button>
    </div>
  );
};

export default WaitingScreen;
