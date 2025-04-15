import React, { useState } from 'react'; // Import useState
import { PlayerState } from '../game/types'; // Keep necessary types

// Import Hooks
import { usePlayerIdentification } from '../hooks/usePlayerIdentification';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { useGameActions } from '../hooks/useGameActions';

// Import UI Components
import TopBar from '../components/game/TopBar';
import MarketColumn from '../components/game/MarketColumn';
import TableArea from '../components/game/TableArea';
import HandsColumn from '../components/game/HandsColumn';
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


  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex flex-col">
      <TopBar
        // ...props...
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

      {/* Display action messages/prompts as an overlay */}
      {actionMessage && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-sm shadow-lg">
          {actionMessage}
        </div>
      )}

      {/* Grid container takes remaining space */}
      <div className="flex-grow w-full grid grid-cols-[1fr_3fr_1fr] gap-1 overflow-hidden p-1">
        {/* ... MarketColumn, TableArea, HandsColumn ... */}
        <MarketColumn
            marketCards={state.market}
            deckCount={state.knowledgeDeck.length}
            isMyTurn={isMyTurn}
            phase={state.phase}
            onDrawKnowledge={handleDrawKnowledge}
          />
          <TableArea
            currentPlayer={currentPlayer}
            opponentPlayer={opponentPlayer}
            isMyTurn={isMyTurn}
            phase={state.phase}
            selectedKnowledgeId={selectedKnowledgeId}
            onCreatureClickForSummon={handleCreatureClickForSummon}
            onRotateCreature={handleRotateCreature}
          />
          <HandsColumn
            currentPlayerHand={currentPlayer.hand}
            opponentPlayerHand={opponentPlayer.hand}
            isMyTurn={isMyTurn}
            phase={state.phase}
            selectedKnowledgeId={selectedKnowledgeId}
            onHandCardClick={handleHandCardClick}
          />
      </div>

      <ActionBar
        // ...props...
        isMyTurn={isMyTurn}
        phase={state.phase}
        winner={state.winner}
        actionsTaken={state.actionsTakenThisTurn}
        onEndTurn={handleEndTurn}
      />
    </div>
  );
};

export default GameScreen;
