import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
import { supabase, getAvailableGames, createGame, joinGame, getProfile } from '../utils/supabase';
import { AvailableGame } from '../game/types'; // Import the new type
import { v4 as uuidv4 } from 'uuid';
import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js'; // Import Realtime types

// Define the combined type for games with creator's username
interface GameWithUsername extends AvailableGame { // Extend AvailableGame
  creatorUsername: string | null;
}

// Define type for online user profile info
interface OnlineUserInfo {
  username: string | null;
  avatar_url: string | null;
}

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { loading: authLoading, signOut } = useAuth();
  const [currentPlayerId, , playerError, , idLoading] = usePlayerIdentification();
  const [availableGames, setAvailableGames] = useState<GameWithUsername[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // User profile state for avatar and username
  const [userProfile, setUserProfile] = useState<OnlineUserInfo>({ username: null, avatar_url: null });
  // State to store online users' profiles
  const [onlineUsers, setOnlineUsers] = useState<Record<string, OnlineUserInfo>>({});
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const isLoading = authLoading || idLoading || loadingGames;

  console.log('[Lobby] Rendering component...', { isLoading, error, gamesCount: availableGames.length, currentPlayerId });

  const fetchGamesAndProfiles = useCallback(async () => {
    console.log('[Lobby] fetchGamesAndProfiles: Fetching games...');
    setLoadingGames(true);
    setError(null);
    try {
      const fetchedGames = await getAvailableGames();
      if (fetchedGames) {
        console.log('[Lobby] fetchGamesAndProfiles: Fetched games data:', fetchedGames);

        const gamesWithUsernames: GameWithUsername[] = await Promise.all(
          fetchedGames.map(async (game) => {
            let creatorUsername = null;
            if (game.player1_id) {
              const profile = await getProfile(game.player1_id);
              creatorUsername = profile?.username || game.player1_id.substring(0, 8);
            }
            return { ...game, creatorUsername };
          })
        );

        console.log('[Lobby] fetchGamesAndProfiles: Games with usernames:', gamesWithUsernames);
        setAvailableGames(gamesWithUsernames);
      } else {
        setAvailableGames([]);
      }
      setError(null);
    } catch (error) {
      console.error('[Lobby] fetchGamesAndProfiles: Error fetching games or profiles:', error);
      setError('Failed to fetch games or creator profiles');
      setAvailableGames([]);
    } finally {
      console.log('[Lobby] fetchGamesAndProfiles: Setting loadingGames to false.');
      setLoadingGames(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !idLoading) {
      fetchGamesAndProfiles();
    }
  }, [authLoading, idLoading, fetchGamesAndProfiles]);

  useEffect(() => {
    if (playerError) {
      console.warn('[Lobby] Player identification error:', playerError);
      setNotification(`Error identifying player: ${playerError}`);
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [playerError]);

  useEffect(() => {
    if (currentPlayerId) {
      getProfile(currentPlayerId)
        .then(profile => {
          setUserProfile({ username: profile?.username || null, avatar_url: profile?.avatar_url || null });
        })
        .catch(console.error);
    }
  }, [currentPlayerId]);

  // --- Realtime Game Subscription ---
  useEffect(() => {
    if (!supabase) return;

    console.log('[Lobby Realtime] Setting up games subscription.');
    const gamesChannel = supabase
      .channel('public:games')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games', filter: 'status=eq.waiting' },
        async (payload) => {
          console.log('[Lobby Realtime] New game detected:', payload.new);
          const newGame = payload.new as AvailableGame; // Cast to AvailableGame

          // Fetch creator profile
          let creatorUsername = null;
          if (newGame.player1_id) {
            try {
              const profile = await getProfile(newGame.player1_id);
              creatorUsername = profile?.username || newGame.player1_id.substring(0, 8);
            } catch (err) {
              console.error('[Lobby Realtime] Error fetching profile for new game creator:', err);
              creatorUsername = newGame.player1_id.substring(0, 8); // Fallback
            }
          }

          const gameWithUsername: GameWithUsername = { ...newGame, creatorUsername };

          setAvailableGames((currentGames) => {
            // Avoid adding duplicates if already present (e.g., due to initial fetch)
            if (currentGames.some(game => game.id === gameWithUsername.id)) {
              return currentGames;
            }
            return [...currentGames, gameWithUsername];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games' },
        (payload) => {
          console.log('[Lobby Realtime] Game update detected:', payload.new);
          const updatedGame = payload.new as AvailableGame;
          setAvailableGames((currentGames) =>
            currentGames.map((game) =>
              game.id === updatedGame.id ? { ...game, ...updatedGame, creatorUsername: game.creatorUsername } : game // Keep existing username
            ).filter(game => game.status === 'waiting') // Remove games that are no longer waiting
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'games' },
        (payload) => {
          console.log('[Lobby Realtime] Game delete detected:', payload.old);
          const deletedGameId = payload.old.id;
          setAvailableGames((currentGames) =>
            currentGames.filter((game) => game.id !== deletedGameId)
          );
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Lobby Realtime] Successfully subscribed to games channel.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Lobby Realtime] Subscription error:', err);
          setError('Realtime connection error for game list.');
        }
      });

    // Cleanup function
    return () => {
      if (gamesChannel) {
        console.log('[Lobby Realtime] Unsubscribing from games channel.');
        supabase.removeChannel(gamesChannel);
      }
    };
  }, [supabase]); // Depend only on supabase client
  // --- End Realtime Game Subscription ---

  // --- Presence Tracking ---
  useEffect(() => {
    if (!supabase || !currentPlayerId || !userProfile.username) {
      // Don't subscribe until we have supabase client, user ID, and username
      console.log('[Lobby Presence] Waiting for Supabase/User ID/Profile before subscribing.');
      return;
    }

    console.log('[Lobby Presence] Setting up presence channel.');
    const channel = supabase.channel('lobby-presence', {
      config: {
        presence: {
          key: currentPlayerId, // Unique key for this user
        },
      },
    });

    const fetchProfileForUser = async (userId: string) => {
      if (!onlineUsers[userId]) { // Fetch only if not already fetched
        try {
          const profile = await getProfile(userId);
          setOnlineUsers(prev => ({
            ...prev,
            [userId]: {
              username: profile?.username || `User (${userId.substring(0, 6)})`,
              avatar_url: profile?.avatar_url || null,
            },
          }));
        } catch (err) {
          console.error(`[Lobby Presence] Error fetching profile for ${userId}:`, err);
          // Optionally set a default/error state for this user
          setOnlineUsers(prev => ({
            ...prev,
            [userId]: { username: `User (${userId.substring(0, 6)})`, avatar_url: null },
          }));
        }
      }
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('[Lobby Presence] Sync event received.');
        const newState: RealtimePresenceState = channel.presenceState();
        console.log('[Lobby Presence] Current presence state:', newState);
        const userIds = Object.keys(newState);
        // Fetch profiles for all users currently present
        userIds.forEach(fetchProfileForUser);
        // Update the onlineUsers state, removing users no longer present
        setOnlineUsers(currentUsers => {
          const updatedUsers: Record<string, OnlineUserInfo> = {};
          userIds.forEach(id => {
            if (currentUsers[id]) {
              updatedUsers[id] = currentUsers[id];
            }
            // If not in currentUsers, fetchProfileForUser will handle adding it
          });
          return updatedUsers;
        });
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Lobby Presence] Join event:', { key, newPresences });
        fetchProfileForUser(key); // Fetch profile for the user who joined
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Lobby Presence] Leave event:', { key, leftPresences });
        setOnlineUsers(prev => {
          const updated = { ...prev };
          delete updated[key]; // Remove user who left
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Lobby Presence] Successfully subscribed to presence channel.');
          // Track the current user's presence
          await channel.track({
            user_id: currentPlayerId,
            username: userProfile.username, // Include username if available
            // Add other relevant info if needed
          });
          console.log('[Lobby Presence] User tracked.');
        } else if (status === 'CLOSED') {
          console.log('[Lobby Presence] Channel closed.');
        } else {
          console.error('[Lobby Presence] Subscription error/status:', status);
          setError('Realtime connection error for online players.');
        }
      });

    presenceChannelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (presenceChannelRef.current) {
        console.log('[Lobby Presence] Unsubscribing and removing channel.');
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  // Depend on supabase, currentPlayerId, and userProfile.username to ensure tracking happens with correct info
  }, [supabase, currentPlayerId, userProfile.username]);
  // --- End Presence Tracking ---

  const handleJoinGame = async (gameId: string) => {
    if (!currentPlayerId) {
      setNotification('Cannot join game: User not identified.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    console.log(`[Lobby] Player ${currentPlayerId} attempting to join game: ${gameId}`);
    setNotification(`Joining game ${gameId}...`); // Provide immediate feedback

    try {
      const joinedGame = await joinGame(gameId, currentPlayerId);

      if (joinedGame) {
        console.log(`[Lobby] Successfully joined game ${gameId}. Triggering card dealing...`);
        setNotification('Game joined! Dealing cards...'); // Update feedback

        const { error: functionError } = await supabase.functions.invoke('deal-cards', {
          body: { gameId },
        });

        if (functionError) {
          console.error('[Lobby] Error calling deal-cards function:', functionError);
          let errorMsg = 'Joined game, but failed to deal cards.';
          if (functionError.message.includes('already dealt') || functionError.message.includes('status')) {
            errorMsg = 'Game setup issue. Cards might already be dealt or status incorrect.';
          } else if (functionError.message.includes('Not enough creatures')) {
            errorMsg = 'Game configuration error: Not enough creatures defined.';
          }
          setNotification(`${errorMsg} Please try rejoining or contact support.`);
          setTimeout(() => setNotification(null), 6000);
        } else {
          console.log('[Lobby] deal-cards function invoked successfully. Navigating to NFT Selection...');
          setNotification('Cards dealt! Starting selection...');
          navigate(`/nft-selection/${gameId}`);
        }
      } else {
        const { data: gameData, error: fetchError } = await supabase.from('games').select('player1_id, player2_id, status, player1_dealt_hand').eq('id', gameId).single();

        if (fetchError) throw fetchError;

        if (gameData && (gameData.player1_id === currentPlayerId || gameData.player2_id === currentPlayerId)) {
          console.log(`[Lobby] User is already in game ${gameId}. Checking status...`);
          if (gameData.status === 'selecting' || gameData.status === 'active' || (gameData.player1_dealt_hand && gameData.player1_dealt_hand.length > 0)) {
            console.log(`[Lobby] Game status is '${gameData.status}'. Navigating to NFT Selection...`);
            navigate(`/nft-selection/${gameId}`);
          } else if (gameData.status === 'waiting' && gameData.player2_id === currentPlayerId) {
            setNotification('You seem to be in the game, but setup might be incomplete. Trying to initiate setup...');
            setTimeout(() => setNotification(null), 4000);
            await supabase.functions.invoke('deal-cards', { body: { gameId } });
            navigate(`/nft-selection/${gameId}`);
          } else {
            setNotification('Already in game, but current status is unclear. Refreshing...');
            setTimeout(() => setNotification(null), 4000);
            fetchGamesAndProfiles();
          }
        } else if (gameData && gameData.status !== 'waiting') {
          setNotification('Failed to join: Game is already full or in progress.');
          setTimeout(() => setNotification(null), 4000);
          fetchGamesAndProfiles();
        } else {
          setNotification('Failed to join game. It might no longer be available.');
          setTimeout(() => setNotification(null), 4000);
          fetchGamesAndProfiles();
        }
      }
    } catch (error) {
      console.error(`[Lobby] Error joining game ${gameId}:`, error);
      setNotification(`Error joining game: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setNotification(null), 4000);
      fetchGamesAndProfiles();
    }
  };

  const handleCreateGame = async () => {
    if (!currentPlayerId) {
      setNotification('Please log in to create a game.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    console.log('[Lobby] Creating game with bet amount:', betAmount);
    setIsCreating(true);
    const newGameId = uuidv4();
    try {
      const createdGameData = await createGame(newGameId, currentPlayerId, betAmount);

      if (createdGameData) {
        setShowCreateModal(false);
        setNotification('Game created successfully! Proceeding to NFT Selection...');
        navigate(`/nft-selection/${newGameId}`);
      } else {
        setNotification('Failed to create game. The game ID might already exist or another error occurred.');
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (error) {
      console.error('[Lobby] Error creating game:', error);
      setNotification(`Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsCreating(false);
    }
  };

  console.log('[Lobby] Preparing to return JSX...', { isLoading, error });

  if (isLoading) {
    return <div className="text-center text-gray-400 py-10">Loading Lobby...</div>;
  }

  if (playerError && !currentPlayerId) {
    return <div className="text-center text-red-400 py-10">Error: {playerError}. Please refresh or check URL parameters if testing.</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 py-10">Error loading games: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 bg-cover bg-center text-white p-6 md:p-8 relative overflow-hidden">
      {/* Efecto de neones */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-cyan-400/10 pointer-events-none" />
      
      <header className="max-w-7xl mx-auto mb-12 flex flex-col sm:flex-row justify-between items-center space-y-6 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300">
            Mythical Arena
          </h1>
          <div className="h-12 w-12 bg-purple-500 rounded-full animate-pulse" />
        </div>
        <div className="flex items-center space-x-4 ml-auto">
          {currentPlayerId && userProfile.username && (
            <>
              <img
                width={50}
                height={50}
                src={
                  userProfile.avatar_url
                    ? userProfile.avatar_url
                    : `/api/placeholder-avatar?text=${userProfile.username.charAt(0).toUpperCase()}`
                }
                alt="User Avatar"
                className="h-10 w-10 rounded-full object-cover border-2 border-white"
              />
              <span className="text-white font-medium">{userProfile.username}</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => navigate('/profile')}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
                >
                  My Profile
                </button>
                <button
                  onClick={signOut}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
          {!currentPlayerId && (
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-7xl mx-auto">
        <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
            <span className="text-purple-400 text-2xl">👥</span>
            Players Online ({Object.keys(onlineUsers).length}) {/* Display count */}
          </h2>
          {/* Replace placeholder with actual user list */}
          <div className="space-y-3 overflow-y-auto max-h-60 pr-2"> {/* Added scroll */}
            {Object.entries(onlineUsers).length > 0 ? (
              Object.entries(onlineUsers).map(([userId, profile]) => (
                <div key={userId} className="flex items-center space-x-3 p-2 bg-gray-700 rounded-md">
                  <img
                    width={50}
                    height={50}
                    src={profile.avatar_url || `/api/placeholder-avatar?text=${profile.username?.charAt(0).toUpperCase() || '?'}`}
                    alt={profile.username || 'User Avatar'}
                    className="h-8 w-8 rounded-full object-cover border border-gray-500"
                  />
                  <span className="text-sm font-medium text-gray-200 truncate">{profile.username || `User (${userId.substring(0, 6)})`}</span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-4">No other players currently online.</div>
            )}
          </div>
        </div>

        <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
            <span className="text-yellow-400 text-2xl">🎮</span>
            Available Games
          </h2>
          <div className="space-y-4">
            {availableGames.map((game) => (
              <div key={game.id} className="bg-gray-700 p-4 rounded-lg flex justify-center items-center shadow-md">
                <div>
                  <p className="text-lg font-semibold">{game.creatorUsername || 'Unknown Creator'}</p>
                  <p className="text-sm text-gray-400">Bet: {game.bet_amount} GEM</p>
                  <p className={`text-sm font-medium ${game.status === 'waiting' ? 'text-yellow-400' : 'text-green-400'}`}>
                    {game.status === 'waiting' ? 'Waiting for opponent' : 'Active'}
                  </p>
                  {game.status === 'waiting' && game.player1_id !== currentPlayerId && (
                    <button
                      onClick={() => handleJoinGame(game.id)}
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200"
                    >
                      Join Game
                    </button>
                  )}
                </div>
                <div className="text-right">

                  {game.status === 'active' && game.player1_id === currentPlayerId && (
                    <button
                      onClick={() => navigate(`/game/${game.id}`)}
                      className="mt-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200"
                    >
                      Rejoin Game
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col items-center gap-5">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100">Actions</h2>
          {currentPlayerId ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white text-lg font-semibold py-3 px-6 rounded-md transition-colors duration-200 w-full max-w-[200px]"
            >
              Create Game
            </button>
          ) : (
            <p className="text-gray-400 text-center">Log in to create a game.</p>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40"></div>
      )}
      {showCreateModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-6 rounded-lg shadow-lg max-w-md z-50">
          <h2 className="text-xl font-semibold text-center mb-4">Create New Game</h2>
          <div className="flex flex-col gap-4">
            <label htmlFor="bet-amount" className="block text-sm font-medium text-gray-400 mb-1">Bet Amount (0 for Free)</label>
            <div className="flex items-center bg-gray-700 rounded-md border border-gray-600">
              <input
                id="bet-amount"
                type="number"
                min="0"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                className="flex-grow p-3 rounded-l-md bg-transparent text-white focus:outline-none"
                placeholder="Enter bet amount"
              />
              <img src="/images/assets/gem.png" alt="GEM" className="h-6 w-6 mx-3" />
            </div>

            <div className="flex gap-4 mt-4">
              <button
                onClick={handleCreateGame}
                disabled={isCreating}
                className={`flex-1 py-3 px-6 rounded-md text-white font-semibold ${isCreating ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 transition-colors duration-200'}`}
              >
                {isCreating ? 'Creating...' : 'Confirm & Create'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 px-6 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {notification}
        </div>
      )}
    </div>
  );
};

export default Lobby;
