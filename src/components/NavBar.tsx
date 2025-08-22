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
    <nav className="bg-gradient-to-r from-gray-950/90 via-gray-900/80 to-gray-950/90 backdrop-blur-xl text-white px-4 py-2 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.7)] border-b border-white/10 flex justify-between items-center sticky top-0 z-30">
      <div className="flex items-center gap-4 min-w-0">
        <Link to="/lobby" className="flex items-center gap-2 group">
          <img src="/images/banner.png" alt="Mythical Beings" className="h-6 w-auto opacity-90 group-hover:opacity-100 transition-opacity" />
          <span className="hidden sm:inline text-lg font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-200 to-cyan-300 group-hover:from-purple-200 group-hover:to-cyan-200">Mythical Arena</span>
        </Link>
        <div className="hidden md:flex items-center gap-3 text-sm font-medium">
          <Link to="/lobby" className="text-gray-300 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5">Lobby</Link>
          <Link to="/how-to-play" className="text-gray-300 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5">How to Play</Link>
          <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5">Leaderboard</Link>
          {user && (
            <Link to="/profile" className="text-gray-300 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5">Profile</Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>
        ) : (
          <>
            {!user ? (
              <Link to="/">
                <button className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold py-1.5 px-3 rounded-md transition-all duration-200 shadow-sm hover:shadow-purple-500/20">
                  Connect Wallet
                </button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="text-xs text-gray-300 hover:text-white underline-offset-2 hover:underline">Profile</Link>
                <span className="text-sm font-mono bg-white/5 border border-white/10 px-2 py-1 rounded">
                  {formatAddress(ethAddress)}
                </span>
                <button 
                  onClick={handleSignOut}
                  className="text-gray-300 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/5"
                >
                  Sign Out
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Mobile quick links row (hidden on md+) */}
      <div className="md:hidden fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 shadow-lg z-30">
        <Link to="/lobby" className="text-gray-300 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/5">Lobby</Link>
        <Link to="/leaderboard" className="text-gray-300 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/5">Top</Link>
        <Link to="/how-to-play" className="text-gray-300 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/5">Rules</Link>
        {user && <Link to="/profile" className="text-gray-300 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/5">Profile</Link>}
      </div>
    </nav>
  );
};

export default NavBar;