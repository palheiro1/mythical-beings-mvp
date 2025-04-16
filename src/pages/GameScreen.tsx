import React, { useState } from 'react'; // Import useState
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

  // --- Render Logic ---
  if (loading) return <div className="text-center p-10">Loading game...</div>;
  // This error is only for critical player ID issues now
  if (playerError) return <div className="text-center p-10 text-red-500">{playerError}</div>;
  if (!state) return <div className="text-center p-10">Game data not available.</div>;

  const currentPlayer: PlayerState | undefined = state.players[state.currentPlayerIndex];
  const opponentPlayer: PlayerState | undefined = state.players[(state.currentPlayerIndex + 1) % 2];
  const isMyTurn = currentPlayer?.id === currentPlayerId;

  if (!currentPlayer || !opponentPlayer) {
      return <div className="text-center p-10 text-red-500">Error: Player data is missing.</div>;
  }

  const actionsRemaining = 2 - state.actionsTakenThisTurn;

  // --- Helper for unified grid ---
  // Market: deck + 3 cards
  const marketDeck = { id: 'marketdeck', name: 'Deck', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '' };
  const marketCards = state.market.slice(0, 3);
  console.log('marketCards:', marketCards);
  // Table: 3 creatures per player, 3 knowledge per player
  const oppCreatures = opponentPlayer.creatures.slice(0, 3);
  const oppKnowledges = opponentPlayer.field.map(f => f.knowledge).slice(0, 3);
  const playerCreatures = currentPlayer.creatures.slice(0, 3);
  const playerKnowledges = currentPlayer.field.map(f => f.knowledge).slice(0, 3);
  // Hands: up to 4 cards per player
  const oppHand = opponentPlayer.hand.slice(0, 4);
  const playerHand = currentPlayer.hand.slice(0, 4);

  // Helper to render a card or empty slot, with click logic
  const renderCardSlot = (
    card: any,
    key: string,
    location: 'market-deck' | 'market' | 'opp-creature' | 'opp-knowledge' | 'opp-hand' | 'player-creature' | 'player-knowledge' | 'player-hand'
  ) => {
    let props: any = {};
    // Market deck (draw knowledge from deck)
    if (location === 'market-deck' && isMyTurn && state.phase === 'knowledge' && state.knowledgeDeck.length > 0) {
      // Not clickable, do nothing
    }
    // Market cards (draw specific market card)
    if (location === 'market') {
      console.log('Market slot:', { card, isMyTurn, phase: state.phase });
      if (isMyTurn && state.phase === 'action' && card) {
        props.onClick = () => {
          console.log('Attaching onClick for market card', card.id);
          handleDrawKnowledge(card.id);
        };
      }
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
      // Highlight if selecting knowledge
      props.isSelected = selectedKnowledgeId !== null;
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
    // Default: pass rotation for player/opp knowledge if present
    if ((location === 'player-knowledge' || location === 'opp-knowledge') && card) {
      props.rotation = card.rotation ?? 0;
    }
    return (
      <div key={key} className="w-full h-full flex items-center justify-center">
        {card ? <Card card={card} {...props} /> : <div className="w-full h-full border border-dashed border-gray-500/50 rounded-lg bg-gray-800/40" />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gray-100 grid grid-rows-[auto_1fr_auto] gap-6">
      {/* TopBar with clean white background and border for separation */}
      <div>
        <div className="bg-white border-b-4 border-blue-200 shadow-lg">
          <TopBar
            gameId={gameId}
            turn={state.turn}
            phase={state.phase}
            currentPlayerPower={currentPlayer.power}
            opponentPlayerPower={opponentPlayer.power}
            actionsRemaining={actionsRemaining}
            marketCount={state.market.length}
            selectedKnowledgeId={selectedKnowledgeId}
            onCancelSelection={cancelSelection}
          />
        </div>
      </div>

      {/* Display action messages/prompts as an overlay */}
      {actionMessage && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-sm shadow-lg">
          {actionMessage}
        </div>
      )}
      {/* Unified 4x8 grid */}
      <div className="px-4 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-lg mx-4 flex flex-col justify-center items-center">
        <div className="grid grid-cols-8 grid-rows-4 gap-2 w-full h-full max-w-screen-lg mx-auto py-8">
          {/* Row 1: Market deck (not clickable), Opponent creatures, Opponent hand */}
          <div className="col-start-1 row-start-1 row-span-1 aspect-[2/3]">{renderCardSlot(marketDeck, 'marketdeck', 'market-deck')}</div>
          {[0,1,2].map(i => <div key={'oc'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 1}}>{renderCardSlot(oppCreatures[i], 'oc'+i, 'opp-creature')}</div>)}
          {[0,1,2,3].map(i => <div key={'oh'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 1}}>{renderCardSlot(oppHand[i], 'oh'+i, 'opp-hand')}</div>)}
          {/* Row 2: Market card 1 (clickable), Opponent knowledges */}
          {(() => { console.log('Rendering market card slot', 0, marketCards[0]); return null; })()}
          <div className="col-start-1 row-start-2 aspect-[2/3]">{renderCardSlot(marketCards[0], 'market1', 'market')}</div>
          {[0,1,2].map(i => <div key={'ok'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 2}}>{renderCardSlot(oppKnowledges[i], 'ok'+i, 'opp-knowledge')}</div>)}
          {[0,1,2,3].map(i => <div key={'eh2'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 2}}>{renderCardSlot(null, 'eh2'+i, 'player-hand')}</div>)}
          {/* Row 3: Market card 2 (clickable), Player knowledges */}
          {(() => { console.log('Rendering market card slot', 1, marketCards[1]); return null; })()}
          <div className="col-start-1 row-start-3 aspect-[2/3]">{renderCardSlot(marketCards[1], 'market2', 'market')}</div>
          {[0,1,2].map(i => <div key={'pk'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 3}}>{renderCardSlot(playerKnowledges[i], 'pk'+i, 'player-knowledge')}</div>)}
          {[0,1,2,3].map(i => <div key={'eh3'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 3}}>{renderCardSlot(null, 'eh3'+i, 'player-hand')}</div>)}
          {/* Row 4: Market card 3 (clickable), Player creatures, Player hand */}
          {(() => { console.log('Rendering market card slot', 2, marketCards[2]); return null; })()}
          <div className="col-start-1 row-start-4 aspect-[2/3]">{renderCardSlot(marketCards[2], 'market3', 'market')}</div>
          {[0,1,2].map(i => <div key={'pc'+i} className="col-start-" style={{gridColumnStart: 2+i, gridRowStart: 4}}>{renderCardSlot(playerCreatures[i], 'pc'+i, 'player-creature')}</div>)}
          {[0,1,2,3].map(i => <div key={'ph'+i} className="col-start-" style={{gridColumnStart: 5+i, gridRowStart: 4}}>{renderCardSlot(playerHand[i], 'ph'+i, 'player-hand')}</div>)}
        </div>
      </div>

      {/* ActionBar with clean white background and border for separation */}
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
