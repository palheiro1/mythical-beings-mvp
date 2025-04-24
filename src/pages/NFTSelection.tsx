import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../components/Card';
import { Creature } from '../game/types';
import { supabase, RealtimeChannel } from '../utils/supabase'; // Import supabase client and RealtimeChannel
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
// --- Import the base creature data ---
import creatureData from '../assets/creatures.json';

// --- Define ALL_CREATURES constant ---
const ALL_CREATURES: Creature[] = creatureData as Creature[];

const CARD_ASPECT_RATIO = 2.5 / 3.5;
const CARD_WIDTH_DESKTOP = '160px'; // Adjust as needed

const NFTSelection: React.FC = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [timer, setTimer] = useState(60); // Adjust timer as needed
  const [waiting, setWaiting] = useState(false); // Waiting for opponent selection
  const [lost, setLost] = useState(false); // Lost due to timeout
  // --- Add state for fetching hand ---
  const [isLoadingHand, setIsLoadingHand] = useState(true);
  const [dealtCreatures, setDealtCreatures] = useState<Creature[]>([]);
  const [error, setError] = useState<string | null>(null);
  // --- End add state ---
  const [isConfirming, setIsConfirming] = useState(false); // Prevent double confirm clicks

  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [currentPlayerId, , playerError] = usePlayerIdentification();
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  // --- Add ref for polling interval ---
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // --- End add ref ---

  // Timer logic
  useEffect(() => {
    if (lost || waiting) return;
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
    if (waiting && gameId) {
      const timeoutId = setTimeout(() => {
        console.log(`[NFTSelection] Navigating to game: ${gameId}`);
        navigate(`/game/${gameId}`);
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [waiting, navigate, gameId]);

  const toggleSelect = (id: string) => {
    if (lost || waiting) return;

    setSelected(currentSelected => {
      if (currentSelected.includes(id)) {
        return currentSelected.filter(cardId => cardId !== id);
      } else if (currentSelected.length < 3) {
        return [...currentSelected, id];
      } else {
        return currentSelected;
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

  // --- Fetch Dealt Hand ---
  useEffect(() => {
    // Don't run if we don't have necessary IDs yet
    if (!gameId || !currentPlayerId) {
      setError("Game ID or Player ID missing.");
      setIsLoadingHand(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 5; // Try fetching 5 times
    const intervalTime = 2000; // Wait 2 seconds between attempts

    // Define the function that fetches data
    const fetchHandData = async () => {
      console.log(`[NFTSelection] Attempt ${attempts + 1}: Fetching game data for ${gameId}`);
      try {
        // Fetch the specific game row from Supabase
        const { data: gameData, error: fetchError } = await supabase
          .from('games')
          .select('player1_id, player2_id, player1_dealt_hand, player2_dealt_hand, player1_selection_complete, player2_selection_complete, status')
          .eq('id', gameId)
          .single(); // We expect only one game row

        if (fetchError) throw fetchError; // Handle database errors

        if (!gameData) {
          throw new Error("Game not found."); // Handle case where game ID is invalid
        }

        // Determine if the current user is Player 1 or Player 2
        const isPlayer1 = gameData.player1_id === currentPlayerId;
        const isPlayer2 = gameData.player2_id === currentPlayerId;

        // Make sure the current user is actually part of this game
        if (!isPlayer1 && !isPlayer2) {
          throw new Error("You are not part of this game.");
        }

        // Get the array of dealt card IDs for the correct player
        const dealtHandIds = isPlayer1 ? gameData.player1_dealt_hand : gameData.player2_dealt_hand;
        // Check if the player already completed their selection
        const selectionComplete = isPlayer1 ? gameData.player1_selection_complete : gameData.player2_selection_complete;

        // --- Check if hands are dealt (Polling Logic) ---
        if (!dealtHandIds || dealtHandIds.length === 0) {
          // If hands aren't dealt yet and we haven't exceeded attempts
          if (attempts < maxAttempts - 1) {
            console.log("[NFTSelection] Hands not dealt yet, polling again...");
            attempts++;
            // Schedule this function to run again after intervalTime
            fetchIntervalRef.current = setTimeout(fetchHandData, intervalTime);
          } else {
            // If we've tried enough times, give up and show an error
            throw new Error("Failed to fetch dealt hand after multiple attempts. The dealing function might have failed.");
          }
          return; // Stop processing this attempt, wait for the next poll
        }
        // --- End Polling Logic ---

        // If we reach here, hands ARE dealt. Clear any pending poll timeout.
        if (fetchIntervalRef.current) {
          clearTimeout(fetchIntervalRef.current);
          fetchIntervalRef.current = null;
        }

        // --- Look up full creature details ---
        const creatures = dealtHandIds
          // Find the matching creature object in ALL_CREATURES for each ID
          .map(id => ALL_CREATURES.find(c => c.id === id))
          // Filter out any potential 'undefined' results (if an ID didn't match)
          .filter((c): c is Creature => !!c);

        if (creatures.length !== 5) {
           console.warn("[NFTSelection] Warning: Expected 5 creatures, but found " + creatures.length + " based on dealt IDs.");
           // Decide how to handle this - show error? proceed?
        }
        // --- End lookup ---

        // --- Update State ---
        setDealtCreatures(creatures); // Store the full creature objects
        setError(null); // Clear any previous errors
        setIsLoadingHand(false); // Mark loading as complete

        // If the player's selection was already marked complete in the DB, set waiting state
        if (selectionComplete) {
          console.log("[NFTSelection] Player selection already complete, setting waiting state.");
          setWaiting(true);
        }
        // --- End Update State ---

        console.log("[NFTSelection] Dealt hand fetched successfully:", creatures.map(c => c.name));

      } catch (err) {
        // Handle any errors during the fetch process
        console.error("[NFTSelection] Error fetching dealt hand:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred fetching hand data.");
        setIsLoadingHand(false); // Stop loading even on error
        // Clear polling interval on error too
        if (fetchIntervalRef.current) {
          clearTimeout(fetchIntervalRef.current);
          fetchIntervalRef.current = null;
        }
      }
    };

    // Start the loading process and call the fetch function for the first time
    setIsLoadingHand(true);
    fetchHandData();

    // --- Cleanup Function ---
    // This runs when the component unmounts or when gameId/currentPlayerId changes
    return () => {
      // If there's a pending timeout for polling, clear it
      if (fetchIntervalRef.current) {
        console.log("[NFTSelection] Cleaning up polling timeout.");
        clearTimeout(fetchIntervalRef.current);
      }
    };
    // --- End Cleanup ---

  }, [gameId, currentPlayerId]); // Dependencies: Rerun this effect if gameId or currentPlayerId changes
  // --- End Fetch Dealt Hand useEffect ---

  // --- Render Logic ---
  // Add checks for loading and error states before rendering cards
  if (playerError) {
    return <div className="min-h-screen bg-gray-900 text-red-500 flex items-center justify-center">Error identifying player: {playerError}</div>;
  }
  if (isLoadingHand) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading your hand... (Waiting for cards to be dealt)</div>;
  }
  // Show error if one occurred (and not already in 'lost' state)
  if (error && !lost) {
     return <div className="min-h-screen bg-gray-900 text-red-500 flex items-center justify-center">Error: {error}</div>;
  }

  // --- Original return statement with card grid ---
  // Make sure the card grid maps over `dealtCreatures` instead of `mockHand`
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-gray-800 p-8 rounded-lg shadow-xl relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-yellow-400">Select Your Team (Choose 3)</h1>
          <p className="text-xs text-gray-500">Game ID: {gameId || 'Loading...'}</p>
          <div className={`text-3xl font-bold px-4 py-1 rounded ${timer <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {timer}s
          </div>
        </div>

        {/* Card Hand */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 justify-items-center mb-8">
          {dealtCreatures.map((card) => (
            <div
              key={card.id}
              style={{ width: CARD_WIDTH_DESKTOP, height: getCardHeight(CARD_WIDTH_DESKTOP) }}
              className={`relative group transform transition-transform duration-300 ease-in-out m-1
                ${lost || waiting ? 'cursor-not-allowed' : ''}`}
              onClick={() => toggleSelect(card.id)}
            >
              <Card
                card={card}
                isSelected={selected.includes(card.id)}
                isDisabled={lost || waiting || isConfirming}
              />
              {selected.includes(card.id) && (
                <div className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full p-1 leading-none z-10">
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
              {ALL_CREATURES
                .filter(card => selected.includes(card.id))
                .map(card => (
                  <div
                    key={`selected-${card.id}`}
                    style={{ width: '100px', height: getCardHeight('100px') }}
                    className="relative shadow-md rounded-[10px] overflow-hidden border-2 border-gray-600"
                  >
                    <Card
                      card={card}
                      onClick={() => toggleSelect(card.id)}
                      isSelected={true}
                      isDisabled={lost || waiting}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action/Status Area */}
        <div className="text-center h-16 flex flex-col justify-center items-center mt-12">
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
