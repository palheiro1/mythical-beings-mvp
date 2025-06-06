import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../components/Card.js';
import GameStateDebug from '../components/GameStateDebug.js';
import { Creature } from '../game/types.js';
import { supabase } from '../utils/supabase.js';
import { useAuth } from '../context/AuthProvider.js';
import { NFTSelectionNavigationManager } from '../utils/NavigationManager.js';
// --- Import the base creature data ---
import creatureData from '../assets/creatures.json' with { type: 'json' };

// --- Define ALL_CREATURES constant ---
const ALL_CREATURES: Creature[] = creatureData as Creature[];

const CARD_ASPECT_RATIO = 2.5 / 3.5;
const CARD_WIDTH_DESKTOP = '160px';

const NFTSelectionSimplified: React.FC = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [timer, setTimer] = useState(60);
  const [waiting, setWaiting] = useState(false);
  const [lost, setLost] = useState(false);
  const [isLoadingHand, setIsLoadingHand] = useState(true);
  const [dealtCreatures, setDealtCreatures] = useState<Creature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { user, error: authError } = useAuth();
  const currentPlayerId = user?.id;
  
  const navigationManagerRef = useRef<NFTSelectionNavigationManager | null>(null);
  const handPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Initialize navigation manager
  useEffect(() => {
    if (!gameId || !currentPlayerId || authError) {
      if (!gameId) setError("Game ID missing from URL.");
      if (!currentPlayerId && !authError) setError("Identifying player...");
      if (authError) setError(`Error identifying player: ${authError}`);
      setIsLoadingHand(false);
      return;
    }

    console.log('[NFTSelection] Initializing navigation manager');

    navigationManagerRef.current = new NFTSelectionNavigationManager({
      gameId,
      currentPlayerId,
      onNavigateToGame: () => {
        console.log('[NFTSelection] 🎯 Navigating to game initialization screen');
        navigate(`/game-initializing/${gameId}`);
      },
      onWaitingStateChange: (isWaiting: boolean) => {
        console.log('[NFTSelection] ⏳ Waiting state changed:', isWaiting);
        setWaiting(isWaiting);
      },
      onError: (errorMessage: string) => {
        console.error('[NFTSelection] Navigation manager error:', errorMessage);
        setError(errorMessage);
      }
    });

    return () => {
      if (navigationManagerRef.current) {
        navigationManagerRef.current.cleanup();
        navigationManagerRef.current = null;
      }
    };
  }, [gameId, currentPlayerId, authError, navigate]);

  // Load hand data
  useEffect(() => {
    if (!gameId || !currentPlayerId) return;

    const loadHandData = async () => {
      try {
        console.log('[NFTSelection] Loading hand data');
        setIsLoadingHand(true);
        setError(null);

        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('player1_id, player2_id, player1_dealt_hand, player2_dealt_hand, state')
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;
        if (!gameData) throw new Error('Game not found');

        const isPlayer1 = gameData.player1_id === currentPlayerId;
        const hand = isPlayer1 ? gameData.player1_dealt_hand : gameData.player2_dealt_hand;

        if (hand && hand.length > 0) {
          const creatures = hand.map((id: string) => 
            ALL_CREATURES.find(c => c.id === id)
          ).filter(Boolean) as Creature[];
          
          setDealtCreatures(creatures);
          setIsLoadingHand(false);
          console.log('[NFTSelection] Hand loaded:', creatures.length, 'cards');

          // Check if player already completed selection
          const state = gameData.state as any;
          if (state) {
            const playerComplete = isPlayer1 ? state.player1SelectionComplete : state.player2SelectionComplete;
            if (playerComplete) {
              console.log('[NFTSelection] Player already completed selection');
              setWaiting(true);
            }
          }
        } else {
          console.log('[NFTSelection] No hand data, starting polling');
          startHandPolling(isPlayer1);
        }

      } catch (error: any) {
        console.error('[NFTSelection] Error loading hand:', error);
        setError(`Failed to load hand: ${error.message}`);
        setIsLoadingHand(false);
      }
    };

    loadHandData();

    return () => {
      if (handPollIntervalRef.current) {
        clearInterval(handPollIntervalRef.current);
        handPollIntervalRef.current = null;
      }
    };
  }, [gameId, currentPlayerId]);

  const startHandPolling = (isPlayer1: boolean) => {
    if (handPollIntervalRef.current) return;

    console.log('[NFTSelection] Starting hand polling');
    
    handPollIntervalRef.current = setInterval(async () => {
      try {
        const { data: gameData, error } = await supabase
          .from('games')
          .select('player1_dealt_hand, player2_dealt_hand')
          .eq('id', gameId)
          .single();

        if (error) throw error;

        const hand = isPlayer1 ? gameData?.player1_dealt_hand : gameData?.player2_dealt_hand;
        
        if (hand && hand.length > 0) {
          const creatures = hand.map((id: string) => 
            ALL_CREATURES.find(c => c.id === id)
          ).filter(Boolean) as Creature[];
          
          setDealtCreatures(creatures);
          setIsLoadingHand(false);
          console.log('[NFTSelection] Hand loaded via polling:', creatures.length, 'cards');

          // Stop polling
          if (handPollIntervalRef.current) {
            clearInterval(handPollIntervalRef.current);
            handPollIntervalRef.current = null;
          }
        }
      } catch (error: any) {
        console.error('[NFTSelection] Hand polling error:', error);
      }
    }, 3000);
  };

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
    if (selected.length !== 3 || lost || waiting || isConfirming || !navigationManagerRef.current) {
      console.warn('[NFTSelection] Confirm conditions not met');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      console.log('[NFTSelection] Confirming selection:', selected);
      
      // Stop hand polling if still active
      if (handPollIntervalRef.current) {
        clearInterval(handPollIntervalRef.current);
        handPollIntervalRef.current = null;
      }

      await navigationManagerRef.current.updatePlayerSelection(selected);
      console.log('[NFTSelection] Selection confirmed successfully');

      // Add a direct check after a short delay as backup
      setTimeout(async () => {
        if (!gameId || waiting) return;
        
        try {
          console.log('[NFTSelection] Backup check: Verifying both players completed');
          const { data: gameData, error } = await supabase
            .from('games')
            .select('state')
            .eq('id', gameId)
            .single();
          
          if (!error && gameData?.state) {
            const state = gameData.state as any;
            if (state.player1SelectionComplete && state.player2SelectionComplete) {
              console.log('[NFTSelection] 🎯 BACKUP NAVIGATION: Both players completed, navigating...');
              navigate(`/game/${gameId}`);
            }
          }
        } catch (err) {
          console.error('[NFTSelection] Backup check error:', err);
        }
      }, 1000);

      // Add a second backup check with longer delay
      setTimeout(async () => {
        if (!gameId || waiting) return;
        
        try {
          console.log('[NFTSelection] Extended backup check: Final verification');
          const { data: gameData, error } = await supabase
            .from('games')
            .select('state')
            .eq('id', gameId)
            .single();
          
          if (!error && gameData?.state) {
            const state = gameData.state as any;
            if (state.player1SelectionComplete && state.player2SelectionComplete) {
              console.log('[NFTSelection] 🎯 EXTENDED BACKUP NAVIGATION: Both players completed, navigating...');
              navigate(`/game/${gameId}`);
            }
          }
        } catch (err) {
          console.error('[NFTSelection] Extended backup check error:', err);
        }
      }, 3000);

    } catch (error: any) {
      console.error('[NFTSelection] Error confirming selection:', error);
      setError(`Failed to confirm selection: ${error.message}`);
      setIsConfirming(false);
    }
  };

  const getCardHeight = (width: string) => {
    const widthValue = parseFloat(width);
    return `${widthValue / CARD_ASPECT_RATIO}px`;
  };

  // Render loading state
  if (authError) {
    return (
      <div className="min-h-screen bg-gray-900 text-red-500 flex items-center justify-center">
        Error identifying player: {authError}
      </div>
    );
  }

  if (isLoadingHand) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Loading your hand... (Waiting for cards to be dealt)
      </div>
    );
  }

  if (error && !lost) {
    return (
      <div className="min-h-screen bg-gray-900 text-red-500 flex flex-col items-center justify-center">
        <div>Error: {error}</div>
      </div>
    );
  }

  if (!lost && dealtCreatures.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-yellow-500 flex items-center justify-center">
        Could not load your hand. Please try refreshing.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      {/* Debug Panel */}
      <GameStateDebug gameId={gameId || ''} className="fixed top-4 right-4 z-50" />
      
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

export default NFTSelectionSimplified;
