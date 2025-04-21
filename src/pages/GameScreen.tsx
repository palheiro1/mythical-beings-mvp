import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom'; // Import useParams
import { PlayerState } from '../game/types';

// Import Hooks
import { usePlayerIdentification } from '../hooks/usePlayerIdentification'; // Added missing import
import { useGameInitialization } from '../hooks/useGameInitialization'; // Added missing import
import { useGameActions } from '../hooks/useGameActions';

// Import UI Components
import TopBar from '../components/game/TopBar';
import Card from '../components/Card';
import ActionBar from '../components/game/ActionBar';
import Logs from '../components/game/Logs'; // Import the new Logs component

const ACTIONS_PER_TURN = 2;
const TURN_DURATION = 30;

const GameScreen: React.FC = () => {
  // --- State and Hooks ---
  const { gameId } = useParams<{ gameId: string }>(); // Get gameId from URL
  const [currentPlayerId, , playerError, setPlayerError] = usePlayerIdentification();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [state, dispatch, loading] = useGameInitialization(currentPlayerId, setPlayerError); // Remove gameId from the arguments passed to useGameInitialization
  const [turnTimer, setTurnTimer] = useState<number>(TURN_DURATION); // State for the timer
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID
  const [isSpectator, setIsSpectator] = useState<boolean | null>(null); // Initialize as null

  const {
    selectedKnowledgeId,
    handleRotateCreature,
    handleDrawKnowledge,
    handleHandCardClick,
    handleCreatureClickForSummon,
    handleEndTurn,
    cancelSelection,
  } = useGameActions(state, dispatch, gameId, currentPlayerId, setActionMessage); // Pass gameId to useGameActions as well

  // Determine local player index (only relevant if not spectator)
  const localPlayerIndex = state && currentPlayerId ? state.players.findIndex(p => p.id === currentPlayerId) : -1;
  const isMyTurn = !isSpectator && state ? state.currentPlayerIndex === localPlayerIndex : false;

  // Determine if the current user is a player or spectator once state is loaded
  useEffect(() => {
    if (state && currentPlayerId !== null && isSpectator === null) { // Check only once when state is loaded
      const isPlayerInGame = state.players.some(p => p.id === currentPlayerId);
      setIsSpectator(!isPlayerInGame);
      console.log(`[GameScreen] User is ${!isPlayerInGame ? 'Spectator' : 'Player'}. Player ID: ${currentPlayerId}`);
    }
  }, [state, currentPlayerId, isSpectator]); // Depend on state, currentPlayerId, and isSpectator itself

  // Log state phase whenever it changes
  useEffect(() => {
    if (state) {
      console.log('[GameScreen] State updated. Current phase:', state.phase);
    }
  }, [state]);

  // Effect to automatically end turn when actions are depleted
  useEffect(() => {
    // Add check for state.phase === 'action'
    if (state && isMyTurn && state.phase === 'action' && state.actionsTakenThisTurn >= ACTIONS_PER_TURN) {
      console.log('[GameScreen] Actions depleted, automatically ending turn.');
      handleEndTurn();
    }
    // Keep dependencies as they were, the check is now inside
  }, [state, isMyTurn, handleEndTurn]); // Dependencies might need refinement based on testing

  // Effect to manage the turn timer
  useEffect(() => {
    const clearTimerInterval = () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };

    // Start timer only if it's my turn, action phase, and game not ended
    if (isMyTurn && state?.phase === 'action' && state?.winner === null) {
      setTurnTimer(TURN_DURATION); // Reset timer
      clearTimerInterval(); // Clear previous interval just in case

      timerIntervalRef.current = setInterval(() => {
        setTurnTimer(prevTimer => {
          if (prevTimer <= 1) {
            clearTimerInterval();
            // Check conditions again *inside* the callback using latest state via closure or ref
            // Since state is not a dependency, we rely on the initial check and handleEndTurn's internal logic
            // Or, more robustly, get current state if needed, but handleEndTurn should handle it.
            console.log('[TimerEffect] Timer expired. Attempting to end turn.');
            handleEndTurn(); // handleEndTurn should ideally check conditions internally
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);

    } else {
      // Clear timer if conditions are not met
      clearTimerInterval();
    }

    // Cleanup function
    return () => {
      clearTimerInterval();
    };
    // Refined Dependencies: Only re-run if these specific conditions change
  }, [isMyTurn, state?.phase, state?.winner, handleEndTurn, localPlayerIndex]);

  // --- Render Logic ---
  // 1. Handle Loading State
  if (loading) {
    console.log("[Render] Showing Loading Game..."); // Log render state
    return <div className="text-center p-10">Loading game...</div>;
  }

  // 2. Handle Errors
  if (playerError) {
    console.log("[Render] Showing Player Error:", playerError); // Log render state
    return <div className="text-center p-10 text-red-500">Error: {playerError}</div>;
  }

  // 3. Handle Missing Player ID (should ideally not happen after loading)
  if (!currentPlayerId) {
    console.log("[Render] Showing Identifying Player..."); // Log render state
    return <div className="text-center p-10">Identifying player...</div>;
  }

  // 4. Handle Missing Game State (should ideally not happen after loading)
  if (!state) {
    console.log("[Render] Showing Loading Game Data..."); // Log render state
    return <div className="text-center p-10">Loading game data for {gameId}...</div>;
  }

  // 5. Handle Spectator status not yet determined
  if (isSpectator === null) {
    console.log("[Render] Determining player/spectator status..."); // Log render state
    return <div className="text-center p-10">Checking player status...</div>;
  }

  // 6. Determine players for display AFTER loading and state checks
  let localPlayer: PlayerState | undefined;
  let remotePlayer: PlayerState | undefined;

  if (!isSpectator) {
    if (localPlayerIndex === -1) {
      // This case means loading is done, state exists, user ID exists, but user is not in state.players AND not spectator
      console.error("[Render] Error: Could not identify local player in game state."); // Log render state
      return <div className="text-center p-10 text-red-500">Error: Could not identify local player in game state.</div>;
    }
    localPlayer = state.players[localPlayerIndex];
    remotePlayer = state.players[(localPlayerIndex + 1) % 2];
  } else { // User is a spectator
    localPlayer = state.players[0]; // Display player 0 as "local" for spectators
    remotePlayer = state.players[1]; // Display player 1 as "remote"
  }

  // Ensure players are defined before proceeding (should be guaranteed by checks above)
  if (!localPlayer || !remotePlayer) {
    console.error("[Render] Error: Game player data incomplete."); // Log render state
    return <div className="text-center p-10 text-red-500">Error: Game data incomplete.</div>;
  }

  console.log("[Render] Rendering main game screen."); // Log render state

  const actionsRemaining = ACTIONS_PER_TURN - state.actionsTakenThisTurn;

  // --- Helper for unified grid ---
  const marketDeck = { id: 'marketdeck', name: 'Deck', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'none' };
  const marketCards = state.market.slice(0, 3);

  // Table: Use localPlayer for bottom, remotePlayer for top
  const remoteCreatures = remotePlayer.creatures.slice(0, 3);
  const remoteKnowledges = remotePlayer.field.map(f => f.knowledge).slice(0, 3);
  const localCreatures = localPlayer.creatures.slice(0, 3);
  const localKnowledges = localPlayer.field.map(f => f.knowledge).slice(0, 3);
  // Hands: Use localPlayer for bottom, remotePlayer for top
  const remoteHand = remotePlayer.hand.slice(0, 4);
  const localHand = localPlayer.hand.slice(0, 4);

  // Function to render a card slot
  const renderCardSlot = (card: any, key: string, location: string) => {
    const props: any = { key: key };
    // Use the already determined isSpectator and isMyTurn
    const canInteract = !isSpectator && isMyTurn && state.phase === 'action';

    // Market cards (draw knowledge) - only if player & can interact
    if (location === 'market' && canInteract && card) {
      props.onClick = () => handleDrawKnowledge(card.id);
    }
    // Player hand (play knowledge) - only if player & can interact
    if (location === 'player-hand' && canInteract && card) {
      props.onClick = () => handleHandCardClick(card.id);
      props.isSelected = selectedKnowledgeId === card.id;
    }
    // Player creatures (rotate or summon knowledge) - only if player & can interact
    if (location === 'player-creature' && card) {
      if (canInteract) {
        props.onClick = () => {
          if (selectedKnowledgeId) {
            handleCreatureClickForSummon(card.id);
          } else {
            handleRotateCreature(card.id);
          }
        };
        // Use optional chaining on localPlayer
        const creatureHasKnowledge = localPlayer?.field.some(f => f.creatureId === card.id && f.knowledge !== null);
        props.isSelected = selectedKnowledgeId !== null && !creatureHasKnowledge;
      }
      props.rotation = card.rotation ?? 0;
    }
    // Opponent creatures (show rotation)
    if (location === 'opp-creature' && card) {
      props.rotation = (card.rotation ?? 0) + 180;
    }
    // Opponent hand (show back)
    if (location === 'opp-hand' && card) {
      props.showBack = true;
    }
    // Player hand (show back if spectator)
    if (location === 'player-hand' && isSpectator && card) {
      props.showBack = true;
    }
    // Market deck (show back)
    if (location === 'market-deck') {
      props.showBack = true;
    }
    // Player knowledge (show rotation)
    if (location === 'player-knowledge' && card) {
      props.rotation = card.rotation ?? 0;
    }
    // Opponent knowledge (show rotation)
    if (location === 'opp-knowledge' && card) {
      props.rotation = (card.rotation ?? 0) + 180;
    }

    // Render the Card component or an empty slot
    return (
      <div className={`aspect-[2/3] flex justify-center items-center bg-black/20 rounded-md overflow-hidden transition-transform duration-200 ${canInteract && card ? 'hover:scale-200 hover:z-10 cursor-pointer' : 'hover:scale-110'}`}>
        {card ? <Card card={card} {...props} /> : <div className="w-full h-full"></div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gray-100 grid grid-rows-[auto_1fr_auto] gap-2">
      {/* TopBar */}
      <div className="bg-white border-b-4 border-blue-200 shadow-lg">
        <TopBar
          gameId={gameId}
          turn={state.turn}
          phase={state.phase}
          // Use the defined localPlayer/remotePlayer
          currentPlayerPower={localPlayer.power}
          opponentPlayerPower={remotePlayer.power}
          actionsRemaining={actionsRemaining}
          marketCount={state.market.length}
          selectedKnowledgeId={selectedKnowledgeId}
          onCancelSelection={isSpectator ? undefined : cancelSelection}
          isSpectator={isSpectator}
        />
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-sm shadow-lg">
          {actionMessage}
        </div>
      )}

      {/* Main content area: Grid + Logs */}
      <div className="grid grid-cols-[1fr_300px] gap-4 px-4 overflow-hidden">

        {/* Left Column: Game Grid */}
        <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-lg flex flex-col justify-center items-center p-4 overflow-hidden h-full">
          {/* The 4x8 grid itself */}
          <div className="grid grid-cols-8 grid-rows-4 gap-2 w-full h-full max-w-screen-lg mx-auto">
            {/* Row 1: Market deck, Remote creatures, Remote hand */}
            <div className="col-start-1 row-start-1">{renderCardSlot(marketDeck, 'marketdeck', 'market-deck')}</div>
            {[0, 1, 2].map(i => <div key={'oc' + i} style={{ gridColumnStart: 2 + i, gridRowStart: 1 }}>{renderCardSlot(remoteCreatures[i], 'oc' + i, 'opp-creature')}</div>)}
            {[0, 1, 2, 3].map(i => <div key={'oh' + i} style={{ gridColumnStart: 5 + i, gridRowStart: 1 }}>{renderCardSlot(remoteHand[i], 'oh' + i, 'opp-hand')}</div>)}
            {/* Row 2: Market card 1, Remote knowledges */}
            <div className="col-start-1 row-start-2">{renderCardSlot(marketCards[0], 'market1', 'market')}</div>
            {[0, 1, 2].map(i => <div key={'ok' + i} style={{ gridColumnStart: 2 + i, gridRowStart: 2 }}>{renderCardSlot(remoteKnowledges[i], 'ok' + i, 'opp-knowledge')}</div>)}
            {[0, 1, 2, 3].map(i => <div key={'eh2' + i} style={{ gridColumnStart: 5 + i, gridRowStart: 2 }}>{renderCardSlot(null, 'eh2' + i, 'empty')}</div>)}
            {/* Row 3: Market card 2, Local knowledges */}
            <div className="col-start-1 row-start-3">{renderCardSlot(marketCards[1], 'market2', 'market')}</div>
            {[0, 1, 2].map(i => <div key={'pk' + i} style={{ gridColumnStart: 2 + i, gridRowStart: 3 }}>{renderCardSlot(localKnowledges[i], 'pk' + i, 'player-knowledge')}</div>)}
            {[0, 1, 2, 3].map(i => <div key={'eh3' + i} style={{ gridColumnStart: 5 + i, gridRowStart: 3 }}>{renderCardSlot(null, 'eh3' + i, 'empty')}</div>)}
            {/* Row 4: Market card 3, Local creatures, Local hand */}
            <div className="col-start-1 row-start-4">{renderCardSlot(marketCards[2], 'market3', 'market')}</div>
            {[0, 1, 2].map(i => <div key={'pc' + i} style={{ gridColumnStart: 2 + i, gridRowStart: 4 }}>{renderCardSlot(localCreatures[i], 'pc' + i, 'player-creature')}</div>)}
            {[0, 1, 2, 3].map(i => <div key={'ph' + i} style={{ gridColumnStart: 5 + i, gridRowStart: 4 }}>{renderCardSlot(localHand[i], 'ph' + i, 'player-hand')}</div>)}
          </div>
        </div>

        {/* Right Column: Logs Component Area */}
        <div className="h-full overflow-hidden">
          <Logs logs={state.log} />
        </div>
      </div>

      {/* ActionBar */}
      <div className="bg-white border-t-4 border-blue-200 shadow-lg">
        <ActionBar
          isMyTurn={!isSpectator && isMyTurn}
          phase={state.phase}
          winner={state.winner}
          actionsTaken={state.actionsTakenThisTurn}
          onEndTurn={isSpectator ? undefined : handleEndTurn}
          turnTimer={turnTimer}
          actionsPerTurn={ACTIONS_PER_TURN}
          isSpectator={isSpectator}
        />
      </div>
    </div>
  );
};

export default GameScreen;
