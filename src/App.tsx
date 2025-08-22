import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.js';
import { CardRegistryProvider } from './context/CardRegistry.js';
import Home from './pages/Home.js';
import Lobby from './pages/Lobby.js';
import GameScreen from './pages/GameScreen.js';
import NFTSelectionSimplified from './pages/NFTSelectionSimplified.js';
import GameInitializing from './pages/GameInitializing.js';
import ProfilePage from './pages/Profile.js';
import HowToPlay from './pages/HowToPlay.js';
import Leaderboard from './pages/Leaderboard.js';
import WaitingScreen from './pages/WaitingScreen.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import NavBar from './components/NavBar.js';
import { useAuthProfileSync } from './hooks/useAuthProfileSync.js';

// Moralis is now initialized in main.tsx to ensure polyfills are loaded first

function AppContent() {
  // Initialize auth-profile synchronization
  useAuthProfileSync();
  
  return (
    <Router>
      <NavBar />
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Home />} />
  {/* Handle legacy/auth callback route by redirecting to lobby */}
  <Route path="/auth" element={<Navigate to="/lobby" replace />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:gameId" element={<GameScreen />} />
          <Route path="/game-initializing/:gameId" element={<GameInitializing />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/nft-selection/:gameId" element={<NFTSelectionSimplified />} />
          <Route path="/how-to-play" element={<HowToPlay />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/waiting/:gameId" element={<WaitingScreen />} />
        </Route>
      </Routes>
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
