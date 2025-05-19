import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.js';
import Lobby from './pages/Lobby.js';
import GameScreen from './pages/GameScreen.js';
import NFTSelection from './pages/NFTSelection.js';
import ProfilePage from './pages/Profile.js';
import HowToPlay from './pages/HowToPlay.js';
import Leaderboard from './pages/Leaderboard.js';
import WaitingScreen from './pages/WaitingScreen.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import NavBar from './components/NavBar.js'; // Import NavBar
import { useAuthProfileSync } from './hooks/useAuthProfileSync';

// Moralis is now initialized in main.tsx to ensure polyfills are loaded first

function App() {
  // Initialize auth-profile synchronization
  useAuthProfileSync();
  
  return (
    <Router>
      <NavBar /> {/* Add NavBar here so it's present on all pages */}
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

export default App;
