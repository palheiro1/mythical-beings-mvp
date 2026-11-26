import { lazy, Suspense, useEffect } from 'react';
import { analytics } from './analytics/productAnalytics.js';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.js';
import { CardRegistryProvider } from './context/CardRegistry.js';
import Home from './pages/Home.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import NavBar from './components/NavBar.js';
import { SpinnerEmblem } from './components/ui/index.js';
import { CASUAL_DUELS_ENABLED, PVP_ENABLED, WEEKLY_CHALLENGE_ENABLED } from './config/release.js';
import { duelLobbyPath } from './game/duelInvitation.js';

// Moralis is now initialized in main.tsx to ensure polyfills are loaded first

const CompetitiveHub = lazy(() => import('./pages/CompetitiveHub.js'));
const WeeklyChallenge = lazy(() => import('./pages/WeeklyChallenge.js'));
const LeagueQueue = lazy(() => import('./pages/LeagueQueue.js'));
const WagerLobby = lazy(() => import('./pages/WagerLobby.js'));
const CasualDuels = lazy(() => import('./pages/CasualDuels.js'));
const CompetitiveMatch = lazy(() => import('./pages/CompetitiveMatch.js'));
const CompetitiveReplay = lazy(() => import('./pages/CompetitiveReplay.js'));
const LeagueStandings = lazy(() => import('./pages/LeagueStandings.js'));
const LeagueAdmin = lazy(() => import('./pages/LeagueAdmin.js'));
const TrainingSelection = lazy(() => import('./pages/TrainingSelection.js'));
const BotGame = lazy(() => import('./pages/BotGame.js'));
const ProfilePage = lazy(() => import('./pages/Profile.js'));
const HowToPlay = lazy(() => import('./pages/HowToPlay.js'));
const NotFound = lazy(() => import('./pages/NotFound.js'));

function RouteScrollReset() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname, search, hash]);
  return null;
}

function WagerEntry() {
  const [params] = useSearchParams();
  if (CASUAL_DUELS_ENABLED && params.get('mode') === 'casual') {
    return <Navigate to={duelLobbyPath(params.get('join'))} replace />;
  }
  return PVP_ENABLED ? <ProtectedRoute /> : <Navigate to="/" replace />;
}

function AppContent() {
  useEffect(() => { analytics().setPage(location.pathname, false); }, []);
  return (
    <Router>
      <RouteScrollReset />
      <a href="#main-content" className="sr-only fixed left-3 top-3 z-[100] rounded-lg bg-amber-300 px-4 py-3 font-bold text-slate-950 focus:not-sr-only">
        Skip to main content
      </a>
      <NavBar />
      <main id="main-content" tabIndex={-1}>
        <Suspense
          fallback={
            <div className="arena-page grid min-h-[calc(100vh-var(--navbar-height))] place-items-center p-6 text-white">
              <SpinnerEmblem label="Loading arena..." />
            </div>
          }
        >
          <Routes>
          {/* Public Route */}
          <Route path="/" element={<Home />} />
          <Route path="/how-to-play" element={<HowToPlay />} />
          <Route path="/bot-selection" element={<TrainingSelection />} />
          <Route path="/bot-game" element={<BotGame />} />
          <Route path="/leaderboard" element={<Navigate to="/standings" replace />} />
          <Route path="/standings" element={<LeagueStandings />} />
          <Route path="/competition" element={PVP_ENABLED ? <CompetitiveHub /> : <Navigate to={WEEKLY_CHALLENGE_ENABLED ? '/challenge' : '/'} replace />} />
          {WEEKLY_CHALLENGE_ENABLED ? <Route path="/challenge" element={<WeeklyChallenge />} /> : null}
          {CASUAL_DUELS_ENABLED ? <Route path="/duels" element={<CasualDuels />} /> : null}
          {CASUAL_DUELS_ENABLED ? <Route path="/duels/public" element={<CasualDuels publicLobby />} /> : null}
          <Route path="/wagers" element={<WagerEntry />}>
            <Route index element={<WagerLobby />} />
          </Route>
          {/* Handle legacy/auth callback route by redirecting to lobby */}
          <Route path="/auth" element={<Navigate to="/lobby" replace />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<Navigate to={PVP_ENABLED || WEEKLY_CHALLENGE_ENABLED ? '/competition' : '/'} replace />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* Recovery routes remain reachable when new public admission is closed. */}
            <Route path="/duel/:matchId" element={<CompetitiveMatch />} />
            <Route path="/replay/:matchId" element={<CompetitiveReplay />} />
            <Route path="/league-admin" element={<LeagueAdmin />} />
            <Route path="/league" element={PVP_ENABLED ? <LeagueQueue /> : <Navigate to="/" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <CardRegistryProvider>
        <AppContent />
      </CardRegistryProvider>
    </AuthProvider>
  );
}

export default App;
