import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden pt-16">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="flex justify-center mb-4">
          <img src="/images/banner.png" alt="Mythical Beings" className="w-full max-w-xl h-auto rounded-lg shadow-lg object-contain max-h-40 sm:max-h-48 md:max-h-56 lg:max-h-64" />
        </div>

        {isLoading ? (
          <div className="text-center text-gray-400 py-10">Loading lobby...</div>
        ) : authError ? (
          <div className="text-center text-red-400 py-10">Error: {authError}</div>
        ) : error ? (
          <div className="text-center text-red-400 py-10">Error loading sessions: {error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-center text-gray-100">Create Or Join</h2>
              <button
                onClick={handleCreateSession}
                disabled={isCreating}
                className={`text-white text-lg font-semibold py-3 px-6 rounded-md transition-colors duration-200 w-full ${isCreating ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {isCreating ? 'Creating...' : 'Create Session'}
              </button>

              <div className="border-t border-gray-700 pt-4">
                <label htmlFor="join-code" className="block text-sm font-medium text-gray-300 mb-2">Session Code</label>
                <div className="flex gap-2">
                  <input
                    id="join-code"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void joinSessionByCode(joinCode);
                    }}
                    className="flex-1 p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                    placeholder="ABC123"
                  />
                  <button
                    onClick={() => void joinSessionByCode(joinCode)}
                    disabled={isJoining}
                    className={`px-4 rounded-md text-white font-semibold ${isJoining ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    Join
                  </button>
                </div>
              </div>

              <button
                onClick={() => navigate('/bot-game')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold py-3 px-6 rounded-md transition-colors duration-200 w-full"
              >
                Train with a bot
              </button>
            </div>

            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-center text-gray-100">Available Sessions</h2>
              <div className="space-y-4 overflow-y-auto max-h-[420px] pr-2">
                {availableSessions.length > 0 ? (
                  availableSessions.map((session) => (
                    <div key={session.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center shadow-md">
                      <div>
                        <p className="text-lg font-semibold">{session.hostName || 'Unknown Host'}</p>
                        <p className="text-sm text-gray-300">Code: <span className="font-mono text-yellow-300">{session.code}</span></p>
                        <p className="text-sm text-gray-400">{session.participants?.length ?? 0}/{session.max_players} players</p>
                      </div>
                      <div className="text-right">
                        {session.host_id === playerId ? (
                          <button
                            onClick={() => navigate(`/waiting/${session.id}`)}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-1 px-3 rounded-md"
                          >
                            Rejoin
                          </button>
                        ) : (
                          <button
                            onClick={() => void joinSessionByCode(session.code)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 px-3 rounded-md"
                          >
                            Join
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">No available sessions right now.</div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-center text-gray-100">Active Sessions</h2>
              <div className="space-y-4 overflow-y-auto max-h-[420px] pr-2">
                {activeSessions.length > 0 ? (
                  activeSessions.map((session) => (
                    <div key={session.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center shadow-md">
                      <div>
                        <p className="text-lg font-semibold">{session.hostName || 'Unknown Host'}</p>
                        <p className="text-sm text-gray-400">In progress</p>
                      </div>
                      {session.participants?.some(participant => participant.player_id === playerId) ? (
                        <button
                          onClick={() => navigate(`/game/${session.id}`)}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-1 px-3 rounded-md"
                        >
                          Rejoin
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400">Playing</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">No live sessions at the moment.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {notification && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {notification}
        </div>
      )}
    </div>
  );
};

export default Lobby;
