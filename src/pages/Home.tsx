import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const navigate = useNavigate();

  const handleConnect = () => {
    // Simulate wallet connection
    setConnected(true);
    const mockAccount = '0x' + Math.random().toString(16).substring(2, 12);
    setAccount(mockAccount);
    // Navigate after a short delay
    setTimeout(() => navigate('/lobby'), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white p-4">
      <div className="relative z-10 bg-black/50 backdrop-blur-sm p-10 rounded-lg shadow-xl max-w-md w-full flex flex-col items-center">
        <div className="flex flex-col items-center justify-center text-center mb-8 w-full">
          <h1 className="text-4xl font-bold text-white mb-3">Mythical Beings</h1>
          <p className="text-white">Connect your wallet to enter the arena.</p>
        </div>

        {!connected ? (
          <button
            onClick={handleConnect}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3 p-4 bg-gray-700/70 rounded-md w-full text-center">
            <span className="text-white font-medium" style={{color: 'white'}}>Wallet Connected!</span>
            <span className="text-sm text-white font-mono bg-gray-800/80 px-3 py-1 rounded w-full text-center" style={{color: 'white'}}>
              {account}
            </span>
            <span className="text-sm text-white mt-2 animate-pulse" style={{color: 'white'}}>Redirecting to Lobby...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
