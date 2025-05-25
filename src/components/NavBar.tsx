import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const NavBar: React.FC = () => {
  const { user, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/'; // Redirect to home page after sign out
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Format ETH address for display
  const formatAddress = (ethAddress: string | null) => {
    if (!ethAddress) return '';
    return `${ethAddress.substring(0, 6)}...${ethAddress.substring(ethAddress.length - 4)}`;
  };

  // Get ETH address from user metadata
  const ethAddress = user?.user_metadata?.eth_address;

  return (
    <nav className="bg-gray-800 bg-opacity-80 backdrop-blur-sm text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-30">
      <div className="flex items-center space-x-6">
        <Link to="/lobby" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300 hover:opacity-80 transition-opacity">
          Mythical Arena
        </Link>
        <div className="hidden md:flex items-center space-x-4">
          <Link to="/lobby" className="text-gray-300 hover:text-white transition-colors">Lobby</Link>
          <Link to="/how-to-play" className="text-gray-300 hover:text-white transition-colors">How to Play</Link>
          <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors">Leaderboard</Link>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {loading ? (
          <div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>
        ) : (
          <>
            {!user ? (
              <Link to="/">
                <button className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200">
                  Connect Wallet
                </button>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">
                  {formatAddress(ethAddress)}
                </span>
                <button 
                  onClick={handleSignOut}
                  className="text-gray-300 hover:text-white text-sm"
                >
                  Sign Out
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="md:hidden flex flex-col items-center space-y-1 mt-2 border-t border-gray-700 pt-2">
          <Link to="/lobby" className="text-gray-300 hover:text-white transition-colors text-sm">Lobby</Link>
          <Link to="/how-to-play" className="text-gray-300 hover:text-white transition-colors text-sm">How to Play</Link>
          <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors text-sm">Leaderboard</Link>
      </div>
    </nav>
  );
};

export default NavBar;