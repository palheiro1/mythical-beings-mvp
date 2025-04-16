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

      {/* Main game area with gradient background */}
      <div className="px-4 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-lg mx-4">
        <div className="grid grid-cols-[1fr_2fr_3fr] gap-4 h-full py-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md overflow-hidden border border-white/20">
            <MarketColumn
              marketCards={state.market}
              deckCount={state.knowledgeDeck.length}
              isMyTurn={isMyTurn}
              phase={state.phase}
              onDrawKnowledge={handleDrawKnowledge}
            />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md overflow-hidden border border-white/20">
            <TableArea
              currentPlayer={currentPlayer}
              opponentPlayer={opponentPlayer}
              isMyTurn={isMyTurn}
              phase={state.phase}
              selectedKnowledgeId={selectedKnowledgeId}
              onCreatureClickForSummon={handleCreatureClickForSummon}
              onRotateCreature={handleRotateCreature}
            />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md overflow-hidden border border-white/20">
            <HandsColumn
              currentPlayerHand={currentPlayer.hand}
              opponentPlayerHand={opponentPlayer.hand}
              isMyTurn={isMyTurn}
              phase={state.phase}
              selectedKnowledgeId={selectedKnowledgeId}
              onHandCardClick={handleHandCardClick}
            />
          </div>
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
