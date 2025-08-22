import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, error, signInWithMetaMask } = useAuth();
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(error);

  useEffect(() => {
    if (!loading && user) {
      console.log('[Home] User already logged in, redirecting to /lobby');
      navigate('/lobby');
    }
    if (error) {
      setAuthError(error);
    }
  }, [user, loading, navigate, error]);

  const handleConnectWallet = async () => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const result = await signInWithMetaMask();
      if (result.success) {
        console.log('[Home] Successfully authenticated with MetaMask');
        // Navigation will happen automatically via useEffect when user state updates
      } else {
        setAuthError(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('[Home] Authentication error:', error);
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center p-10">Loading authentication state...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
  <img src="/images/banner.png" alt="Mythical Beings" className="w-full max-w-xl h-auto mb-6 rounded-lg shadow-xl object-contain max-h-40 sm:max-h-48 md:max-h-56 lg:max-h-64" />
      <h1 className="text-4xl font-bold mb-2">Welcome to Mythical Beings</h1>
      
      {!user && (
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
          
          {authError && (
            <div className="mt-4 bg-red-600/20 border border-red-600 text-red-100 p-3 rounded-md">
              {authError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
