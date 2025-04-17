import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Mock Data (Keep simple for styling)
const mockUsers = [
  { id: 1, name: 'Zephyr', avatar: '/images/assets/asia.svg' },
  { id: 2, name: 'Luna', avatar: '/images/assets/europe.svg' },
  { id: 3, name: 'Roric', avatar: '/images/assets/africa.svg' },
  { id: 4, name: 'You', avatar: '/images/assets/america.svg' }, // Represent the current player
];
const mockGames = [
  { id: 'g1', creator: 'Zephyr', bet: 0, type: 'Free Play' },
  { id: 'g2', creator: 'Roric', bet: 10, type: '10 GEM' },
];

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const handleAction = (action: 'create' | 'join' | 'open') => {
    // For MVP, all lead to NFT selection
    navigate('/nft-selection');
  };

  const handleSpectate = () => {
    setNotification('Spectator mode coming soon!');
    setTimeout(() => setNotification(null), 3000); // Auto-hide notification
  };

  const handleCreateGame = () => {
    setShowCreateModal(false);
    // Add logic to actually create the game with betAmount
    handleAction('create');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold text-center text-yellow-400 mb-8">Game Lobby</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* Column 1: Connected Users */}
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Online Players</h2>
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {mockUsers.map(user => (
              <li key={user.id} className="flex items-center gap-3 bg-gray-700 p-2 rounded">
                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-gray-600" />
                <span className="font-medium">{user.name}</span>
                {user.name === 'You' && <span className="text-xs text-green-400 ml-auto">(You)</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: Open Games */}
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Open Games</h2>
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {mockGames.map(game => (
              <li key={game.id} className="flex items-center justify-between gap-3 bg-gray-700 p-3 rounded">
                <div>
                  <span className="font-medium">{game.creator}</span>
                  <span className={`block text-xs ${game.bet > 0 ? 'text-blue-400' : 'text-gray-400'}`}>{game.type}</span>
                </div>
                <button
                  onClick={() => handleAction('join')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1 rounded transition"
                >
                  Join
                </button>
              </li>
            ))}
            {mockGames.length === 0 && (
              <li className="text-gray-500 text-center py-4">No open games available.</li>
            )}
          </ul>
        </div>

        {/* Column 3: Actions */}
        <div className="bg-gray-800 p-4 rounded-lg shadow-md flex flex-col gap-4">
          <h2 className="text-xl font-semibold mb-2 border-b border-gray-700 pb-2">Actions</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded transition"
          >
            Create New Game
          </button>
          <button
            onClick={() => handleAction('open')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded transition"
          >
            Set Status: Open to Fight
          </button>
          <button
            onClick={handleSpectate}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded transition"
          >
            Watch a Game (Spectate)
          </button>
        </div>
      </div>

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-sm flex flex-col gap-5">
            <h3 className="text-xl font-semibold text-yellow-400">Create Game Settings</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="betType" value={0} checked={betAmount === 0} onChange={() => setBetAmount(0)} className="form-radio h-4 w-4 text-green-500 bg-gray-700 border-gray-600" />
              Free Play
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="betType" value={10} checked={betAmount > 0} onChange={() => setBetAmount(10)} className="form-radio h-4 w-4 text-blue-500 bg-gray-700 border-gray-600" />
              GEM Bet
              {betAmount > 0 && (
                <input
                  type="number"
                  min="1"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="ml-2 w-20 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </label>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreateGame} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition">
                Create
              </button>
              <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Area */}
      {notification && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-semibold px-6 py-3 rounded-md shadow-lg z-50">
          {notification}
        </div>
      )}
    </div>
  );
};

export default Lobby;
