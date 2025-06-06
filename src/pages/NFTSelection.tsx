import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../components/Card.js';
import { Creature } from '../game/types.js';
import { supabase, RealtimeChannel } from '../utils/supabase.js'; // Import supabase client and RealtimeChannel
import { useAuth } from '../hooks/useAuth.js';
// --- Import the base creature data ---
import creatureData from '../assets/creatures.json' with { type: 'json' };

// --- Define ALL_CREATURES constant ---
const ALL_CREATURES: Creature[] = creatureData as Creature[];

const CARD_ASPECT_RATIO = 2.5 / 3.5;
const CARD_WIDTH_DESKTOP = '160px'; // Adjust as needed

const NFTSelection: React.FC = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [timer, setTimer] = useState(60); // Adjust timer as needed
  const [waiting, setWaiting] = useState(false); // Waiting for opponent selection
  const [lost, setLost] = useState(false); // Lost due to timeout
  const [isLoadingHand, setIsLoadingHand] = useState(true);
  const [dealtCreatures, setDealtCreatures] = useState<Creature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false); // Prevent double confirm clicks
  const [realtimeFailed, setRealtimeFailed] = useState(false); // Track realtime failure

  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { user, error: authError } = useAuth();
  const currentPlayerId = user?.id;
  const playerError = authError;
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null); // Fallback polling
  const gameIdRef = useRef<string | null>(null); // Track current game ID

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

  const toggleSelect = (id: string) => {
    if (lost || waiting || isConfirming) return;

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

  const handleConfirm = async () => {
    if (selected.length !== 3 || lost || waiting || isConfirming || !gameId || !currentPlayerId) {
      console.warn("[NFTSelection] Confirm button clicked but conditions not met:", {
        selectedLength: selected.length,
        lost,
        waiting,
        isConfirming,
        gameId,
        currentPlayerId,
      });
      return;
    }

    setIsConfirming(true); // Prevent double clicks
    setError(null); // Clear previous errors

    try {
      console.log(`[NFTSelection] Confirming selection for player ${currentPlayerId} in game ${gameId}`);

      const { data: gameData, error: _fetchError } = await supabase
        .from('games')
        .select('player1_id, player2_id')
        .eq('id', gameId)
        .single();

      if (_fetchError) throw _fetchError;
      if (!gameData) throw new Error("Game not found during confirmation.");

        // Direct comparison since we're using Supabase user IDs now
        const isPlayer1 = currentPlayerId && gameData.player1_id === currentPlayerId;
        const isPlayer2 = currentPlayerId && gameData.player2_id === currentPlayerId;

      if (!isPlayer1 && !isPlayer2) {
        throw new Error("You are not part of this game (confirmation check).");
      }

      // First get current state
      const { data: currentGameData, error: currentGameError } = await supabase
        .from('games')
        .select('state')
        .eq('id', gameId)
        .single();
        
      if (currentGameError) throw currentGameError;
      
      // Create a new state object to update or initialize if needed
      const currentState = currentGameData?.state || {};
      
      // Create an update that merges new values into existing state
      const newState = {
        ...currentState,
        ...(isPlayer1 
          ? {
              player1SelectedCreatures: selected,
              player1SelectionComplete: true
            }
          : {
              player2SelectedCreatures: selected, 
              player2SelectionComplete: true
            }
        )
      };
      
      // Create the payload for the update - include both state and column updates
      const updatePayload: any = { 
        state: newState 
      };
      
      // Also update the dedicated columns for creature selections AND completion flags
      if (isPlayer1) {
        updatePayload.player1_selected_creatures = selected;
        updatePayload.player1_selection_complete = true;
      } else {
        updatePayload.player2_selected_creatures = selected;
        updatePayload.player2_selection_complete = true;
      }

      console.log("[NFTSelection] Updating database with payload:", updatePayload);

      const { error: updateError } = await supabase
        .from('games')
        .update(updatePayload)
        .eq('id', gameId);

      if (updateError) throw updateError;

      console.log("[NFTSelection] Selection confirmed successfully in DB.");
      
      // Clear the polling interval immediately when selection is confirmed
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
        console.log('[NFTSelection] Cleared hand fetch interval after selection confirmation.');
      }
      
      setWaiting(true);

    } catch (err) {
      console.error("[NFTSelection] Error confirming selection:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during confirmation.");
    } finally {
      setIsConfirming(false);
    }
  };

  const getCardHeight = (width: string) => {
    const widthValue = parseFloat(width);
    return `${widthValue / CARD_ASPECT_RATIO}px`;
  };

  const pollForOpponentCompletion = async () => {
    if (!gameId) return;
    try {
      // Check both the boolean columns AND the JSONB state for completion
      const { data: gameData, error: _fetchError } = await supabase
        .from('games')
        .select('player1_selection_complete, player2_selection_complete, state')
        .eq('id', gameId)
        .single();
      // Use _fetchError here if needed for error handling
      if (_fetchError) throw _fetchError;
      
      // Check both boolean columns AND JSONB state for completion
      const p1Complete = gameData?.player1_selection_complete || gameData?.state?.player1SelectionComplete;
      const p2Complete = gameData?.player2_selection_complete || gameData?.state?.player2SelectionComplete;
      
      if (p1Complete && p2Complete) {
        console.log('[NFTSelection] 🎯 POLLING CHECK: Both players completed. Navigating to game initialization...');
        navigate(`/game-initializing/${gameId}`);
      }
    } catch (err) {
      console.warn("[NFTSelection] Error in pollForOpponentCompletion:", err);
    }
  };

  const handleRetryRealtime = () => {
    setError(null);
    setRealtimeFailed(false);
    setWaiting(true); // Triggers useEffect to resubscribe
  };

  useEffect(() => {
    if (realtimeFailed && waiting && gameId) {
      pollingRef.current = setInterval(pollForOpponentCompletion, 3000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [realtimeFailed, waiting, gameId]);

  useEffect(() => {
    if (!gameId || !currentPlayerId) {
      if (!gameId) setError("Game ID missing from URL.");
      if (!currentPlayerId && !playerError) setError("Identifying player...");
      if (playerError) setError(`Error identifying player: ${playerError}`);
      setIsLoadingHand(false);
      return;
    }

    // Update the gameId ref for safety checks
    gameIdRef.current = gameId;

    console.log(`[NFTSelection] useEffect for gameId: ${gameId}, currentPlayerId: ${currentPlayerId}`);
    setIsLoadingHand(true);
    setError(null);

    const fetchInitialData = async () => {
      try {
        console.log(`[NFTSelection] Fetching initial game data for game ${gameId}`);
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('player1_id, player2_id, player1_dealt_hand, player2_dealt_hand, player1_selection_complete, player2_selection_complete, state, status')
          .eq('id', gameId)
          .single();

        console.log('[NFTSelection] Raw gameData from fetch:', gameData);
        if (gameError) {
          console.error('[NFTSelection] Error fetching game data:', gameError);
          throw gameError;
        }
        if (!gameData) {
          console.error('[NFTSelection] No game data returned for gameId:', gameId);
          throw new Error('Game not found.');
        }
        
        console.log('[NFTSelection] Game data fetched successfully:', gameData);
        console.log('[NFTSelection] Game state from DB:', gameData.state);
        console.log('[NFTSelection] Game status from DB:', gameData.status);


        // Determine if current player is player1 or player2
        // Direct comparison since we're using Supabase user IDs now
        const isPlayer1 = gameData.player1_id === currentPlayerId;

        const hand = isPlayer1 ? gameData.player1_dealt_hand : gameData.player2_dealt_hand;

        if (hand && hand.length > 0) {
          const creatures = hand.map((id: string) => ALL_CREATURES.find(c => c.id === id)).filter(Boolean) as Creature[];
          setDealtCreatures(creatures);
          console.log(`[NFTSelection] Dealt hand for player ${isPlayer1 ? '1' : '2'}:`, creatures);
        } else {
          console.warn(`[NFTSelection] No hand data found for player ${isPlayer1 ? '1' : '2'} (ID: ${currentPlayerId}). Polling for hand...`);
          // Poll for hand data if not immediately available
          const pollHand = async () => {
            console.log(`[NFTSelection] Polling for hand data - gameId: ${gameId}, player: ${isPlayer1 ? '1' : '2'}`);
            
            // Safety check - ensure we're still in the right game
            if (!gameId || gameId !== gameIdRef.current) {
              console.log('[NFTSelection] Game ID mismatch during polling, stopping poll.');
              if (fetchIntervalRef.current) {
                clearInterval(fetchIntervalRef.current);
                fetchIntervalRef.current = null;
              }
              return;
            }
            
            const { data: updatedGameData, error: pollError } = await supabase
              .from('games')
              .select('player1_dealt_hand, player2_dealt_hand') // Fetch both hands
              .eq('id', gameId)
              .single();

            console.log('[NFTSelection] Polled game data for hand:', updatedGameData);
            if (pollError) {
              console.error('[NFTSelection] Error polling for hand data:', pollError);
              setError('Failed to load hand data. Please try refreshing.');
              setIsLoadingHand(false);
              return;
            }

            // Access the correct hand based on isPlayer1
            const currentHand = updatedGameData ? (isPlayer1 ? updatedGameData.player1_dealt_hand : updatedGameData.player2_dealt_hand) : null;
            if (currentHand && currentHand.length > 0) {
              const creatures = currentHand.map((id: string) => ALL_CREATURES.find(c => c.id === id)).filter(Boolean) as Creature[];
              setDealtCreatures(creatures);
              console.log(`[NFTSelection] Hand data received via polling for player ${isPlayer1 ? '1' : '2'}:`, creatures);
              setIsLoadingHand(false);
              
              // Clear the polling interval since we got the data
              if (fetchIntervalRef.current) {
                clearInterval(fetchIntervalRef.current);
                fetchIntervalRef.current = null;
                console.log('[NFTSelection] Cleared hand fetch interval after successful data retrieval.');
              }
            } else {
              console.log(`[NFTSelection] Hand data still not available for player ${isPlayer1 ? '1' : '2'}. Will poll again.`);
            }
          };
          fetchIntervalRef.current = setInterval(pollHand, 3000); // Poll every 3 seconds
        }
        
        // Check game state for selections
        if (gameData.state) {
            const playerStateKey = isPlayer1 ? 'player1SelectionComplete' : 'player2SelectionComplete';
            if (gameData.state[playerStateKey]) {
                // Clear polling interval if player has already completed selection
                if (fetchIntervalRef.current) {
                  clearInterval(fetchIntervalRef.current);
                  fetchIntervalRef.current = null;
                  console.log('[NFTSelection] Cleared hand fetch interval - player already completed selection.');
                }
                setWaiting(true); // Already selected, now waiting for opponent
                console.log(`[NFTSelection] Player ${isPlayer1 ? '1' : '2'} has already completed selection. Setting to waiting.`);
            }
        }


      } catch (err) {
        console.error('[NFTSelection] Detailed error in fetchInitialData:', err);
        setError(err instanceof Error ? `Failed to load game: ${err.message}` : 'An unknown error occurred while loading the game.');
      } finally {
        // Only set isLoadingHand to false if not polling for hand
        if (!(fetchIntervalRef.current)) {
            setIsLoadingHand(false);
        }
      }
    };

    fetchInitialData();

    // Single realtime subscription for game updates - handles both current player completion and navigation
    const handleGameUpdate = (payload: any) => {
      console.log('[NFTSelection] Realtime game update received:', payload);
      const updatedGame = payload.new as any;

      // Check completion status from both boolean columns AND JSONB state
      const hasPlayer1Completed = updatedGame.player1_selection_complete || updatedGame.state?.player1SelectionComplete;
      const hasPlayer2Completed = updatedGame.player2_selection_complete || updatedGame.state?.player2SelectionComplete;
      console.log(`[NFTSelection] Selection status - Player1: ${hasPlayer1Completed}, Player2: ${hasPlayer2Completed}`);

      // Check if both players have completed selection - navigate to game
      if (hasPlayer1Completed && hasPlayer2Completed) {
        console.log('[NFTSelection] 🎯 BOTH PLAYERS COMPLETED: Navigating to game initialization...');
        
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
        navigate(`/game-initializing/${gameId}`);
        return;
      }

      // Check if current player has completed selection - set waiting state
      if (updatedGame.player1_id && currentPlayerId) {
        const isPlayer1 = updatedGame.player1_id === currentPlayerId;
        const currentPlayerCompleted = isPlayer1 ? hasPlayer1Completed : hasPlayer2Completed;
        console.log(`[NFTSelection] Current player check - isPlayer1: ${isPlayer1}, completed: ${currentPlayerCompleted}, currently waiting: ${waiting}`);
        
        if (currentPlayerCompleted && !waiting) {
          console.log(`[NFTSelection] ⏳ WAITING STATE: Current player's selection completion detected via realtime. Setting waiting to true.`);
          setWaiting(true);
        }
      }
    };

    const channel = supabase.channel(`game-${gameId}-updates`);
    channel
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'games', 
          filter: `id=eq.${gameId}` 
        }, 
        handleGameUpdate
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[NFTSelection] Realtime channel subscribed successfully.');
          setRealtimeFailed(false);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error('[NFTSelection] Realtime subscription failed:', status, err);
          setError('Realtime connection failed. Falling back to polling for opponent completion.');
          setRealtimeFailed(true); 
        }
      });
    
    realtimeChannelRef.current = channel;

    return () => {
      // Clear all intervals and subscriptions on cleanup
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
        console.log('[NFTSelection] Cleared hand fetch interval on cleanup.');
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        console.log('[NFTSelection] Cleared polling interval on cleanup.');
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
          .then(() => console.log('[NFTSelection] Realtime channel unsubscribed successfully on cleanup.'))
          .catch(unsubError => console.error('[NFTSelection] Error unsubscribing realtime channel on cleanup:', unsubError));
        realtimeChannelRef.current = null;
      }
      // Clear the gameId ref
      gameIdRef.current = null;
    };
  }, [gameId, currentPlayerId, playerError, navigate]); // Removed waiting from dependencies since we handle it in the callback

  useEffect(() => {
    if (!waiting || !gameId) return;
    let cancelled = false;
    
    // Immediate check when entering waiting state
    const checkImmediateCompletion = async () => {
      try {
        // Check both boolean columns AND JSONB state for completion
        const { data: gameData, error: _fetchError } = await supabase
          .from('games')
          .select('player1_selection_complete, player2_selection_complete, state')
          .eq('id', gameId)
          .single();

        if (!cancelled) {
          // Check both boolean columns AND JSONB state for completion
          const p1Complete = gameData?.player1_selection_complete || gameData?.state?.player1SelectionComplete;
          const p2Complete = gameData?.player2_selection_complete || gameData?.state?.player2SelectionComplete;
          
          if (p1Complete && p2Complete) {
            console.log('[NFTSelection] 🎯 IMMEDIATE CHECK: Both players completed. Navigating to game initialization...');
            navigate(`/game-initializing/${gameId}`);
          }
        }
      } catch (err) {
        console.warn("[NFTSelection] Exception during immediate completion check:", err);
      }
    };
    
    checkImmediateCompletion();
    return () => { cancelled = true; };
  }, [waiting, gameId, navigate]);


  if (playerError) {
    return <div className="min-h-screen bg-gray-900 text-red-500 flex items-center justify-center">Error identifying player: {playerError}</div>;
  }
  if (isLoadingHand) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading your hand... (Waiting for cards to be dealt)</div>;
  }
  if (error && !lost) {
    return (
      <div className="min-h-screen bg-gray-900 text-red-500 flex flex-col items-center justify-center">
        <div>Error: {error}</div>
        {realtimeFailed && (
          <button
            className="mt-4 px-6 py-2 bg-yellow-400 text-black rounded font-bold hover:bg-yellow-300"
            onClick={handleRetryRealtime}
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }
  if (!lost && dealtCreatures.length === 0) {
    return <div className="min-h-screen bg-gray-900 text-yellow-500 flex items-center justify-center">Could not load your hand. Please try refreshing.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-gray-800 p-8 rounded-lg shadow-xl relative">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-yellow-400">Select Your Team (Choose 3)</h1>
          <p className="text-xs text-gray-500">Game ID: {gameId || 'Loading...'}</p>
          <div className={`text-3xl font-bold px-4 py-1 rounded ${timer <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {timer}s
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 justify-items-center mb-8">
          {dealtCreatures.map((card) => (
            <div
              key={card.id}
              style={{ width: CARD_WIDTH_DESKTOP, height: getCardHeight(CARD_WIDTH_DESKTOP) }}
              className={`relative group transform transition-transform duration-300 ease-in-out m-1
                ${lost || waiting || isConfirming ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-105'}`}
              onClick={() => toggleSelect(card.id)}
            >
              <Card
                card={card}
                isSelected={selected.includes(card.id)}
                isDisabled={lost || waiting || isConfirming}
              />
              {selected.includes(card.id) && (
                <div className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full p-1 leading-none z-10 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {selected.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-700">
            <h2 className="text-xl font-semibold text-center mb-4 text-yellow-300">Your Team ({selected.length}/3)</h2>
            <div className="flex justify-center items-center gap-4 flex-wrap">
              {dealtCreatures
                .filter(card => selected.includes(card.id))
                .map(card => (
                  <div
                    key={`selected-${card.id}`}
                    style={{ width: '100px', height: getCardHeight('100px') }}
                    className="relative shadow-md rounded-[10px] overflow-hidden border-2 border-gray-600 cursor-pointer hover:border-red-500 transition-colors"
                    onClick={() => toggleSelect(card.id)}
                  >
                    <Card
                      card={card}
                      isSelected={true}
                      isDisabled={lost || waiting || isConfirming}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="text-center h-16 flex flex-col justify-center items-center mt-12">
          {lost ? (
            <p className="text-2xl font-bold text-red-500">Time Expired - You Lost!</p>
          ) : waiting ? (
            <p className="text-xl font-semibold text-green-400 animate-pulse">Waiting for opponent...</p>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={selected.length !== 3 || isConfirming}
              className={`font-bold py-3 px-10 rounded-md transition duration-200 ease-in-out 
                ${selected.length !== 3 || isConfirming
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105 active:scale-100'}`}
            >
              {isConfirming ? 'Confirming...' : `Confirm Selection (${selected.length}/3)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NFTSelection;
