import React, { useEffect, useRef, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { GameState } from '../game/types.js';
import { initializeGame } from '../game/state.js';
import TopBar from '../components/game/TopBar.js';
import ActionBar from '../components/game/ActionBar.js';
import TableArea from '../components/game/TableArea.js';
import HandsColumn from '../components/game/HandsColumn.js';
import MarketColumn from '../components/game/MarketColumn.js';
import Logs from '../components/game/Logs.js';
import GameAnnouncer from '../components/game/GameAnnouncer.js';
import { useTurnTimer } from '../hooks/useTurnTimer.js';
import { useLocalGameActions } from '../hooks/useLocalGameActions.js';
import { useCardRegistry } from '../context/CardRegistry.js';

const BOT_ID = 'bot';
const BOT_NAME = 'Bot';

// Minimal default 3 creatures per player for quick start: first three from selection flow
const DEFAULT_CREATURES = ['adaro', 'lisovik', 'kappa'];

const BotGame: React.FC = () => {
  // const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentPlayerId = user?.id || 'local-user';
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const registry = useCardRegistry();

  // Local actions via reducer with functional setState to avoid stale updates
  const { handleRotateCreature, handleDrawKnowledge, handleCreatureClickForSummon, handleEndTurn, handleAction } = useLocalGameActions(
    gameState,
    setGameState,
    gameState ? gameState.players[gameState.currentPlayerIndex].id : currentPlayerId,
    selectedKnowledgeId
  );

  // Keep a ref of the latest state for the bot to read fresh data between actions
  const latestStateRef = useRef<GameState | null>(null);
  useEffect(() => { latestStateRef.current = gameState; }, [gameState]);

  // Initialize a local game on mount
  useEffect(() => {
    const id = `bot-${Date.now()}`;
    const state = initializeGame({
      gameId: id,
      player1Id: currentPlayerId,
      player2Id: BOT_ID,
      player1SelectedIds: DEFAULT_CREATURES,
      player2SelectedIds: DEFAULT_CREATURES,
    });
    setGameState(state);
  }, [currentPlayerId]);

  // Simple Bot AI loop: on bot's action phase, try rotate → play → draw, with small delays
  const botThinking = useRef(false);
  useEffect(() => {
    if (!gameState || gameState.phase !== 'action') return;
    const isBotTurn = gameState.players[gameState.currentPlayerIndex]?.id === BOT_ID;
    if (!isBotTurn || botThinking.current || gameState.winner) return;
    botThinking.current = true;

    const runBot = async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      // Use fresh snapshot each step
      let snap = latestStateRef.current!;
      const bot = snap.players[snap.currentPlayerIndex];

      // 1) Rotate first creature that is not fully rotated (assume up to 270)
      const rotatable = bot.creatures.find(c => (c.rotation ?? 0) < 270);
      if (rotatable) {
        await sleep(350);
        handleAction({ type: 'ROTATE_CREATURE', payload: { playerId: BOT_ID, creatureId: rotatable.id } });
        await sleep(100); // allow reducer to commit
        snap = latestStateRef.current!;
      }

      // 2) Try to play first playable knowledge in hand onto first empty slot creature
      snap = latestStateRef.current!;
      const botNow = snap.players[snap.currentPlayerIndex];
      const emptySlot = botNow.field.find(s => !s.knowledge)?.creatureId;
      const playable = botNow.hand.find(k => {
        const creature = botNow.creatures.find(c => c.id === emptySlot);
        return creature && (creature.currentWisdom ?? creature.baseWisdom) >= k.cost;
      });
      if (emptySlot && playable) {
        await sleep(350);
        handleAction({ type: 'SUMMON_KNOWLEDGE', payload: { playerId: BOT_ID, knowledgeId: playable.id, creatureId: emptySlot, instanceId: playable.instanceId! } });
        await sleep(100);
        snap = latestStateRef.current!;
      } else {
        // 3) Otherwise draw first market card
        const marketTop = snap.market[0];
        if (marketTop) {
          await sleep(350);
          handleAction({ type: 'DRAW_KNOWLEDGE', payload: { playerId: BOT_ID, knowledgeId: marketTop.id, instanceId: marketTop.instanceId! } });
          await sleep(100);
          snap = latestStateRef.current!;
        }
      }

      // End bot turn
      await sleep(300);
      handleAction({ type: 'END_TURN', payload: { playerId: BOT_ID } });
      botThinking.current = false;
    };

    runBot();
  }, [gameState]);

  // Timer
  const TURN_DURATION_SECONDS = 30;
  const isMyTurn = !!gameState && gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId;
  const remainingTime = useTurnTimer({
    isMyTurn,
    phase: gameState?.phase === 'action' || gameState?.phase === 'knowledge' || gameState?.phase === 'end' ? gameState.phase : null,
    turnDurationSeconds: TURN_DURATION_SECONDS,
    onTimerEnd: handleEndTurn,
    gameTurn: gameState?.turn ?? 0,
    currentPlayerIndex: gameState?.currentPlayerIndex ?? null,
  });

  if (authLoading || !gameState) {
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading Bot Game...</div>;
  }

  const player = gameState.players[0];
  const opponent = gameState.players[1];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white overflow-hidden">
      <GameAnnouncer
        turn={gameState.turn}
        phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase : 'end'}
        isMyTurn={isMyTurn}
        playerName={'You'}
        opponentName={BOT_NAME}
      />
      <TopBar
        player1Profile={{ username: 'You', avatar_url: null }}
        player2Profile={{ username: BOT_NAME, avatar_url: null }}
        player1Mana={player.power}
        player2Mana={opponent.power}
        turn={gameState.turn}
        phase={gameState.phase}
        currentPlayerId={player.id}
        gameState={gameState}
      />
  <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-2 p-2 min-h-0">
        <div className="md:col-span-3 min-h-0" ref={(el) => { if (el) registry.register('table:anchor', el); }}>
          <TableArea
            currentPlayer={player}
            opponentPlayer={opponent}
            isMyTurn={isMyTurn}
            phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase : 'end'}
            selectedKnowledgeId={selectedKnowledgeId}
            onCreatureClickForSummon={handleCreatureClickForSummon}
            onRotateCreature={handleRotateCreature}
          />
  </div>
  <div className="md:col-span-1 min-h-0">
          <HandsColumn
            currentPlayerHand={player.hand}
            opponentPlayerHand={opponent.hand}
            isMyTurn={isMyTurn}
            phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase as any : 'end'}
            selectedKnowledgeId={selectedKnowledgeId}
            onHandCardClick={setSelectedKnowledgeId}
          />
        </div>
  <div className="md:col-span-1 min-h-0" ref={(el) => { if (el) registry.register('market:anchor', el); }}>
          <MarketColumn
            marketCards={gameState.market}
            deckCount={gameState.knowledgeDeck.length}
            isMyTurn={isMyTurn}
            phase={(gameState.phase === 'action' || gameState.phase === 'knowledge' || gameState.phase === 'end') ? gameState.phase : 'end'}
            onDrawKnowledge={handleDrawKnowledge}
          />
        </div>
  <div className="md:col-span-1 min-h-0" ref={(el) => { if (el) registry.register('discard:anchor', el); }}>
          <Logs logs={gameState.log} />
        </div>
      </div>
      <ActionBar
        isMyTurn={isMyTurn}
        phase={gameState.phase}
        winner={gameState.winner}
        actionsTaken={gameState.actionsTakenThisTurn}
        actionsPerTurn={gameState.actionsPerTurn}
        turnTimer={remainingTime}
        isSpectator={false}
        playerUsername={'You'}
        opponentUsername={BOT_NAME}
        onEndTurnClick={handleEndTurn}
      />
    </div>
  );
};

export default BotGame;
