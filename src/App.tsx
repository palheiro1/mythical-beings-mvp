import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.js';
import { CardRegistryProvider } from './context/CardRegistry.js';
import Home from './pages/Home.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import NavBar from './components/NavBar.js';
import { SpinnerEmblem } from './components/ui/index.js';

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

function AppContent() {
  return (
    <Router>
      <NavBar />
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
          <Route path="/leaderboard" element={<Leaderboard />} />
          {/* Handle legacy/auth callback route by redirecting to lobby */}
          <Route path="/auth" element={<Navigate to="/lobby" replace />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/bot-game" element={<BotGame />} />
            <Route path="/game/:gameId" element={<GameScreen />} />
            <Route path="/game-initializing/:gameId" element={<GameInitializing />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/nft-selection/:gameId" element={<NFTSelectionSimplified />} />
            <Route path="/bot-selection" element={<NFTSelectionSimplified mode="bot" />} />
            <Route path="/waiting/:gameId" element={<WaitingScreen />} />
          </Route>
        </Routes>
      </Suspense>
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
