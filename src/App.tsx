import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameScreen from './pages/GameScreen';
import NFTSelection from './pages/NFTSelection';
import ProfilePage from './pages/Profile';
import HowToPlay from './pages/HowToPlay';
import Leaderboard from './pages/Leaderboard';
import WaitingScreen from './pages/WaitingScreen';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Home />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <>
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/game/:gameId" element={<GameScreen />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/nft-selection/:gameId" element={<NFTSelection />} />
              <Route path="/how-to-play" element={<HowToPlay />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/waiting/:gameId" element={<WaitingScreen />} />
            </>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
