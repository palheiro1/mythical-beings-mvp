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
  const [isLoadingHand, setIsLoadingHand] = useState(true);
  const [dealtCreatures, setDealtCreatures] = useState<Creature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false); // Prevent double confirm clicks
  const [realtimeFailed, setRealtimeFailed] = useState(false); // Track realtime failure

  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [currentPlayerId, , playerError] = usePlayerIdentification();
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null); // Fallback polling

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

      const { data: gameData, error: fetchError } = await supabase
        .from('games')
        .select('player1_id, player2_id')
        .eq('id', gameId)
        .single();

      if (fetchError) throw fetchError;
      if (!gameData) throw new Error("Game not found during confirmation.");

      const isPlayer1 = gameData.player1_id === currentPlayerId;
      const isPlayer2 = gameData.player2_id === currentPlayerId;

      if (!isPlayer1 && !isPlayer2) {
        throw new Error("You are not part of this game (confirmation check).");
      }

      const updatePayload: {
        player1_selected_creatures?: string[];
        player1_selection_complete?: boolean;
        player2_selected_creatures?: string[];
        player2_selection_complete?: boolean;
      } = {};

      if (isPlayer1) {
        updatePayload.player1_selected_creatures = selected;
        updatePayload.player1_selection_complete = true;
      } else {
        updatePayload.player2_selected_creatures = selected;
        updatePayload.player2_selection_complete = true;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update(updatePayload)
        .eq('id', gameId);

      if (updateError) throw updateError;

      console.log("[NFTSelection] Selection confirmed successfully in DB.");
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
      const { data: gameData, error: fetchError } = await supabase
        .from('games')
        .select('player1_selection_complete, player2_selection_complete')
        .eq('id', gameId)
        .single();
      if (fetchError) throw fetchError;
      if (gameData?.player1_selection_complete && gameData?.player2_selection_complete) {
        navigate(`/game/${gameId}`);
      }
    } catch (err) {
      // Optionally log polling errors
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

    let attempts = 0;
    const maxAttempts = 5;
    const intervalTime = 2000;

    const fetchHandData = async () => {
      console.log(`[NFTSelection] Attempt ${attempts + 1}: Fetching game data for ${gameId}`);
      try {
        const { data: gameData, error } = await supabase
          .from('games')
          .select('player1_id, player2_id, player1_dealt_hand, player2_dealt_hand, player1_selection_complete, player2_selection_complete, status')
          .eq('id', gameId)
          .single();

        if (error) throw error;

        if (!gameData) {
          throw new Error("Game not found.");
        }

        const isPlayer1 = gameData.player1_id === currentPlayerId;
        const isPlayer2 = gameData.player2_id === currentPlayerId;

        if (!isPlayer1 && !isPlayer2) {
          throw new Error("You are not part of this game.");
        }

        const dealtHandIds: string[] = isPlayer1 ? gameData.player1_dealt_hand : gameData.player2_dealt_hand;
        const selectionComplete: boolean = isPlayer1 ? gameData.player1_selection_complete : gameData.player2_selection_complete;


        if (!gameData) {
          throw new Error("Game not found.");
        }

        const dealtHandIds: string[] = isPlayer1 ? gameData.player1_dealt_hand : gameData.player2_dealt_hand;
        const selectionComplete: boolean = isPlayer1 ? gameData.player1_selection_complete : gameData.player2_selection_complete;

        if (!dealtHandIds || dealtHandIds.length === 0) {
          if (attempts < maxAttempts - 1) {
            console.log("[NFTSelection] Hands not dealt yet, polling again...");
            attempts++;
            fetchIntervalRef.current = setTimeout(fetchHandData, intervalTime);
          } else {
            throw new Error("Failed to fetch dealt hand after multiple attempts. The dealing function might have failed.");
          }
          return;
        }

        if (fetchIntervalRef.current) {
          clearTimeout(fetchIntervalRef.current);
          fetchIntervalRef.current = null;
        }

        const creatures = dealtHandIds
          .map(id => ALL_CREATURES.find(c => c.id === id))
          .filter((c): c is Creature => !!c);

        if (creatures.length !== dealtHandIds.length) {
          console.warn(`[NFTSelection] Warning: Expected ${dealtHandIds.length} creatures, but found ${creatures.length} based on dealt IDs.`);
        }
        if (creatures.length === 0 && dealtHandIds.length > 0) {
          throw new Error("Dealt hand IDs found, but no matching creature data could be loaded.");
        }

        setDealtCreatures(creatures);
        setError(null);
        setIsLoadingHand(false);

        if (selectionComplete) {
          console.log("[NFTSelection] Player selection already complete, setting waiting state.");
          setWaiting(true);
        }

        console.log("[NFTSelection] Dealt hand fetched successfully:", creatures.map(c => c.name));

      } catch (err) {
        console.error("[NFTSelection] Error fetching dealt hand:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred fetching hand data.");
        setIsLoadingHand(false);
        if (fetchIntervalRef.current) {
          clearTimeout(fetchIntervalRef.current);
          fetchIntervalRef.current = null;
        }
      }
    };

    setIsLoadingHand(true);
    setError(null);
    fetchHandData();

    return () => {
      if (fetchIntervalRef.current) {
        console.log("[NFTSelection] Cleaning up polling timeout.");
        clearTimeout(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }
    };

  }, [gameId, currentPlayerId, playerError]);

  useEffect(() => {
    if (!waiting || !gameId) return;
    let cancelled = false;
    const checkImmediateCompletion = async () => {
      try {
        const { data: gameData, error: fetchError } = await supabase
          .from('games')
          .select('player1_selection_complete, player2_selection_complete')
          .eq('id', gameId)
          .single();
        if (!cancelled && gameData?.player1_selection_complete && gameData?.player2_selection_complete) {
          navigate(`/game/${gameId}`);
        }
      } catch (err) {
        // Optionally log error
      }
    };
    checkImmediateCompletion();
    return () => { cancelled = true; };
  }, [waiting, gameId, navigate]);

  useEffect(() => {
    if (!waiting || !gameId) {
      return;
    }

    console.log(`[NFTSelection] Waiting state entered. Subscribing to game ${gameId} for opponent completion.`);

    const handleGameUpdate = (payload: any) => {
      console.log('[NFTSelection] Realtime game update received:', payload);
      const game = payload.new;
      if (game.player1_selection_complete && game.player2_selection_complete) {
        console.log('[NFTSelection] Both players confirmed! Navigating to game screen.');
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
        navigate(`/game/${gameId}`);
      }
    };

    realtimeChannelRef.current = supabase
      .channel(`game-${gameId}-selection`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        handleGameUpdate
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[NFTSelection] Successfully subscribed to game ${gameId} updates.`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[NFTSelection] Realtime subscription error for game ${gameId}:`, status, err);
          setError(`Failed to listen for opponent completion (${status}). Please refresh or retry.`);
          setRealtimeFailed(true);
        }
      });

    return () => {
      if (realtimeChannelRef.current) {
        console.log(`[NFTSelection] Cleaning up realtime subscription for game ${gameId}.`);
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };

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
