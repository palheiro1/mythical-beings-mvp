import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.js';
import { CardRegistryProvider } from './context/CardRegistry.js';
import Home from './pages/Home.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import NavBar from './components/NavBar.js';
import { SpinnerEmblem } from './components/ui/index.js';
import { PVP_ENABLED } from './config/release.js';

// Moralis is now initialized in main.tsx to ensure polyfills are loaded first

const Lobby = lazy(() => import('./pages/Lobby.js'));
const BotGame = lazy(() => import('./pages/BotGame.js'));
const GameScreen = lazy(() => import('./pages/GameScreen.js'));
const GameInitializing = lazy(() => import('./pages/GameInitializing.js'));
const ProfilePage = lazy(() => import('./pages/Profile.js'));
const NFTSelectionSimplified = lazy(() => import('./pages/NFTSelectionSimplified.js'));
const HowToPlay = lazy(() => import('./pages/HowToPlay.js'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.js'));
const WaitingScreen = lazy(() => import('./pages/WaitingScreen.js'));
const NotFound = lazy(() => import('./pages/NotFound.js'));

function AppContent() {
  return (
    <Router>
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
          <Route path="/bot-selection" element={<NFTSelectionSimplified mode="bot" />} />
          <Route path="/bot-game" element={<BotGame />} />
          <Route path="/leaderboard" element={PVP_ENABLED ? <Leaderboard /> : <Navigate to="/" replace />} />
          {/* Handle legacy/auth callback route by redirecting to lobby */}
          <Route path="/auth" element={<Navigate to="/lobby" replace />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/profile" element={<ProfilePage />} />
            {PVP_ENABLED ? (
              <>
                <Route path="/game/:gameId" element={<GameScreen />} />
                <Route path="/game-initializing/:gameId" element={<GameInitializing />} />
                <Route path="/nft-selection/:gameId" element={<NFTSelectionSimplified />} />
                <Route path="/waiting/:gameId" element={<WaitingScreen />} />
              </>
            ) : (
              <>
                <Route path="/game/:gameId" element={<Navigate to="/lobby" replace />} />
                <Route path="/game-initializing/:gameId" element={<Navigate to="/lobby" replace />} />
                <Route path="/nft-selection/:gameId" element={<Navigate to="/lobby" replace />} />
                <Route path="/waiting/:gameId" element={<Navigate to="/lobby" replace />} />
              </>
            )}
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
