import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Creature } from '../game/types.js';
import { supabase } from '../utils/supabase.js';
import { useAuth } from '../hooks/useAuth.js';
import { useNFTSelectionState } from '../hooks/useNFTSelectionState.js';
import { useGameTimer } from '../hooks/useGameTimer.js';
import { useRealtimeGameUpdates } from '../hooks/useRealtimeGameUpdates.js';
import { useCardSelection } from '../hooks/useCardSelection.js';
import { NFTSelectionErrorBoundary } from '../components/NFTSelectionErrorBoundary.js';
import { CardGrid } from '../components/OptimizedCard.js';
import { LoadingState, ConnectionStatus } from '../components/LoadingComponents.js';
import { 
  validateGameId, 
  validateCardSelection, 
  validateAuthState,
  gameUpdateLimiter,
  selectionLimiter,
  debounce
} from '../utils/validation.js';

// Import creature data
import creatureData from '../assets/creatures.json' with { type: 'json' };

const ALL_CREATURES: Creature[] = creatureData as Creature[];

const NFTSelectionContent: React.FC = () => {
  const { state, actions } = useNFTSelectionState();
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { user, error: authError } = useAuth();

  // Validate inputs
  const gameValidation = validateGameId(gameId);
  const authValidation = validateAuthState(user);

  // Card selection logic
  const { toggleCardSelection, getSelectionStatus, validateSelection } = useCardSelection({
    maxCards: 3,
    onSelectionChange: actions.setSelected,
    onMaxReached: () => {
      // Show feedback when max cards reached
      console.log('Maximum cards selected');
    }
  });

  // Handle card selection with validation
  const handleCardSelect = useCallback((cardId: string) => {
    if (state.lost || state.waiting || state.isConfirming) return;

    // Rate limiting
    if (!selectionLimiter.isAllowed(user?.id || 'anonymous')) {
      actions.setError('Too many selection attempts. Please wait.');
      return;
    }

    const newSelection = toggleCardSelection(cardId, state.selected);
    actions.setSelected(newSelection);
  }, [state.lost, state.waiting, state.isConfirming, state.selected, user?.id, toggleCardSelection, actions]);

  // Timer management
  const { resetTimer } = useGameTimer({
    initialTime: 60,
    onTick: (timeLeft: number) => {
      actions.resetTimer(timeLeft);
    },
    onExpire: () => {
      actions.setLost(true);
    },
    isActive: !state.lost && !state.waiting
  });

  // Game update handler
  function handleGameUpdate(game: any) {
    if (!game) return;

    // Validate game update
    if (!gameUpdateLimiter.isAllowed(gameId || '')) {
      console.warn('Game update rate limit exceeded');
      return;
    }

    if (game.status === 'playing') {
      navigate(`/battle/${gameId}`);
    } else if (game.status === 'waiting_for_players') {
      actions.setWaiting(true);
    }
  }

  // Real-time game updates
  const { isConnected, realtimeFailed, reconnect } = useRealtimeGameUpdates({
    gameId: gameId || '',
    onGameUpdate: handleGameUpdate,
    onError: actions.setError,
    fallbackToPolling: true
  });

  // Update realtime status in state
  useEffect(() => {
    actions.setRealtimeFailed(realtimeFailed);
  }, [realtimeFailed, actions]);

  // Load player's hand
  const loadPlayerHand = useCallback(async () => {
    if (!gameId || !user?.id) return;

    try {
      actions.setLoadingHand(true);
      actions.clearError();

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        throw new Error(`Failed to load game: ${gameError.message}`);
      }

      if (!gameData) {
        throw new Error('Game not found');
      }

      // Check if player is part of this game
      const isPlayer1 = gameData.player1_id === user.id;
      const isPlayer2 = gameData.player2_id === user.id;

      if (!isPlayer1 && !isPlayer2) {
        throw new Error('You are not a player in this game');
      }

      // Get player's hand
      const handField = isPlayer1 ? 'player1_hand' : 'player2_hand';
      const playerHand = gameData[handField] as string[];

      if (!playerHand || playerHand.length === 0) {
        throw new Error('No cards dealt to player');
      }

      // Filter creatures from the dealt hand
      const dealtCreatures = ALL_CREATURES.filter(creature => 
        playerHand.includes(creature.id)
      );

      if (dealtCreatures.length === 0) {
        throw new Error('No valid creatures found in hand');
      }

      actions.setDealtCreatures(dealtCreatures);

      // Handle game state
      if (gameData.status === 'playing') {
        navigate(`/battle/${gameId}`);
      } else if (gameData.status === 'waiting_for_players') {
        actions.setWaiting(true);
      }

    } catch (error) {
      console.error('Failed to load player hand:', error);
      actions.setError(error instanceof Error ? error.message : 'Failed to load game data');
    } finally {
      actions.setLoadingHand(false);
    }
  }, [gameId, user?.id, actions, navigate]);

  // Confirm selection
  const confirmSelection = useCallback(async () => {
    if (!gameId || !user?.id || state.isConfirming) return;

    // Validate selection
    const availableCardIds = state.dealtCreatures.map((c: any) => c.id);
    const validation = validateSelection(state.selected);
    const cardValidation = validateCardSelection(state.selected, availableCardIds, 3);

    if (!validation.isValid) {
      actions.setError(validation.errors.join(', '));
      return;
    }

    if (!cardValidation.isValid) {
      actions.setError(cardValidation.errors.join(', '));
      return;
    }

    try {
      actions.setConfirming(true);
      actions.clearError();

      // Rate limiting for game updates
      if (!gameUpdateLimiter.isAllowed(user.id)) {
        throw new Error('Too many update attempts. Please wait.');
      }

      const { data: gameData, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch game: ${fetchError.message}`);
      }

      const isPlayer1 = gameData.player1_id === user.id;
      const isPlayer2 = gameData.player2_id === user.id;

      if (!isPlayer1 && !isPlayer2) {
        throw new Error('You are not a player in this game');
      }

      // Update player's selection
      const updateField = isPlayer1 ? 'player1_selection' : 'player2_selection';
      const { error: updateError } = await supabase
        .from('games')
        .update({ [updateField]: state.selected })
        .eq('id', gameId);

      if (updateError) {
        throw new Error(`Failed to update selection: ${updateError.message}`);
      }

      actions.setWaiting(true);

    } catch (error) {
      console.error('Failed to confirm selection:', error);
      actions.setError(error instanceof Error ? error.message : 'Failed to confirm selection');
    } finally {
      actions.setConfirming(false);
    }
  }, [gameId, user?.id, state.isConfirming, state.selected, state.dealtCreatures, validateSelection, actions]);

  // Load hand on component mount
  useEffect(() => {
    if (gameValidation.isValid && authValidation.isValid) {
      loadPlayerHand();
    }
  }, [gameValidation.isValid, authValidation.isValid, loadPlayerHand]);

  // Handle validation errors
  useEffect(() => {
    if (!gameValidation.isValid) {
      actions.setError(gameValidation.error || 'Invalid game ID');
      return;
    }

    if (!authValidation.isValid) {
      actions.setError(authValidation.error || 'Authentication required');
      return;
    }

    if (authError) {
      actions.setError('Authentication error');
      return;
    }
  }, [gameValidation, authValidation, authError, actions]);

  // Debounced error clearing
  const clearErrorDebounced = useCallback(
    debounce(() => actions.clearError(), 5000),
    [actions]
  );

  useEffect(() => {
    if (state.error) {
      clearErrorDebounced();
    }
  }, [state.error, clearErrorDebounced]);

  // Loading state
  if (state.isLoadingHand) {
    return <LoadingState message="Loading your cards..." showCards={true} />;
  }

  // Error state
  if (!gameValidation.isValid || !authValidation.isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Invalid Game</h2>
          <p className="text-white/80 mb-6">
            {!gameValidation.isValid ? gameValidation.error : authValidation.error}
          </p>
          <button
            onClick={() => navigate('/lobby')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Lost state
  if (state.lost) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold text-white mb-4">Time's Up!</h2>
          <p className="text-white/80 mb-6">
            You didn't select your cards in time. The game has ended.
          </p>
          <button
            onClick={() => navigate('/lobby')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Waiting state
  if (state.waiting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-4">Waiting for Opponent</h2>
          <p className="text-white/80 mb-6">
            Your selection has been confirmed. Waiting for the other player to make their selection.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto"></div>
        </div>
      </div>
    );
  }

  const selectionStatus = getSelectionStatus(state.selected);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 md:p-8">
      <ConnectionStatus 
        isConnected={isConnected}
        realtimeFailed={realtimeFailed}
        onReconnect={reconnect}
      />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Select Your Cards</h1>
          <p className="text-white/80 text-lg">
            Choose 3 cards for battle ({selectionStatus.count}/3 selected)
          </p>
        </div>

        {/* Timer */}
        <div className="text-center mb-8">
          <div className={`
            inline-flex items-center space-x-2 px-4 py-2 rounded-lg
            ${state.timer <= 10 ? 'bg-red-600' : 'bg-blue-600'}
          `}>
            <span className="text-white font-bold text-xl">⏱️ {state.timer}s</span>
          </div>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-400 rounded-lg text-center">
            <p className="text-red-200">{state.error}</p>
          </div>
        )}

        {/* Cards Grid */}
        <CardGrid
          cards={state.dealtCreatures}
          selectedCards={state.selected}
          onCardClick={handleCardSelect}
          isDisabled={state.lost || state.waiting || state.isConfirming}
          className="mb-8"
        />

        {/* Selection Controls */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => actions.setSelected([])}
            disabled={state.selected.length === 0 || state.isConfirming}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 text-white font-bold rounded-lg transition-colors duration-200"
          >
            Clear Selection
          </button>

          <button
            onClick={confirmSelection}
            disabled={!selectionStatus.isComplete || state.isConfirming}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            {state.isConfirming && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>{state.isConfirming ? 'Confirming...' : 'Confirm Selection'}</span>
          </button>
        </div>

        {/* Selection Status */}
        <div className="text-center mt-4 text-white/60">
          {!selectionStatus.isComplete && (
            <p>Select {selectionStatus.remaining} more card{selectionStatus.remaining !== 1 ? 's' : ''}</p>
          )}
          {selectionStatus.isComplete && (
            <p>✅ Ready to confirm your selection</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Main component with error boundary
const NFTSelection: React.FC = () => {
  return (
    <NFTSelectionErrorBoundary>
      <NFTSelectionContent />
    </NFTSelectionErrorBoundary>
  );
};

export default NFTSelection;
