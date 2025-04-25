import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../utils/supabase'; // Assuming getProfile fetches username/avatar

interface UserProfileInfo {
  username: string | null;
  avatar_url: string | null;
}

const NavBar: React.FC = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfileInfo>({ username: null, avatar_url: null });
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchUserProfile = async () => {
      if (user) {
        setLoadingProfile(true);
        try {
          const profile = await getProfile(user.id);
          if (isMounted && profile) {
            setUserProfile({
              username: profile.username || `User (${user.id.substring(0, 6)})`,
              avatar_url: profile.avatar_url,
            });
          } else if (isMounted) {
             setUserProfile({ username: `User (${user.id.substring(0, 6)})`, avatar_url: null });
          }
        } catch (error) {
          console.error('[NavBar] Error fetching profile:', error);
           if (isMounted) {
             setUserProfile({ username: `User (${user.id.substring(0, 6)})`, avatar_url: null });
           }
        } finally {
          if (isMounted) {
            setLoadingProfile(false);
          }
        }
      } else {
         if (isMounted) {
            setLoadingProfile(false); // Not logged in, profile loading finished
            setUserProfile({ username: null, avatar_url: null }); // Reset profile
         }
      }
    };

    if (!authLoading) {
        fetchUserProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]); // Re-fetch when user or authLoading changes

  const handleSignOut = async () => {
    await signOut();
    navigate('/'); // Redirect to home after sign out
  };

  const isLoading = authLoading || loadingProfile;

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
        {isLoading ? (
          <div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>
        ) : user && userProfile.username ? (
          <>
            <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <img
                width={32}
                height={32}
                src={
                  userProfile.avatar_url
                    ? userProfile.avatar_url
                    : `/api/placeholder-avatar?text=${userProfile.username.charAt(0).toUpperCase()}`
                }
                alt="User Avatar"
                className="h-8 w-8 rounded-full object-cover border border-gray-500"
              />
              <span className="text-sm font-medium hidden sm:inline">{userProfile.username}</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            to="/"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200"
          >
            Login
          </Link>
        )}
      </div>
      {/* Mobile Menu Links (Optional) */}
      <div className="md:hidden flex flex-col items-center space-y-1 mt-2 border-t border-gray-700 pt-2">
          <Link to="/lobby" className="text-gray-300 hover:text-white transition-colors text-sm">Lobby</Link>
          <Link to="/how-to-play" className="text-gray-300 hover:text-white transition-colors text-sm">How to Play</Link>
          <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors text-sm">Leaderboard</Link>
      </div>
    </nav>
  );
};

export default NavBar;