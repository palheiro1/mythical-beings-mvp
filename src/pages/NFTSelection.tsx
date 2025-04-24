import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card'; // Import the Card component
import { Creature } from '../game/types'; // Import the Creature type

// Mock Data - Ensure image paths are correct
const mockHand: Creature[] = [
  { id: 'c1', name: 'Adaro', image: '/images/beings/adaro.jpg', element: 'water', passiveAbility: '', baseWisdom: 0 },
  { id: 'c2', name: 'Kappa', image: '/images/beings/kappa.jpg', element: 'water', passiveAbility: '', baseWisdom: 0 },
  { id: 'c3', name: 'Pele', image: '/images/beings/pele.jpg', element: 'fire', passiveAbility: '', baseWisdom: 0 },
  { id: 'c4', name: 'Lisovik', image: '/images/beings/lisovik.jpg', element: 'earth', passiveAbility: '', baseWisdom: 0 },
  { id: 'c5', name: 'Tulpar', image: '/images/beings/tulpar.jpg', element: 'air', passiveAbility: '', baseWisdom: 0 },
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
          {mockHand
            .filter(card => !selected.includes(card.id)) // Filter out selected cards
            .map(card => (
            <div
              key={card.id}
              style={{ width: CARD_WIDTH_DESKTOP, height: getCardHeight(CARD_WIDTH_DESKTOP) }}
              className={`relative group transform transition-transform duration-300 ease-in-out m-1
                ${lost || waiting ? 'cursor-not-allowed' : ''}`}
            >
              <Card
                card={card} // Pass the card data
                onClick={() => toggleSelect(card.id)} // Pass the click handler
                isSelected={selected.includes(card.id)} // Pass selection state
                isDisabled={lost || waiting} // Pass disabled state to Card
              />
              {/* Keep the checkmark overlay outside the Card component if needed */}
              {selected.includes(card.id) && (
                <div className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full p-1 leading-none z-10"> {/* Ensure checkmark is above card */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Selected Cards Section */}
        {selected.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-700">
            <h2 className="text-xl font-semibold text-center mb-4 text-yellow-300">Your Team ({selected.length}/3)</h2>
            <div className="flex justify-center items-center gap-4 flex-wrap">
              {mockHand
                .filter(card => selected.includes(card.id))
                .map(card => (
                  // Render selected cards - potentially smaller or styled differently
                  <div
                    key={`selected-${card.id}`}
                    style={{ width: '100px', height: getCardHeight('100px') }} // Example: Smaller size
                    className="relative shadow-md rounded-[10px] overflow-hidden border-2 border-gray-600"
                  >
                    <Card
                      card={card}
                      onClick={() => toggleSelect(card.id)} // Add onClick to Card to deselect
                      isSelected={true} // Visually indicate it's selected (uses yellow border)
                      isDisabled={lost || waiting} // Pass disabled state
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action/Status Area */}
        <div className="text-center h-16 flex flex-col justify-center items-center mt-12"> {/* Increased margin-top */}
          {lost ? (
            <p className="text-2xl font-bold text-red-500">Time Expired - You Lost!</p>
          ) : waiting ? (
            <p className="text-xl font-semibold text-green-400 animate-pulse">Waiting for opponent...</p>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={selected.length !== 3}
              className={`font-bold py-3 px-10 rounded-md transition duration-200 ease-in-out 
                ${selected.length !== 3 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105 active:scale-100'}`}
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
