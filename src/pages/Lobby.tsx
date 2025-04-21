import React, { useState } from 'react'; // Removed unused useEffect
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

// Mock data (replace with actual data fetching)
const mockPlayers = [
  { id: 1, name: 'PlayerOne', status: 'Idle' },
  { id: 2, name: 'MysticPlayer', status: 'In Game' },
  { id: 3, name: 'CardMaster', status: 'Idle' },
];

const mockGames = [
  { id: 'g1', name: 'Epic Duel', playersNames: ['PlayerOne'], bet: 0 },
  { id: 'g2', name: 'Mythic Arena', playersNames: ['PlayerOne', 'MysticPlayer'], bet: 10 },
  { id: 'g3', name: 'Beginner\'s Luck', playersNames: ['CardMaster'], bet: 0 },
];

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [players] = useState(mockPlayers); // Removed setPlayers
  const [games] = useState(mockGames); // Removed setGames
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [betAmount, setBetAmount] = useState(0); // 0 for Free Play, >0 for GEM Bet
  const [notification, setNotification] = useState<string | null>(null);

  // Function to handle joining a game
  const handleJoinGame = (gameId: string) => {
    console.log(`Joining game ${gameId}`);
    // Navigate to NFT selection screen instead of game screen
    navigate('/nft-selection');
  };

  // Function to handle creating a game
  const handleCreateGame = () => {
    console.log(`Creating game with bet: ${betAmount}`);
    // Add logic to create game
    setShowCreateModal(false);
    // Show notification (example)
    setNotification(`Game created! Bet: ${betAmount > 0 ? betAmount : 'Free'}`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Function for "Open to Fight"
  const handleAction = (action: string) => {
    console.log(`Performing action: ${action}`);
    setNotification(`Action '${action}' triggered (mock)`);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white p-6 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12 text-center">
        <h1 className="text-5xl font-extrabold text-white drop-shadow-lg">Mythical Beings Lobby</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-7xl mx-auto">

        {/* Column 1: Players */}
        <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col gap-4">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
            <span className="text-purple-400 text-2xl">👥</span>
            Players Online
          </h2>
          {/* Added scrollbar styling classes - requires `tailwind-scrollbar` plugin */}
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700/50">
            {players.map(player => (
              <li key={player.id} className="flex items-center bg-gray-700/50 p-3 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                <span className="font-medium text-gray-200">{player.name}</span>
                <span className="mx-2 text-gray-500">|</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${player.status === 'Idle' ? 'bg-green-500/30 text-green-300' : 'bg-blue-500/30 text-blue-300'}`}>{player.status}</span>
              </li>
            ))}
            {players.length === 0 && (
              <li className="text-center text-gray-400 py-4">No players online</li>
            )}
          </ul>
        </div>

        {/* Column 2: Games */}
        <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col gap-4">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
            <span className="text-yellow-400 text-2xl">🎮</span>
            Available Games
          </h2>
           {/* Added scrollbar styling classes - requires `tailwind-scrollbar` plugin */}
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700/50">
            {games.map(game => (
              <li key={game.id} className="bg-gray-700/50 p-4 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex-grow">
                  <div className="flex items-center text-sm text-gray-400 gap-2">
                    <span>Players: {game.playersNames.length > 0 ? game.playersNames.join(', ') : 'None'}</span>
                    <span className="text-gray-500">|</span>
                    <span className="flex items-center">Bet: {game.bet === 0 ? 'Free' : <>{game.bet} <img src="/images/assets/gem.png" alt="GEM" className="h-4 w-4 inline-block align-middle ml-1" /></>}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoinGame(game.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200 sm:w-auto mt-2 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={game.playersNames.length === 2}
                >
                  {game.playersNames.length === 2 ? 'Spectate' : 'Join Game'}
                </button>
              </li>
            ))}
            {games.length === 0 && (
              <li className="text-center text-gray-400 py-4">No games available</li>
            )}
          </ul>
        </div>

        {/* Column 3: Actions */}
        <div className="bg-gray-800/70 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col items-center gap-5">
          <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 self-stretch flex items-center justify-center gap-2">
            <span className="text-red-400 text-2xl">⚔️</span>
            Actions
          </h2>

          <Button
            onClick={() => setShowCreateModal(true)}
            variant="success"
            size="lg"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            }
            className="mb-2"
          >
            Create New Game
          </Button>

          <Button
            onClick={() => handleAction('open')}
            variant="gradient"
            size="lg"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
            }
          >
            Open to Fight
          </Button>
        </div>
      </div>

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 shadow-2xl w-full max-w-md flex flex-col gap-6">
            <h3 className="text-2xl font-semibold text-white text-center">Create Game</h3>

            <div className="space-y-4">
              {/* Free Play Option */}
              <label className="flex items-center gap-4 cursor-pointer bg-gray-700/50 hover:bg-gray-700 p-4 rounded-lg transition-colors duration-200">
                <input
                  type="radio"
                  name="betType"
                  value={0}
                  checked={betAmount === 0}
                  onChange={() => setBetAmount(0)}
                  className="form-radio h-5 w-5 text-green-500 bg-gray-600 border-gray-500 focus:ring-green-500 focus:ring-offset-gray-800"
                />
                <div>
                  <span className="font-medium text-white">Free Play</span>
                  {/* Replaced "GEM" text with image */}
                  <p className="text-gray-300 text-sm flex items-center">No <img src="/images/assets/gem.png" alt="GEM" className="h-4 w-4 inline-block align-middle mx-1" /> required to join</p>
                </div>
              </label>

              {/* GEM Bet Option */}
              <label className="flex items-start gap-4 cursor-pointer bg-gray-700/50 hover:bg-gray-700 p-4 rounded-lg transition-colors duration-200">
                <input
                  type="radio"
                  name="betType"
                  value={10} // Default value when selected, actual amount is in state
                  checked={betAmount > 0}
                  onChange={() => setBetAmount(10)} // Set initial bet amount when selected
                  className="form-radio h-5 w-5 text-blue-500 bg-gray-600 border-gray-500 focus:ring-blue-500 focus:ring-offset-gray-800 mt-1"
                />
                <div className="flex-grow">
                  <span className="font-medium text-white">Bet Game</span>
                   {/* Replaced "GEM" text with image */}
                  <p className="text-gray-300 text-sm mb-2 flex items-center">Set a <img src="/images/assets/gem.png" alt="GEM" className="h-4 w-4 inline-block align-middle mx-1" /> amount for players to join</p>

                  {/* Bet Amount Input (shown only when Bet Game is selected) */}
                  {betAmount > 0 && (
                    <div className="mt-2 flex items-center bg-gray-600/50 p-2 rounded-md">
                      <span className="text-blue-300 text-sm mr-2">Amount:</span>
                      <input
                        type="number"
                        min="1"
                        value={betAmount} // Controlled input
                        onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))} // Update state, ensure minimum 1
                        className="px-3 py-1.5 rounded bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-24"
                      />
                       {/* Replaced "GEM" text with image */}
                      <img src="/images/assets/gem.png" alt="GEM" className="h-5 w-5 ml-2" />
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex gap-4 mt-4">
              <button
                onClick={handleCreateGame}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-5 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold py-3 px-5 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Area */}
      {notification && (
        // Updated notification style
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {notification}
        </div>
      )}
    </div>
  );
};

export default Lobby;
