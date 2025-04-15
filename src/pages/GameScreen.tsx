import React, { useEffect, useReducer, useState } from 'react';
import { useParams } from 'react-router-dom';
// Import createGame and mock creature data
import { getGameState, subscribeToGameState, unsubscribeFromGameState, updateGameState, logMove, createGame } from '../utils/supabase';
import { gameReducer, initializeGame } from '../game/state';
import { isValidAction } from '../game/rules';
import { GameState, GameAction, PlayerState, Creature, Knowledge } from '../game/types';
import Card from '../components/Card';
import Hand from '../components/Hand';
import Market from '../components/Market';
import CreatureZone from '../components/CreatureZone';
import creatureData from '../assets/creatures.json'; // Import creature data

// Define a type for the state that can be null initially
type GameScreenState = GameState | null;

// Define the reducer function type explicitly
// It now correctly handles GameState | null as input and output
type GameReducerType = (state: GameScreenState, action: GameAction) => GameScreenState;

// Wrapper for the original reducer to handle the null case gracefully
const gameScreenReducer: GameReducerType = (state, action) => {
  if (action.type === 'SET_GAME_STATE') {
    // Directly set the state, which might be GameState or null
    // Ensure payload is not undefined before returning
    return action.payload ?? null;
  }
  if (action.type === 'INITIALIZE_GAME') {
    // Call the actual initializeGame function
    const { gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2 } = action.payload;
    return initializeGame(gameId, player1Id, player2Id, selectedCreaturesP1, selectedCreaturesP2);
  }
  // For all other actions, state must be non-null
  if (state === null) {
    console.error("Reducer called with null state for action type:", action.type);
    // Return null or throw an error, depending on desired behavior for invalid states
    return null;
  }
  // Delegate to the original gameReducer for actual game logic
  return gameReducer(state, action);
};


const GameScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  // Initialize reducer with null state and the wrapper reducer
  const [state, dispatch] = useReducer(gameScreenReducer, null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // TODO: Replace with actual authenticated player ID (e.g., from wallet connection context)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null); // Example: 'p1' or 'p2'
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null); // For summon action flow

  // --- Mock Player ID Setup (Replace with actual auth) ---
  useEffect(() => {
    // Simulate fetching player ID or determining it based on URL/session
    // For testing, alternate between p1 and p2 based on a query param or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const mockPlayer = urlParams.get('player');
    if (mockPlayer === 'p1' || mockPlayer === 'p2') {
        setCurrentPlayerId(mockPlayer);
        console.log(`Mock Player ID set to: ${mockPlayer}`);
    } else {
        // Default or prompt for player ID for testing
        const assignedPlayer = prompt("Enter player ID for testing (p1 or p2):", "p1");
        if (assignedPlayer === 'p1' || assignedPlayer === 'p2') {
            setCurrentPlayerId(assignedPlayer);
            console.log(`Mock Player ID set to: ${assignedPlayer}`);
        } else {
            setError("Could not determine player ID for this session.");
        }
    }
  }, []);
  // --- End Mock Player ID Setup ---


  useEffect(() => {
    if (!gameId || !currentPlayerId) { // Also wait for currentPlayerId
      // setError('No game ID or Player ID provided.'); // Don't set error yet, might just be loading
      setLoading(true); // Keep loading until both are available
      return;
    }

    setLoading(true);
    setError(null);
    let subscription: any = null; // Use 'any' for Supabase channel type for simplicity

    const handleRealtimeUpdate = (newState: GameState) => {
      console.log('Realtime update received:', newState);
      dispatch({ type: 'SET_GAME_STATE', payload: newState });
    };

    const setupGame = async () => {
      try {
        let gameState = await getGameState(gameId); // Use let
        if (!gameState) {
          // --- Game Initialization Logic --- 
          console.log(`Game state for ${gameId} not found. Attempting to initialize...`);
          // Use mock data and IDs for testing initialization
          const mockCreaturesP1: Creature[] = creatureData.slice(0, 3) as Creature[];
          const mockCreaturesP2: Creature[] = creatureData.slice(3, 6) as Creature[];
          const player1Id = 'p1'; // Mock player ID
          const player2Id = 'p2'; // Mock player ID

          if (mockCreaturesP1.length < 3 || mockCreaturesP2.length < 3) {
              throw new Error("Not enough mock creature data available for initialization.");
          }

          // Initialize the state locally
          const initializedState = initializeGame(gameId, player1Id, player2Id, mockCreaturesP1, mockCreaturesP2);

          // Create the game record in Supabase, passing the desired gameId
          const createdGame = await createGame(gameId, player1Id, player2Id, initializedState);

          if (!createdGame || !createdGame.state) {
            throw new Error("Failed to create game in Supabase.");
          }
          gameState = createdGame.state as GameState; // Use the newly created state
          console.log(`Game ${gameId} created and initialized.`);
          // --- End Initialization Logic ---
        }

        // Set the state (either fetched or newly initialized)
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
        setLoading(false);

        // Subscribe after initial state is set or created
        subscription = subscribeToGameState(gameId, handleRealtimeUpdate);

      } catch (err) {
        console.error('Error setting up game:', err);
        setError(`Failed to fetch or initialize game state: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    setupGame();

    // Cleanup function
    return () => {
      if (subscription) {
        unsubscribeFromGameState(subscription);
      }
    };
  }, [gameId, currentPlayerId]); // Add currentPlayerId dependency


  // --- Action Handling ---
  const handleAction = async (action: GameAction) => {
    if (!state || !gameId || !currentPlayerId) {
      console.error("Cannot handle action: State, gameId, or currentPlayerId missing.");
      return;
    }

    // Ensure the action payload has the correct player ID
    if ('payload' in action && typeof action.payload === 'object' && action.payload && 'playerId' in action.payload) {
        if (action.payload.playerId !== currentPlayerId) {
            console.warn("Action originated from wrong player context?", action);
            // Optionally prevent action if payload.playerId doesn't match currentPlayerId
            // return;
        }
    } else if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
        console.error("Action payload missing playerId:", action);
        return; // Don't process actions without player context (except system ones)
    }


    // Validate action before dispatching locally or sending to Supabase
    if (!isValidAction(state, action)) {
      console.warn("Invalid action attempted:", action.type, action.payload);
      setError(`Invalid action: ${action.type}. Check game rules or state.`);
      // Clear selection if the invalid action was part of summon flow
      setSelectedKnowledgeId(null);
      return; // Don't proceed if action is invalid
    }

    // Optimistic UI update
    const nextState = gameScreenReducer(state, action); // Use the wrapper reducer
    if (!nextState) {
        console.error("Reducer returned null state after action:", action);
        setError("An error occurred processing the action.");
        return;
    }
    dispatch(action); // Dispatch the original action to the reducer managing the component's state

    // Persist state change and log move via Supabase
    try {
      const updateResult = await updateGameState(gameId, nextState);
      if (!updateResult) {
          throw new Error("Failed to update game state in Supabase.");
      }
      // Only log actions with payloads (i.e., player actions)
      if ('payload' in action && action.payload) {
          await logMove(gameId, currentPlayerId, action.type, action.payload);
      }
      setError(null); // Clear previous errors on successful action
    } catch (err) {
      console.error('Error updating game state or logging move:', err);
      setError('Failed to sync game state. Please try again.');
      // TODO: Consider reverting optimistic update if Supabase fails
      // dispatch({ type: 'SET_GAME_STATE', payload: state }); // Revert state
    }

    // Clear selection after successful summon
    if (action.type === 'SUMMON_KNOWLEDGE') {
        setSelectedKnowledgeId(null);
    }
  };

  // --- Click Handlers ---

  const handleRotateCreature = (creatureId: string) => {
    console.log('[GameScreen] handleRotateCreature called for creature:', creatureId);
    if (!currentPlayerId) return;
    handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId } });
  };

  const handleDrawKnowledge = (knowledgeId: string) => {
    if (!currentPlayerId) return;
    handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: currentPlayerId, knowledgeId } });
  };

  const handleHandCardClick = (knowledgeId: string) => {
    // Start the summon process: select the knowledge card
    setSelectedKnowledgeId(knowledgeId);
    console.log(`Selected knowledge card ${knowledgeId} to summon. Click a creature to target.`);
    setError(`Selected ${state?.players[state.currentPlayerIndex].hand.find(k=>k.id === knowledgeId)?.name}. Click a creature to summon onto.`); // Provide feedback
  };

  const handleCreatureClickForSummon = (creatureId: string) => {
    if (!currentPlayerId || !selectedKnowledgeId) return; // Only proceed if a knowledge card is selected

    // Clear error message related to selection prompt
    setError(null);

    handleAction({
      type: 'SUMMON_KNOWLEDGE',
      payload: { playerId: currentPlayerId, knowledgeId: selectedKnowledgeId, creatureId }
    });
    // handleAction will clear selectedKnowledgeId on success
  };

  const handleEndTurn = () => {
    if (!currentPlayerId) return;
    handleAction({ type: 'END_TURN', payload: { playerId: currentPlayerId } });
  };

  // --- Render Logic ---

  if (loading) return <div className="text-center p-10">Loading game...</div>;
  if (!state) return <div className="text-center p-10">Game data not available.</div>;

  const currentPlayer: PlayerState | undefined = state.players[state.currentPlayerIndex];
  const opponentPlayer: PlayerState | undefined = state.players[(state.currentPlayerIndex + 1) % 2];
  const isMyTurn = currentPlayer?.id === currentPlayerId;

  if (!currentPlayer || !opponentPlayer) {
      return <div className="text-center p-10 text-red-500">Error: Player data is missing.</div>;
  }

  // Helper: get rotation for beings/spells
  const beingRotation = (isOpponent: boolean) => isOpponent ? 180 : 0;
  const spellRotation = (isOpponent: boolean) => isOpponent ? 180 : 0;

  // Helper: get hand for display (backs for opponent)
  const renderHand = (hand: Knowledge[], isOpponent: boolean) => (
    <div className={`flex ${isOpponent ? 'flex-col' : 'flex-row'} items-center gap-1 p-1`}>
      {hand.length === 0 && <Card card={{id:'back',name:'Back',image:'/images/spells/back.jpg',type:'spell',cost:0,effect:''}} showBack size="small" />}
      {hand.map((card, idx) => (
        <Card key={card.id+idx} card={card} showBack={isOpponent} size="small" />
      ))}
    </div>
  );

  // Market deck (remaining)
  const marketDeckCount = state.knowledgeDeck.length;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* TOP BAR */}
      <div className="flex justify-between items-center px-4 py-2 bg-black/75 text-gray-200 text-xs md:text-sm">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">Game: {gameId}</span>
          <span>Turn: {state.turn}</span>
          <span>| </span>
          <span>Phase: <span className="uppercase font-semibold">{state.phase}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-300">Your Power: {currentPlayer.power}</span>
          <span>|</span>
          <span className="text-red-300">Opponent: {opponentPlayer.power}</span>
          <span>|</span>
          <span className="text-yellow-300">Actions: {2 - state.actionsTakenThisTurn}/2</span>
          <span>|</span>
          <span className="text-blue-300">Market: {state.market.length}</span>
          {selectedKnowledgeId && (
            <button onClick={() => { setSelectedKnowledgeId(null); setError(null); }} className="px-2 py-0.5 rounded bg-yellow-700 hover:bg-yellow-600 text-xs font-bold text-white transition-colors">Cancel</button>
          )}
        </div>
      </div>

      {error && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-3 py-1 rounded-full text-sm">
          {error}
        </div>
      )}

      {/* Main Game Grid: 3 columns [Market | Table | Hands] */}
      <div className="w-full h-[calc(100vh-3rem)] grid grid-cols-[15vw_1fr_15vw] gap-1 items-center">
        {/* MARKET (left column) */}
        <div className="h-full flex flex-col items-center space-y-2 py-4 px-2 bg-blue-900/20 rounded-lg overflow-y-auto">
          {/* Deck */}
          <div className="relative w-full max-w-[15vw] aspect-[2/3]">
            <Card card={{id:'marketdeck',name:'Deck',image:'/images/spells/back.jpg',type:'spell',cost:0,effect:''}} showBack size="small" />
            <span className="absolute -right-2 -bottom-2 bg-black/70 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{marketDeckCount}</span>
          </div>

          {/* Market Cards */}
          {state.market.map((card) => (
            <div key={card.id} className="w-full max-w-[14vw] h-auto">
              <Card
                card={card}
                onClick={isMyTurn && state.phase === 'action' ? handleDrawKnowledge : undefined}
                size="fit"
              />
            </div>
          ))}
        </div>

        {/* TABLE (center area) - 4 row grid with responsive sizing */}
        <div className="grid grid-cols-3 grid-rows-4 gap-1 justify-items-center items-center w-full h-full">
          {/* Row 1: Opponent Beings */}
          {opponentPlayer.creatures.map((creature) => (
            <div key={creature.id} className="w-full h-full flex items-center justify-center">
              <Card card={creature} rotation={180} size="fill" />
            </div>
          ))}

          {/* Row 2: Opponent Spells */}
          {opponentPlayer.field.map((slot, idx) => (
            <div key={slot.creatureId + idx} className="w-full h-full flex items-center justify-center">
              {slot.knowledge ? (
                <Card card={slot.knowledge} rotation={180} size="fill" />
              ) : (
                <div className="w-full h-full border border-dashed border-gray-500/50 rounded-lg"></div>
              )}
            </div>
          ))}

          {/* Row 3: Player Spells */}
          {currentPlayer.field.map((slot, idx) => (
            <div key={slot.creatureId + idx + 10} className="w-full h-full flex items-center justify-center">
              {slot.knowledge ? (
                <Card card={slot.knowledge} size="fill" />
              ) : (
                <div className="w-full h-full border border-dashed border-gray-500/50 rounded-lg"></div>
              )}
            </div>
          ))}

          {/* Row 4: Player Beings */}
          {currentPlayer.creatures.map((creature) => (
            <div key={creature.id} className="w-full h-full flex items-center justify-center">
              <Card
                key={creature.id}
                card={creature}
                onClick={
                  isMyTurn && state.phase === 'action'
                    ? selectedKnowledgeId
                      ? handleCreatureClickForSummon
                      : handleRotateCreature
                    : undefined
                }
                rotation={0}
                size="fill"
                isSelected={selectedKnowledgeId !== null}
              />
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN: PLAYER AND OPPONENT HANDS */}
        <div className="relative h-full w-full">
          {/* Opponent Name */}
          <div className="absolute top-2 left-0 right-0 flex justify-center text-gray-400">
            <span>Opponent's Hand ({opponentPlayer.hand.length})</span>
          </div>
          {/* Opponent Hand (top) */}
          <div className="relative h-full w-full flex items-start justify-start pt-1">
            {opponentPlayer.hand.map((card, idx) => (
              <div
                key={card.id + idx}
                className="absolute transition-all duration-200"
                style={{ 
                  left: `${idx * 6}vw`, 
                  top: '20px',
                  zIndex: idx + 1
                }}
              >
                <Card card={card} showBack size="fit" />
              </div>
            ))}
            {opponentPlayer.hand.length === 0 && (
              <div className="absolute left-0 top-[50px]">
                <Card card={{id:'back',name:'Back',image:'/images/spells/back.jpg',type:'spell',cost:0,effect:''}} showBack size="fit" />
              </div>
            )}
          </div>
          {/* Player Name */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center text-gray-400">
            <span>Your Hand ({currentPlayer.hand.length}/5)</span>
          </div>
          {/* Player Hand (bottom) */}
          <div className="relative h-full w-full flex items-end justify-start pb-1">
            {currentPlayer.hand.map((card, idx) => (
              <div
                key={card.id}
                className="absolute transition-all duration-200"
                // NOTE: This positioning is a bit buggy, cards are not centered relative to the position. 
                style={{ 
                  left: `${idx * 6}vw`, 
                  bottom: selectedKnowledgeId === card.id ? '20px' : '5px',
                  zIndex: 10 + idx,
                  transform: `rotate(${-10 + idx * 5}deg)`
                }}
              >
                <Card
                  card={card}
                  onClick={isMyTurn && state.phase === 'action' ? handleHandCardClick : undefined}
                  size="fit"
                  isSelected={selectedKnowledgeId === card.id}
                />
              </div>
            ))}
            {currentPlayer.hand.length === 0 && (
              <div className="absolute left-0 bottom-[50px]">
                <Card card={{id:'back',name:'Back',image:'/images/spells/back.jpg',type:'spell',cost:0,effect:''}} showBack size="fit" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons & Game Status */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center px-4 py-2 bg-black/50 h-10">
        <div className="flex gap-2">
          {isMyTurn && state.phase === 'action' && state.winner === null && (
            <button
              onClick={handleEndTurn}
              disabled={state.actionsTakenThisTurn < 2}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors
                ${state.actionsTakenThisTurn < 2 ? 
                  'bg-gray-600 cursor-not-allowed' : 
                  'bg-red-700 hover:bg-red-600 text-white'}`}
            >
              End Turn
            </button>
          )}
        </div>
        
        <div className="text-xs text-gray-300">
          {isMyTurn ? 
            <span className="text-green-300 font-bold">Your turn</span> : 
            <span className="text-red-300">Opponent's turn</span>
          }
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
