import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.js';
import Home from './pages/Home.js';
import Lobby from './pages/Lobby.js';
import GameScreen from './pages/GameScreen.js';
import NFTSelection from './pages/NFTSelection.js';
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

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:gameId" element={<GameScreen />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/nft-selection/:gameId" element={<NFTSelection />} />
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
      <AppContent />
    </AuthProvider>
  );
}

export default App;
