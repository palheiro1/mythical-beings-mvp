import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Mail, ShieldCheck, WalletCards } from 'lucide-react';
import TrainingLanding from '../components/training/TrainingLanding.js';
import { useAuth } from '../hooks/useAuth.js';
import { ArenaButton, Input, Panel } from '../components/ui/index.js';
import { TRAINING_PREVIEW_ENABLED } from '../config/release.js';

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
  const location = useLocation();
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
  const [showSignInOptions, setShowSignInOptions] = useState(location.hash === '#account');
  useEffect(() => { if (location.hash === '#account') setShowSignInOptions(true); }, [location.hash]);
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const authLoading = authMode !== null;
  const magicLinkCooldownSeconds = magicLinkCooldownUntil
    ? Math.max(0, Math.ceil((magicLinkCooldownUntil - now) / 1000))
    : 0;
  const magicLinkCoolingDown = magicLinkCooldownSeconds > 0;

  useEffect(() => {
    if (!TRAINING_PREVIEW_ENABLED && !loading && user && polygonWallet) {
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

  const accountPanel = (
<div className="mt-5 space-y-4">
              {!user ? (
                <div className="border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSignInOptions((visible) => !visible)}
                    className="min-h-11 rounded-lg px-3 text-sm font-bold uppercase tracking-normal text-cyan-200 transition hover:bg-white/[0.05] hover:text-cyan-100"
                    aria-expanded={showSignInOptions}
                  >
                    {showSignInOptions ? 'Hide Play Hub sign-in' : 'Optional: sign in to Play Hub'}
                  </button>

                  {showSignInOptions && (
                    <div className="mt-4 space-y-4">
                      <ArenaButton
                        type="button"
                        onClick={handleGoogleLogin}
                        loading={authMode === 'google'}
                        disabled={authLoading || loading}
                        variant="ghost"
                        size="lg"
                        icon={<LogIn className="h-5 w-5" aria-hidden />}
                        fullWidth
                      >
                        {authMode === 'google' ? 'Redirecting...' : loading ? 'Checking Play Hub session...' : 'Continue with Google'}
                      </ArenaButton>

                      <button
                        type="button"
                        onClick={() => setShowEmailFallback((visible) => !visible)}
                        className="min-h-11 rounded-lg px-3 text-sm font-bold uppercase tracking-normal text-slate-300 transition hover:bg-white/[0.05] hover:text-cyan-100"
                        aria-expanded={showEmailFallback}
                      >
                        {showEmailFallback ? 'Hide email link' : 'Use email link'}
                      </button>

                      {showEmailFallback && (
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                          <label htmlFor="playhub-email-preview" className="sr-only">Play Hub email</label>
                          <Input
                            id="playhub-email-preview"
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
                            disabled={authLoading || magicLinkCoolingDown || loading}
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
                        <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" aria-live="polite">
                          Login link sent to {magicLinkSentTo}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Signed in as {profile?.display_name || profile?.username || user.email || 'Play Hub player'}. {polygonWallet ? 'Polygon wallet linked.' : 'No wallet is needed for training.'}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <ShieldCheck className="h-4 w-4 text-cyan-200" aria-hidden />
                <span>Solo training does not affect rankings or award competitive rewards.</span>
              </div>

              {authError && showSignInOptions && (
                <div className="rounded-xl border border-red-300/35 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
                  {authError}
                </div>
              )}
            </div>
  );

  if (TRAINING_PREVIEW_ENABLED) return <TrainingLanding>{accountPanel}</TrainingLanding>;

  return (
    <div className="arena-page flex min-h-[calc(100dvh-var(--navbar-height))] items-center justify-center p-6 text-white">
      <Panel className="w-full max-w-2xl p-8 text-center">
        <h1 className="font-display text-4xl">Welcome to Wisdom Duel</h1>
        <p className="mt-4 text-slate-300">Collect powerful cards, command legendary beings, and battle for control of the arena.</p>
          {!TRAINING_PREVIEW_ENABLED && (!user ? (
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
                className="text-sm font-bold uppercase tracking-normal text-slate-400 transition hover:text-cyan-100"
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
                <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" aria-live="polite">
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
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4 text-sm text-cyan-100">
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
          ) : null)}

          {!TRAINING_PREVIEW_ENABLED && (!user || (user && !polygonWallet)) && (
            <>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-slate-400 sm:flex-row">
                <ShieldCheck className="h-4 w-4 text-cyan-200" aria-hidden />
                <span>Play Hub identity is required.</span>
                <span className="hidden text-slate-600 sm:inline">|</span>
                <span className="text-cyan-200">
                  Polygon wallet linking unlocks {TRAINING_PREVIEW_ENABLED ? 'training' : 'the arena'}.
                </span>
              </div>

              {authError && (
                <div className="mt-6 rounded-xl border border-red-300/35 bg-red-500/10 p-4 text-sm text-red-100">
                  {authError}
                </div>
              )}
            </>
          )}

      </Panel>
    </div>
  );
};

export default Home;
