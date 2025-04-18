import React, { useState, useEffect } from 'react'; // Import useState
import { PlayerState } from '../game/types'; // Keep necessary types

// Import Hooks
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { useGameActions } from '../hooks/useGameActions';

// Import UI Components
import TopBar from '../components/game/TopBar';
import Card from '../components/Card';
import ActionBar from '../components/game/ActionBar';

const GameScreen: React.FC = () => {
  // --- State and Hooks ---
  const [currentPlayerId, , playerError, setPlayerError] = usePlayerIdentification();
  // Add state for action messages/prompts
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
    // Pass setActionMessage instead of setPlayerError for action feedback
  } = useGameActions(state, dispatch, gameId, currentPlayerId, setActionMessage);

  // Log state phase whenever it changes
  useEffect(() => {
    if (state) {
      console.log('[GameScreen] State updated. Current phase:', state.phase);
    }
  }, [state]);

  // --- Render Logic ---
  if (loading) return <div className="text-center p-10">Loading game...</div>;
  // This error is only for critical player ID issues now
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

  // Old logic based on turn:
  // const currentPlayer: PlayerState | undefined = state.players[state.currentPlayerIndex];
  // const opponentPlayer: PlayerState | undefined = state.players[(state.currentPlayerIndex + 1) % 2];
  // const isMyTurn = currentPlayer?.id === currentPlayerId;

  // if (!currentPlayer || !opponentPlayer) {
  //     return <div className="text-center p-10 text-red-500">Error: Player data is missing.</div>;
  // }

  const actionsRemaining = 2 - state.actionsTakenThisTurn;

  // --- Helper for unified grid ---
  // Market: deck + 3 cards
  const marketDeck = { id: 'marketdeck', name: 'Deck', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '' };
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
    const props: any = {};

    // Market cards (draw knowledge) - Action enabled only if it's my turn
    if (location === 'market' && isMyTurn && state.phase === 'action' && card) {
      props.onClick = () => handleDrawKnowledge(card.id);
    }
    // Player hand (play knowledge) - Action enabled only if it's my turn
    if (location === 'player-hand' && isMyTurn && state.phase === 'action' && card) {
      props.onClick = () => handleHandCardClick(card.id);
      props.isSelected = selectedKnowledgeId === card.id;
    }
    // Player creatures (rotate or summon knowledge) - Action enabled only if it's my turn
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
      // Highlight if selecting knowledge (only relevant if it's my turn)
      props.isSelected = isMyTurn && selectedKnowledgeId !== null;
      props.rotation = card.rotation ?? 0;
    }
    // Opponent creatures (show rotation, always 180 degrees relative to local player)
    if (location === 'opp-creature' && card) {
      // Assuming card.rotation is stored relative to the owner
      // We display it rotated 180 degrees from the local perspective
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
    // Opponent knowledge (show rotation, always 180 degrees relative to local player)
    if (location === 'opp-knowledge' && card) {
      // Assuming card.rotation is stored relative to the owner
      props.rotation = (card.rotation ?? 0) + 180;
    }

    return (
      <div 
        key={key} 
        className="w-full h-full flex items-center justify-center relative group transform transition-transform duration-300 ease-in-out hover:scale-[1.5] hover:z-20"
      >
        {card ? <Card card={card} {...props} /> : <div className="w-full h-full border border-dashed border-gray-500/50 rounded-lg bg-gray-800/40" />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gray-100 grid grid-rows-[auto_1fr_auto] gap-6">
      {/* TopBar uses localPlayer and remotePlayer for power display */}
      <div>
        <div className="bg-white border-b-4 border-blue-200 shadow-lg">
          <TopBar
            gameId={gameId}
            turn={state.turn}
            phase={state.phase}
            // Display local player power and remote player power consistently
            currentPlayerPower={localPlayer.power}
            opponentPlayerPower={remotePlayer.power}
            actionsRemaining={actionsRemaining}
            marketCount={state.market.length}
            selectedKnowledgeId={selectedKnowledgeId}
            onCancelSelection={cancelSelection}
          />
        </div>
      </div>

      {/* Display action messages/prompts */}
      {actionMessage && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-sm shadow-lg">
          {actionMessage}
        </div>
      )}
      {/* Unified 4x8 grid - References updated to remote/local */}
      <div className="px-4 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-lg mx-4 flex flex-col justify-center items-center">
        <div className="grid grid-cols-8 grid-rows-4 gap-2 w-full h-full max-w-screen-lg mx-auto py-8">
          {/* Row 1: Market deck, Remote creatures, Remote hand */}
          <div className="col-start-1 row-start-1 row-span-1 aspect-[2/3]">{renderCardSlot(marketDeck, 'marketdeck', 'market-deck')}</div>
          {[0,1,2].map(i => <div key={'oc'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 1}}>{renderCardSlot(remoteCreatures[i], 'oc'+i, 'opp-creature')}</div>)}
          {[0,1,2,3].map(i => <div key={'oh'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 1}}>{renderCardSlot(remoteHand[i], 'oh'+i, 'opp-hand')}</div>)}
          {/* Row 2: Market card 1, Remote knowledges */}
          <div className="col-start-1 row-start-2 aspect-[2/3]">{renderCardSlot(marketCards[0], 'market1', 'market')}</div>
          {[0,1,2].map(i => <div key={'ok'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 2}}>{renderCardSlot(remoteKnowledges[i], 'ok'+i, 'opp-knowledge')}</div>)}
          {/* Empty slots for alignment */}
          {[0,1,2,3].map(i => <div key={'eh2'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 2}}>{renderCardSlot(null, 'eh2'+i, 'empty')}</div>)}
          {/* Row 3: Market card 2, Local knowledges */}
          <div className="col-start-1 row-start-3 aspect-[2/3]">{renderCardSlot(marketCards[1], 'market2', 'market')}</div>
          {[0,1,2].map(i => <div key={'pk'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 3}}>{renderCardSlot(localKnowledges[i], 'pk'+i, 'player-knowledge')}</div>)}
          {/* Empty slots for alignment */}
          {[0,1,2,3].map(i => <div key={'eh3'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 3}}>{renderCardSlot(null, 'eh3'+i, 'empty')}</div>)}
          {/* Row 4: Market card 3, Local creatures, Local hand */}
          <div className="col-start-1 row-start-4 aspect-[2/3]">{renderCardSlot(marketCards[2], 'market3', 'market')}</div>
          {[0,1,2].map(i => <div key={'pc'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 4}}>{renderCardSlot(localCreatures[i], 'pc'+i, 'player-creature')}</div>)}
          {[0,1,2,3].map(i => <div key={'ph'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 4}}>{renderCardSlot(localHand[i], 'ph'+i, 'player-hand')}</div>)}
        </div>
      </div>

      {/* ActionBar uses isMyTurn to enable/disable End Turn button */}
      <div>
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
    </div>
  );
};

export default GameScreen;
