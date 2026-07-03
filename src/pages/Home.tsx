import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ArenaButton, Input, Panel, StatusBadge } from '../components/ui/index.js';

function formatCooldown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    profile,
    polygonWallet,
    loading,
    error,
    magicLinkSentTo,
    magicLinkCooldownUntil,
    signInWithGoogle,
    signInWithPlayHubEmail,
    connectPolygonWallet,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [authMode, setAuthMode] = useState<'google' | 'email' | 'polygon' | null>(null);
  const [authError, setAuthError] = useState<string | null>(error);
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const authLoading = authMode !== null;
  const magicLinkCooldownSeconds = magicLinkCooldownUntil
    ? Math.max(0, Math.ceil((magicLinkCooldownUntil - now) / 1000))
    : 0;
  const magicLinkCoolingDown = magicLinkCooldownSeconds > 0;

  useEffect(() => {
    if (!loading && user && polygonWallet) {
      navigate('/lobby');
    }
    if (error) {
      setAuthError(error);
    }
  }, [user, polygonWallet, loading, navigate, error]);

  useEffect(() => {
    if (!magicLinkCooldownUntil) return;

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [magicLinkCooldownUntil]);

  const handleGoogleLogin = async () => {
    if (authLoading) return;

    setAuthMode('google');
    setAuthError(null);

    try {
      await signInWithGoogle();
    } catch (error: any) {
      setAuthError(error.message || 'Could not start Google sign-in.');
      setAuthMode(null);
    }
  };

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authLoading || magicLinkCoolingDown) return;

    setAuthMode('email');
    setAuthError(null);

    try {
      await signInWithPlayHubEmail(email);
    } catch (error: any) {
      setAuthError(error.message || 'Could not send Play Hub login link.');
    } finally {
      setAuthMode(null);
    }
  };

  const handleConnectPolygon = async () => {
    setAuthMode('polygon');
    setAuthError(null);

    try {
      await connectPolygonWallet();
    } catch (error: any) {
      setAuthError(error.message || 'Could not link Polygon wallet.');
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

          {!user ? (
            <div className="mt-8 space-y-4">
              <ArenaButton
                type="button"
                onClick={handleGoogleLogin}
                loading={authMode === 'google'}
                disabled={authLoading}
                size="lg"
                icon={<LogIn className="h-5 w-5" aria-hidden />}
                fullWidth
              >
                {authMode === 'google' ? 'Redirecting...' : 'Continue with Google'}
              </ArenaButton>

              <button
                type="button"
                onClick={() => setShowEmailFallback((visible) => !visible)}
                className="text-sm font-bold uppercase tracking-wide text-slate-400 transition hover:text-cyan-100"
              >
                {showEmailFallback ? 'Hide email link' : 'Use email link'}
              </button>

              {showEmailFallback && (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <label htmlFor="playhub-email" className="sr-only">Play Hub email</label>
                  <Input
                    id="playhub-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="player@example.com"
                    autoComplete="email"
                    required
                  />
                  <ArenaButton
                    type="submit"
                    loading={authMode === 'email'}
                    disabled={authLoading || magicLinkCoolingDown}
                    variant="ghost"
                    size="lg"
                    icon={<Mail className="h-5 w-5" aria-hidden />}
                    fullWidth
                  >
                    {authMode === 'email'
                      ? 'Sending...'
                      : magicLinkCoolingDown
                        ? `Resend in ${formatCooldown(magicLinkCooldownSeconds)}`
                        : magicLinkSentTo
                          ? 'Resend Play Hub link'
                          : 'Send email link'}
                  </ArenaButton>
                </form>
              )}

              {magicLinkSentTo && showEmailFallback && (
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" aria-live="polite">
                  Login link sent to {magicLinkSentTo}.
                  {magicLinkCoolingDown && (
                    <span className="block pt-1 text-emerald-100/80">
                      Resend available in {formatCooldown(magicLinkCooldownSeconds)}.
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : !polygonWallet ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                Signed in as {profile?.display_name || profile?.username || user.email || 'Play Hub player'}.
              </div>
              <ArenaButton
                type="button"
                onClick={handleConnectPolygon}
                loading={authMode === 'polygon'}
                disabled={authLoading}
                size="lg"
                icon={<WalletCards className="h-5 w-5" aria-hidden />}
                fullWidth
              >
                {authMode === 'polygon' ? 'Linking...' : 'Link Polygon Wallet'}
              </ArenaButton>
            </div>
          ) : null}

          {(!user || (user && !polygonWallet)) && (
            <>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-slate-400 sm:flex-row">
                <ShieldCheck className="h-4 w-4 text-cyan-200" aria-hidden />
                <span>Play Hub identity is required.</span>
                <span className="hidden text-slate-600 sm:inline">|</span>
                <span className="text-cyan-200">Polygon wallet linking unlocks the arena.</span>
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
