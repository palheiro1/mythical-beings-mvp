import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameScreen from './pages/GameScreen';
import NFTSelection from './pages/NFTSelection';
import ProfilePage from './pages/Profile';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Home />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:gameId" element={<GameScreen />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/select-nft" element={<NFTSelection />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
