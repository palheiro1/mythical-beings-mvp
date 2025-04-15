import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import NFTSelection from './pages/NFTSelection';
import GameScreen from './pages/GameScreen';
import './App.css';
import { useEffect } from 'react';

function App() {
  const location = useLocation();
  const isGameRoute = location.pathname.startsWith('/game/');
  
  // Add/remove game-page class to body based on route
  useEffect(() => {
    if (isGameRoute) {
      document.body.classList.add('game-page');
    } else {
      document.body.classList.remove('game-page');
    }
    
    return () => {
      document.body.classList.remove('game-page');
    };
  }, [isGameRoute]);

  // If we're on a game route, render only the GameScreen without the navigation
  if (isGameRoute) {
    return (
      <Routes>
        <Route path="/game/:gameId" element={<GameScreen />} />
      </Routes>
    );
  }

  // For all other routes, render with navigation
  return (
    <div className="App">
      {/* Basic Navigation for testing - can be removed later */}
      <nav className="p-4 bg-gray-800 text-white mb-4">
        <ul className="flex space-x-4">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/nft-selection">NFT Selection</Link></li>
          <li><Link to="/lobby">Lobby</Link></li>
          <li><Link to="/game/test-game">Game (Test)</Link></li> {/* Example game route */} 
        </ul>
      </nav>

      {/* Route Definitions */} 
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/nft-selection" element={<NFTSelection />} />
      </Routes>
    </div>
  );
}

export default App;
