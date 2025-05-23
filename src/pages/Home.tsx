import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerIdentification } from '../hooks/usePlayerIdentification.js';
import { authenticateWithMoralis } from '../utils/wallet.js';
import { supabase } from '../utils/supabase.js';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [playerId, user, loading, authError] = usePlayerIdentification();
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(authError);

  useEffect(() => {
    if (!loading && playerId) {
      console.log('[Home] User already logged in, redirecting to /lobby');
      navigate('/lobby');
    }
    if (authError) {
      setError(authError);
    }
  }, [playerId, loading, navigate, authError]);

  const handleConnectWallet = async () => {
    setAuthLoading(true);
    setError(null);
    
    try {
      const { user, address } = await authenticateWithMoralis();
      console.log('[Home] Successfully authenticated with wallet:', address);
      console.log('[Home] User profile:', user);
      
      // Force a manual refresh of authentication state to ensure the hook picks up the new session
      await supabase.auth.refreshSession();
      
      // Even if supabase.auth.getUser() fails, we can use our fallback mechanism      
      try {
        const { data } = await supabase.auth.getUser();
        console.log('[Home] Current supabase user after auth:', data?.user);
      } catch (userError) {
        console.warn('[Home] Could not get user from Supabase, using fallback:', userError);
      }
      
      // Store the user data in localStorage as a backup
      localStorage.setItem('mythical_beings_user', JSON.stringify(user));
      
      // Manual navigation - don't rely solely on the useEffect since we have workarounds
      navigate('/lobby');
    } catch (err) {
      console.error('[Home] Wallet authentication error:', err);
      setError(err instanceof Error ? err.message : 'Failed to authenticate with wallet');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center p-10">Loading authentication state...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <img src="/images/assets/LogoXogoBrancoTransparenteEN.png" alt="Mythical Beings Logo" className="w-1/3 h-auto mb-8" />
      <h1 className="text-4xl font-bold mb-2">Welcome to Mythical Beings</h1>
      
      {!playerId && (
        <div className="text-center">
          <p className="text-lg text-gray-300 mb-8">Connect your wallet to enter the world of Mythical Beings!</p>
          
          <button
            onClick={handleConnectWallet}
            disabled={authLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors 
                      flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
          
          {error && (
            <div className="mt-4 bg-red-600/20 border border-red-600 text-red-100 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
