import React, { useState, useEffect } from 'react';
import { PlayerState, Knowledge } from '../game/types'; // Keep necessary types, added Knowledge

// Import Hooks
import { usePlayerIdentification } from '../hooks/usePlayerIdentification'; // Added missing import
import { useGameInitialization } from '../hooks/useGameInitialization'; // Added missing import
import { useGameActions } from '../hooks/useGameActions';

// Import UI Components
import TopBar from '../components/game/TopBar';
import Card from '../components/Card';
import ActionBar from '../components/game/ActionBar';
import Logs from '../components/game/Logs'; // Import the new Logs component

const GameScreen: React.FC = () => {
  // --- State and Hooks ---
  const [currentPlayerId, , playerError, setPlayerError] = usePlayerIdentification();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [state, dispatch, loading, gameId] = useGameInitialization(currentPlayerId, setPlayerError);
  const {
    selectedKnowledgeId,
    handleRotateCreature,
    handleDrawKnowledge,
    handleHandCardClick,
    handleCreatureClickForSummon,
    handleEndTurn,
    cancelSelection,
  } = useGameActions(state, dispatch, gameId, currentPlayerId, setActionMessage);

  // Log state phase whenever it changes
  useEffect(() => {
    if (state) {
      console.log('[GameScreen] State updated. Current phase:', state.phase);
    }
  }, [state]);


  // --- Render Logic ---
  if (loading) return <div className="text-center p-10">Loading game...</div>;
  if (playerError) return <div className="text-center p-10 text-red-500">{playerError}</div>;
  if (!state) return <div className="text-center p-10">Game data not available.</div>;

  // Determine local player (always at the bottom) and remote player (always at the top)
  const localPlayerIndex = state.players.findIndex(p => p.id === currentPlayerId);
  // Handle case where currentPlayerId might not be in players yet (shouldn't happen in normal flow)
  if (localPlayerIndex === -1) {
      return <div className="text-center p-10 text-red-500">Error: Could not identify local player.</div>;
  }
  const localPlayer: PlayerState = state.players[localPlayerIndex];
  const remotePlayer: PlayerState = state.players[(localPlayerIndex + 1) % 2];

  // Determine if it's the local player's turn based on the game state's currentPlayerIndex
  const isMyTurn = state.currentPlayerIndex === localPlayerIndex;

  const actionsRemaining = 2 - state.actionsTakenThisTurn;


  // --- Helper for unified grid ---
  // Market: deck + 3 cards
  const marketDeck = { id: 'marketdeck', name: 'Deck', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'none' }; // Added element none
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
    const props: any = { key: key }; // Add key prop here

    // Market cards (draw knowledge)
    if (location === 'market' && isMyTurn && state.phase === 'action' && card) {
      props.onClick = () => handleDrawKnowledge(card.id);
    }
    // Player hand (play knowledge)
    if (location === 'player-hand' && isMyTurn && state.phase === 'action' && card) {
      props.onClick = () => handleHandCardClick(card.id);
      props.isSelected = selectedKnowledgeId === card.id;
    }
    // Player creatures (rotate or summon knowledge)
    if (location === 'player-creature' && card) {
      props.onClick = () => {
        if (isMyTurn && state.phase === 'action') {
          if (selectedKnowledgeId) {
            handleCreatureClickForSummon(card.id);
          } else {
            handleRotateCreature(card.id);
          }
        }
      };
      props.isSelected = isMyTurn && selectedKnowledgeId !== null && !localPlayer.field.some(f => f.creature?.id === card.id && f.knowledge); // Highlight if selectable for summon
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
      // Change hover:scale-110 to hover:scale-200 for a larger zoom
      <div className="aspect-[2/3] flex justify-center items-center bg-black/20 rounded-md overflow-hidden transition-transform duration-200 hover:scale-200 hover:z-10">
        {card ? <Card card={card} {...props} /> : <div className="w-full h-full"></div>}
      </div>
    );
  };


  return (
    // Main screen layout: TopBar, Content (Grid + Logs), ActionBar
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gray-100 grid grid-rows-[auto_1fr_auto] gap-2">
      {/* TopBar */}
      <div className="bg-white border-b-4 border-blue-200 shadow-lg">
        <TopBar
          gameId={gameId}
          turn={state.turn}
          phase={state.phase}
          currentPlayerPower={localPlayer.power}
          opponentPlayerPower={remotePlayer.power}
          actionsRemaining={actionsRemaining}
          marketCount={state.market.length}
          selectedKnowledgeId={selectedKnowledgeId}
          onCancelSelection={cancelSelection}
        />
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-sm shadow-lg">
          {actionMessage}
        </div>
      )}

      {/* Main content area: Grid + Logs */}
      {/* Use grid layout with 2 columns: main game area and logs */}
      <div className="grid grid-cols-[1fr_300px] gap-4 px-4 overflow-hidden">

        {/* Left Column: Game Grid */}
        <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-lg flex flex-col justify-center items-center p-4 overflow-hidden h-full">
          {/* The 4x8 grid itself */}
          <div className="grid grid-cols-8 grid-rows-4 gap-2 w-full h-full max-w-screen-lg mx-auto">
            {/* Row 1: Market deck, Remote creatures, Remote hand */}
            <div className="col-start-1 row-start-1">{renderCardSlot(marketDeck, 'marketdeck', 'market-deck')}</div>
            {[0,1,2].map(i => <div key={'oc'+i} style={{gridColumnStart: 2+i, gridRowStart: 1}}>{renderCardSlot(remoteCreatures[i], 'oc'+i, 'opp-creature')}</div>)}
            {[0,1,2,3].map(i => <div key={'oh'+i} style={{gridColumnStart: 5+i, gridRowStart: 1}}>{renderCardSlot(remoteHand[i], 'oh'+i, 'opp-hand')}</div>)}
            {/* Row 2: Market card 1, Remote knowledges */}
            <div className="col-start-1 row-start-2">{renderCardSlot(marketCards[0], 'market1', 'market')}</div>
            {[0,1,2].map(i => <div key={'ok'+i} style={{gridColumnStart: 2+i, gridRowStart: 2}}>{renderCardSlot(remoteKnowledges[i], 'ok'+i, 'opp-knowledge')}</div>)}
            {[0,1,2,3].map(i => <div key={'eh2'+i} style={{gridColumnStart: 5+i, gridRowStart: 2}}>{renderCardSlot(null, 'eh2'+i, 'empty')}</div>)}
            {/* Row 3: Market card 2, Local knowledges */}
            <div className="col-start-1 row-start-3">{renderCardSlot(marketCards[1], 'market2', 'market')}</div>
            {[0,1,2].map(i => <div key={'pk'+i} style={{gridColumnStart: 2+i, gridRowStart: 3}}>{renderCardSlot(localKnowledges[i], 'pk'+i, 'player-knowledge')}</div>)}
            {[0,1,2,3].map(i => <div key={'eh3'+i} style={{gridColumnStart: 5+i, gridRowStart: 3}}>{renderCardSlot(null, 'eh3'+i, 'empty')}</div>)}
            {/* Row 4: Market card 3, Local creatures, Local hand */}
            <div className="col-start-1 row-start-4">{renderCardSlot(marketCards[2], 'market3', 'market')}</div>
            {[0,1,2].map(i => <div key={'pc'+i} style={{gridColumnStart: 2+i, gridRowStart: 4}}>{renderCardSlot(localCreatures[i], 'pc'+i, 'player-creature')}</div>)}
            {[0,1,2,3].map(i => <div key={'ph'+i} style={{gridColumnStart: 5+i, gridRowStart: 4}}>{renderCardSlot(localHand[i], 'ph'+i, 'player-hand')}</div>)}
          </div>
        </div>

        {/* Right Column: Logs Component Area */}
        <div className="h-full overflow-hidden"> {/* Container to constrain height */}
          <Logs logs={state.log} />
        </div>
      </div>

      {/* ActionBar */}
      <div className="bg-white border-t-4 border-blue-200 shadow-lg">
        <ActionBar
          isMyTurn={isMyTurn}
          phase={state.phase}
          winner={state.winner}
          actionsTaken={state.actionsTakenThisTurn}
          onEndTurn={handleEndTurn}
        />
      </div>
    </div>
  );
};

export default GameScreen;
