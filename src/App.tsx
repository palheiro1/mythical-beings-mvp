import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import NFTSelection from './pages/NFTSelection';
import GameScreen from './pages/GameScreen';
import './App.css';

function App() {
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
        {/* Example route for a specific game ID */} 
        <Route path="/game/:gameId" element={<GameScreen />} />
      </Routes>
    </div>
  );
}

export default App;
