import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Sparkles, UserRound, WalletCards } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ArenaButton, Panel, StatusBadge } from '../components/ui/index.js';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, error, signInWithMetaMask, signInAsGuest } = useAuth();
  const [authMode, setAuthMode] = useState<'guest' | 'wallet' | null>(null);
  const [authError, setAuthError] = useState<string | null>(error);
  const authLoading = authMode !== null;

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
    setAuthMode('wallet');
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
      setAuthMode(null);
    }
  };

  const handleGuestLogin = async () => {
    setAuthMode('guest');
    setAuthError(null);

    try {
      const result = await signInAsGuest();
      if (!result.success) {
        setAuthError(result.error || 'Guest login failed');
      }
    } catch (error: any) {
      console.error('[Home] Guest authentication error:', error);
      setAuthError(error.message || 'Guest login failed');
    } finally {
      setAuthMode(null);
    }
  };

  if (loading) {
    return <div className="arena-page grid min-h-[calc(100vh-var(--navbar-height))] place-items-center text-slate-300">Loading authentication state...</div>;
  }

  return (
    <div className="arena-page arena-card-backdrop relative flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center overflow-hidden px-4 py-12 text-white">
      <div className="pointer-events-none absolute left-[6%] top-[22%] hidden h-56 w-40 -rotate-12 overflow-hidden rounded-2xl border border-violet-300/30 opacity-70 shadow-[0_0_48px_rgba(139,92,246,0.35)] lg:block">
        <img src="/images/beings/zhar-ptitsa.jpg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute right-[8%] top-[25%] hidden h-60 w-44 rotate-12 overflow-hidden rounded-2xl border border-amber-300/30 opacity-70 shadow-[0_0_48px_rgba(246,184,59,0.24)] lg:block">
        <img src="/images/spells/aerial3.jpg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute bottom-[14%] right-[18%] hidden h-44 w-32 -rotate-6 overflow-hidden rounded-2xl border border-cyan-300/30 opacity-60 shadow-[0_0_38px_rgba(34,211,238,0.24)] xl:block">
        <img src="/images/beings/kappa.jpg" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">
        <StatusBadge tone="violet" className="mb-5">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Digital Card Arena
        </StatusBadge>
        <Panel glow className="w-full max-w-2xl px-6 py-8 sm:px-10 sm:py-10">
          <img src="/logos/logo-primary-dark.png" alt="Wisdom Duel" className="mx-auto mb-6 h-20 w-auto object-contain opacity-95 sm:h-24" />
          <h1 className="font-display text-4xl font-black text-slate-50 sm:text-6xl">
            Welcome to Wisdom Duel
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Collect powerful cards, command legendary beings, and battle for control of the arena.
          </p>

          {!user && (
            <>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <ArenaButton
                  type="button"
                  onClick={handleGuestLogin}
                  loading={authMode === 'guest'}
                  disabled={authLoading}
                  size="lg"
                  icon={<UserRound className="h-5 w-5" aria-hidden />}
                  fullWidth
                >
                  {authMode === 'guest' ? 'Entering...' : 'Continue as Guest'}
                </ArenaButton>

                <ArenaButton
                  type="button"
                  onClick={handleConnectWallet}
                  loading={authMode === 'wallet'}
                  disabled={authLoading}
                  variant="secondary"
                  size="lg"
                  icon={<WalletCards className="h-5 w-5" aria-hidden />}
                  fullWidth
                >
                  {authMode === 'wallet' ? 'Connecting...' : 'Connect MetaMask'}
                </ArenaButton>
              </div>

              <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-slate-400 sm:flex-row">
                <ShieldCheck className="h-4 w-4 text-cyan-200" aria-hidden />
                <span>No wallet? No problem. Play instantly.</span>
                <span className="hidden text-slate-600 sm:inline">|</span>
                <span className="text-cyan-200">No gas required for wallet sign-in.</span>
              </div>

              {authError && (
                <div className="mt-6 rounded-2xl border border-red-300/35 bg-red-500/10 p-4 text-sm text-red-100">
                  {authError}
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default Home;
