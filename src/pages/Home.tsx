import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, Bot, FlaskConical, LogIn, Mail, ShieldCheck, Sparkles, Trophy, WalletCards } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ArenaButton, Input, Panel, StatusBadge } from '../components/ui/index.js';
import {
  CHAMPIONSHIP_MESSAGE,
  TRAINING_PREVIEW_ENABLED,
  TRAINING_PREVIEW_LABEL,
} from '../config/release.js';

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
  const [showSignInOptions, setShowSignInOptions] = useState(false);
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

  return (
    <div className="arena-page arena-card-backdrop relative flex min-h-[calc(100vh-var(--navbar-height))] items-center justify-center overflow-hidden px-4 py-12 text-white">
      <div className="pointer-events-none absolute left-[6%] top-[22%] hidden h-56 w-40 -rotate-12 overflow-hidden rounded-xl border border-violet-300/25 opacity-70 shadow-[0_24px_54px_rgba(0,0,0,0.42)] lg:block">
        <img src="/images/beings/zhar-ptitsa.webp" srcSet="/images/beings/zhar-ptitsa-360.webp 360w, /images/beings/zhar-ptitsa.webp 720w" sizes="160px" alt="" width="720" height="951" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute right-[8%] top-[25%] hidden h-60 w-44 rotate-12 overflow-hidden rounded-xl border border-amber-300/25 opacity-70 shadow-[0_24px_54px_rgba(0,0,0,0.42)] lg:block">
        <img src="/images/spells/aerial3.webp" srcSet="/images/spells/aerial3-360.webp 360w, /images/spells/aerial3.webp 720w" sizes="176px" alt="" width="720" height="951" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute bottom-[14%] right-[18%] hidden h-44 w-32 -rotate-6 overflow-hidden rounded-xl border border-cyan-300/25 opacity-60 shadow-[0_20px_44px_rgba(0,0,0,0.38)] xl:block">
        <img src="/images/beings/kappa.webp" srcSet="/images/beings/kappa-360.webp 360w, /images/beings/kappa.webp 720w" sizes="128px" alt="" width="720" height="951" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">
        <StatusBadge tone={TRAINING_PREVIEW_ENABLED ? 'amber' : 'violet'} className="mb-5">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {TRAINING_PREVIEW_ENABLED ? TRAINING_PREVIEW_LABEL : 'Digital Card Arena'}
        </StatusBadge>
        <Panel glow className="w-full max-w-2xl px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center overflow-hidden rounded-xl border border-amber-200/25 bg-black/30 sm:h-24 sm:w-24">
            <img src="/logos/logo-header-dark.webp" alt="Wisdom Duel" width="520" height="388" className="h-16 w-16 object-contain opacity-95 sm:h-20 sm:w-20" />
          </div>
          <h1 className="font-display text-4xl font-black text-slate-50 sm:text-6xl">
            {TRAINING_PREVIEW_ENABLED ? 'Train for Wisdom Duel' : 'Welcome to Wisdom Duel'}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            {TRAINING_PREVIEW_ENABLED
              ? 'Learn the rules, test card combinations, and refine your strategy against the bot before the multiplayer arena opens.'
              : 'Collect powerful cards, command legendary beings, and battle for control of the arena.'}
          </p>

          {TRAINING_PREVIEW_ENABLED && (
            <div className="mt-6 space-y-2">
              <ArenaButton
                type="button"
                onClick={() => navigate('/bot-selection')}
                size="lg"
                icon={<Bot className="h-5 w-5" aria-hidden />}
                fullWidth
              >
                Start Training — No Sign-In
              </ArenaButton>
              <p className="text-sm text-slate-400">Your training match runs locally in this browser. A Play Hub account and Polygon wallet are optional.</p>
            </div>
          )}

          {TRAINING_PREVIEW_ENABLED && (
            <>
              <div className="mt-6 grid gap-2 text-left sm:grid-cols-3">
                {[
                  { icon: BookOpenCheck, label: 'Learn the rules' },
                  { icon: FlaskConical, label: 'Test strategies' },
                  { icon: Trophy, label: 'Prepare to compete' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                    <Icon className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-amber-300/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100">
                <p className="font-bold">This preview is training-only.</p>
                <p className="mt-1 text-amber-100/75">{CHAMPIONSHIP_MESSAGE}</p>
              </div>
            </>
          )}

          {TRAINING_PREVIEW_ENABLED && (
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
          )}

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
    </div>
  );
};

export default Home;
