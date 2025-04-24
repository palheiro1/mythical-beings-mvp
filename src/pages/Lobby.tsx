import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
import { supabase } from '../utils/supabase';
import { AvailableGame } from '../game/types'; // Import the new type
import { getAvailableGames, createGame, getProfile, joinGame } from '../utils/supabase';
import { v4 as uuidv4 } from 'uuid';

// Define the combined type for games with creator's username
interface GameWithUsername extends AvailableGame { // Extend AvailableGame
  creatorUsername: string | null;
}

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [currentPlayerId, , playerError, , idLoading] = usePlayerIdentification();
  const [availableGames, setAvailableGames] = useState<GameWithUsername[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleJoinGame = async (gameId: string) => {
    if (!currentPlayerId) {
      setNotification('Cannot join game: User not identified.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    console.log(`[Lobby] Player ${currentPlayerId} attempting to join game: ${gameId}`);
    try {
      const joinedGame = await joinGame(gameId, currentPlayerId);
      if (joinedGame) {
        console.log(`[Lobby] Successfully joined game ${gameId}. Navigating...`);
        navigate(`/game/${gameId}`);
      } else {
        const gameData = await supabase.from('games').select('player1_id, player2_id, status').eq('id', gameId).single();
        if (gameData.data && (gameData.data.player1_id === currentPlayerId || gameData.data.player2_id === currentPlayerId)) {
          console.log(`[Lobby] User is already in game ${gameId}. Navigating...`);
          navigate(`/game/${gameId}`);
        } else if (gameData.data && gameData.data.status !== 'waiting') {
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
        setNotification('Game created successfully! Joining...');
        navigate(`/game/${newGameId}`);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white p-6 md:p-8">
      <header className="max-w-7xl mx-auto mb-12 flex justify-between items-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg">Mythical Beings Lobby</h1>
        {currentPlayerId && (
          <button
            onClick={() => navigate('/profile')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
          >
            My Profile
          </button>
        )}
        {!currentPlayerId && (
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
          >
            Login
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-7xl mx-auto">
        <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col gap-4">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
            <span className="text-purple-400 text-2xl">👥</span>
            Players Online
          </h2>
          <div className="text-center text-gray-400 py-4">Player list temporarily unavailable</div>
        </div>

        <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col gap-4">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
            <span className="text-yellow-400 text-2xl">🎮</span>
            Available Games
          </h2>
          <div className="space-y-4">
            {availableGames.map((game) => (
              <div key={game.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center shadow-md">
                <div>
                  <p className="text-lg font-semibold">{game.creatorUsername || 'Unknown Creator'}</p>
                  <p className="text-sm text-gray-400">Bet: {game.bet_amount} GEM</p>
                  <p className="text-xs text-gray-500">ID: {game.id.substring(0, 8)}...</p>
                </div>
                <div className="text-right">
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

        <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col items-center gap-5">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100">Actions</h2>
          {currentPlayerId ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white text-lg font-semibold py-3 px-6 rounded-md transition-colors duration-200 w-full"
            >
              Create Game
            </button>
          ) : (
            <p className="text-gray-400 text-center">Log in to create a game.</p>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
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
        </div>
      )}

      {notification && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {notification}
        </div>
      )}
    </div>
  );
};

export default Lobby;
