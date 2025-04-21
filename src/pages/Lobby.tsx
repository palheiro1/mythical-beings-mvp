import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
import { getAvailableGames, createGame } from '../utils/supabase';
import { AvailableGame } from '../types';
import { v4 as uuidv4 } from 'uuid';

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [currentPlayerId, , playerError, setPlayerError] = usePlayerIdentification();
  const [games, setGames] = useState<AvailableGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [errorGames, setErrorGames] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  console.log('[Lobby] Rendering component...', { loadingGames, errorGames, gamesCount: games.length });

  // Fetch available games on component mount
  useEffect(() => {
    console.log('[Lobby] useEffect: Fetching games...');
    const fetchGames = async () => {
      try {
        const fetchedGames = await getAvailableGames();
        console.log('[Lobby] useEffect: Fetched games data:', fetchedGames);
        setGames(fetchedGames || []);
        setErrorGames(null); // Clear previous errors
      } catch (error) {
        console.error('[Lobby] useEffect: Error fetching games:', error);
        setErrorGames('Failed to fetch games');
        setGames([]); // Clear games on error
      } finally {
        console.log('[Lobby] useEffect: Setting loadingGames to false.');
        setLoadingGames(false);
      }
    };

    fetchGames();
  }, []); // Empty dependency array ensures this runs only once

  // Handle player identification error
  useEffect(() => {
    if (playerError) {
      console.warn('[Lobby] Player identification error:', playerError);
      setNotification(`Error identifying player: ${playerError}`);
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [playerError]);

  const handleJoinGame = (gameId: string) => {
    console.log('[Lobby] Joining game:', gameId);
    navigate(`/game/${gameId}`);
  };

  const handleCreateGame = async () => {
    if (!currentPlayerId) {
      setNotification('Player ID not found. Cannot create game.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    console.log('[Lobby] Creating game with bet amount:', betAmount);
    setIsCreating(true);
    const newGameId = uuidv4();
    try {
      const createdGameData = await createGame(newGameId, currentPlayerId, betAmount);

      if (createdGameData) {
        setGames((prevGames) => [...prevGames, {
          id: createdGameData.id,
          player1_id: createdGameData.player1_id,
          bet_amount: createdGameData.bet_amount,
          created_at: createdGameData.created_at,
          status: createdGameData.status,
        }]);
        setShowCreateModal(false);
        setNotification('Game created successfully!');
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

  console.log('[Lobby] Preparing to return JSX...', { loadingGames, errorGames });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white p-6 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12 text-center">
        <h1 className="text-5xl font-extrabold text-white drop-shadow-lg">Mythical Beings Lobby</h1>
      </header>

      {/* Loading/Error States for Games List */}
      {loadingGames && <div className="text-center text-gray-400 py-10">Loading available games...</div>}
      {errorGames && <div className="text-center text-red-400 py-10">Error loading games: {errorGames}</div>}

      {/* Main Content Grid (only render if not loading and no error) */}
      {!loadingGames && !errorGames && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-7xl mx-auto">
          {/* Column 1: Players - Temporarily removed content */}
          <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col gap-4">
            <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
              <span className="text-purple-400 text-2xl">👥</span>
              Players Online
            </h2>
            <div className="text-center text-gray-400 py-4">Player list temporarily unavailable</div>
          </div>

          {/* Column 2: Games */}
          <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col gap-4">
            <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
              <span className="text-yellow-400 text-2xl">🎮</span>
              Available Games
            </h2>
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700/50">
              {games.length > 0 ? (
                games.map((game) => (
                  <li
                    key={game.id}
                    className="bg-gray-700/50 p-4 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                  >
                    <div className="flex-grow">
                      <div className="flex items-center text-sm text-gray-400 gap-2">
                        <span>Player 1: {game.player1_id}</span>
                        <span className="text-gray-500">|</span>
                        <span className="flex items-center">
                          Bet: {game.bet_amount === 0 ? 'Free' : <>{game.bet_amount} <img src="/images/assets/gem.png" alt="GEM" className="h-4 w-4 inline-block align-middle ml-1" /></>}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className={`font-semibold ${game.status === 'waiting' ? 'text-green-400' : 'text-yellow-400'}`}>
                          {game.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {game.status === 'waiting' ? (
                      <button
                        onClick={() => handleJoinGame(game.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200 sm:w-auto mt-2 sm:mt-0"
                      >
                        Join Game
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinGame(game.id)}
                        className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200 sm:w-auto mt-2 sm:mt-0"
                      >
                        Spectate
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <li className="text-center text-gray-400 py-4">No games available</li>
              )}
            </ul>
          </div>

          {/* Column 3: Actions */}
          <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col items-center gap-5">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white text-lg font-semibold py-3 px-6 rounded-md transition-colors duration-200"
            >
              Create Game
            </button>
          </div>
        </div>
      )}

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold text-center mb-4">Create Game</h2>
            <div className="flex flex-col gap-4">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="bg-gray-700 text-white p-3 rounded-md"
                placeholder="Enter bet amount (0 for free)"
              />
              <div className="flex gap-4">
                <button
                  onClick={handleCreateGame}
                  disabled={isCreating}
                  className={`flex-1 py-3 px-6 rounded-md text-white font-semibold ${isCreating ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700 transition-colors duration-200'}`}
                >
                  {isCreating ? 'Creating...' : 'Create'}
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

      {/* Notification Area */}
      {notification && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm shadow-lg">
          {notification}
        </div>
      )}
    </div>
  );
};

export default Lobby;
