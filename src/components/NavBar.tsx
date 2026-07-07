import { Link, NavLink } from 'react-router-dom';
import { BookOpen, Home, LogIn, LogOut, Swords, Trophy, User, UserCircle, WalletCards } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { cn } from './ui/index.js';
import { formatAddress } from '../utils/format.js';

const NavBar: React.FC = () => {
  const { user, profile, polygonWallet, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/'; // Redirect to home page after sign out
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const displayName = profile?.display_name ?? profile?.username;
  const identity = polygonWallet
    ? formatAddress(polygonWallet.address)
    : user?.isGuest
      ? 'Guest'
      : displayName || user?.email || 'Player';

  const navItems = user
    ? [
        ...(polygonWallet ? [{ to: '/lobby', label: 'Lobby', icon: Swords }] : []),
        { to: '/how-to-play', label: 'How to Play', icon: BookOpen },
        { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
        ...(polygonWallet ? [{ to: '/profile', label: 'Profile', icon: User }] : []),
      ]
    : [
        { to: '/', label: 'Home', icon: Home },
        { to: '/how-to-play', label: 'How to Play', icon: BookOpen },
      ];

  const navClass = ({ isActive }: { isActive: boolean }) => cn(
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-normal transition',
    isActive
      ? 'border border-violet-300/35 bg-violet-500/15 text-violet-100'
      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white',
  );

  return (
    <nav className="sticky top-0 z-40 flex h-[var(--navbar-height)] items-center justify-between border-b border-white/10 bg-[#060912]/88 px-4 text-white shadow-[0_18px_36px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-5">
        <Link to={user ? '/lobby' : '/'} className="group flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-300/30 bg-violet-500/10 shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
            <img src="/logos/logo-header-dark.png" alt="Wisdom Duel" className="h-7 w-7 object-contain opacity-90 transition group-hover:opacity-100" />
          </span>
          <span className="hidden min-w-0 flex-col leading-none sm:flex">
            <span className="font-display text-lg font-bold uppercase text-slate-100">Wisdom</span>
            <span className="text-[10px] font-bold uppercase tracking-normal text-violet-300">Duel</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={navClass}>
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-9 w-32 animate-pulse rounded-xl bg-white/10" />
        ) : (
          <>
            {!user ? (
              <Link to="/">
                <button className="inline-flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-sm font-bold uppercase tracking-normal text-amber-100 transition hover:bg-amber-400/20">
                  <LogIn className="h-4 w-4" aria-hidden />
                  Sign In
                </button>
              </Link>
            ) : polygonWallet ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                <Link to="/profile" className="hidden items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-200 transition hover:bg-white/[0.06] md:flex">
                  <UserCircle className="h-4 w-4 text-cyan-200" aria-hidden />
                  Profile
                </Link>
                <span className="max-w-[150px] truncate rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 font-mono text-xs text-cyan-100">
                  {identity}
                </span>
                <button 
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-normal text-slate-300 transition hover:bg-red-500/12 hover:text-red-100"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-500/[0.08] px-2 py-1.5">
                <Link to="/" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold uppercase tracking-normal text-amber-100 transition hover:bg-white/[0.06]">
                  <WalletCards className="h-4 w-4" aria-hidden />
                  Link Wallet
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-normal text-slate-300 transition hover:bg-red-500/12 hover:text-red-100"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign Out
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#060912]/90 px-2 py-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('rounded-full p-2 text-slate-300 transition', isActive ? 'bg-violet-500/20 text-violet-100' : 'hover:bg-white/[0.06] hover:text-white')} aria-label={item.label}>
              <Icon className="h-4 w-4" aria-hidden />
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default NavBar;
