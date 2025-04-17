import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Mock Data - Ensure image paths are correct
const mockHand = [
  { id: 'c1', name: 'Adaro', image: '/images/beings/adaro.jpg' },
  { id: 'c2', name: 'Kappa', image: '/images/beings/kappa.jpg' },
  { id: 'c3', name: 'Pele', image: '/images/beings/pele.jpg' },
  { id: 'c4', name: 'Lisovik', image: '/images/beings/lisovik.jpg' },
  { id: 'c5', name: 'Tulpar', image: '/images/beings/tulpar.jpg' },
];

const CARD_ASPECT_RATIO = 2.5 / 3.5; // Standard card aspect ratio
const CARD_WIDTH_DESKTOP = '160px'; // Adjust as needed

const NFTSelection: React.FC = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [timer, setTimer] = useState(60);
  const [waiting, setWaiting] = useState(false);
  const [lost, setLost] = useState(false);
  const navigate = useNavigate();

  // Timer logic
  useEffect(() => {
    if (lost || waiting) return; // Stop timer if game ended or waiting
    if (timer <= 0) {
      setLost(true);
      return;
    }
    const intervalId = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timer, lost, waiting]);

  // Navigation logic (when waiting for opponent)
  useEffect(() => {
    if (waiting) {
      const timeoutId = setTimeout(() => {
        // Simulate opponent ready, navigate to game
        navigate('/game/test-game'); // Replace test-game with actual game ID
      }, 2000); // Simulate opponent taking 2 seconds
      return () => clearTimeout(timeoutId);
    }
  }, [waiting, navigate]);

  const toggleSelect = (id: string) => {
    if (lost || waiting) return; // Cannot select if lost or waiting

    setSelected(currentSelected => {
      if (currentSelected.includes(id)) {
        return currentSelected.filter(cardId => cardId !== id);
      } else if (currentSelected.length < 3) {
        return [...currentSelected, id];
      } else {
        // Optional: Notify user they can only select 3
        return currentSelected; // Do nothing if already 3 selected
      }
    });
  };

  const handleConfirm = () => {
    if (selected.length === 3 && !lost && !waiting) {
      setWaiting(true);
    }
  };

  const getCardHeight = (width: string) => {
    const widthValue = parseFloat(width);
    return `${widthValue / CARD_ASPECT_RATIO}px`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-gray-800 p-8 rounded-lg shadow-xl relative">
        {/* Header */} 
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-yellow-400">Select Your Team (Choose 3)</h1>
          <div className={`text-3xl font-bold px-4 py-1 rounded ${timer <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {timer}s
          </div>
        </div>

        {/* Card Hand */} 
        <div className="flex justify-center items-center gap-6 flex-wrap mb-8">
          {mockHand.map(card => (
            <div
              key={card.id}
              onClick={() => toggleSelect(card.id)}
              style={{
                width: CARD_WIDTH_DESKTOP,
                height: getCardHeight(CARD_WIDTH_DESKTOP),
              }}
              className={`relative rounded-lg overflow-hidden border-4 transition-all duration-200 ease-in-out shadow-md 
                ${lost || waiting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'} 
                ${selected.includes(card.id) ? 'border-yellow-400 ring-2 ring-yellow-300/50 scale-105' : 'border-gray-600 hover:border-yellow-500'}`}
            >
              <img
                src={card.image}
                alt={card.name}
                className="absolute inset-0 w-full h-full object-cover" // Use object-cover for proper scaling
              />
              {/* Optional: Add name overlay if needed */}
              {/* <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-center text-xs font-semibold">{card.name}</div> */}
              {selected.includes(card.id) && (
                <div className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full p-1 leading-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action/Status Area */} 
        <div className="text-center h-16 flex flex-col justify-center items-center">
          {lost ? (
            <p className="text-2xl font-bold text-red-500">Time Expired - You Lost!</p>
          ) : waiting ? (
            <p className="text-xl font-semibold text-green-400 animate-pulse">Waiting for opponent...</p>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={selected.length !== 3}
              className={`bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-10 rounded-md transition duration-200 ease-in-out 
                ${selected.length !== 3 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
            >
              Confirm Selection ({selected.length}/3)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NFTSelection;
