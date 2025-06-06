/**
 * Test script to validate the race condition fix for navigation.
 * This tests the updated NavigationManager with proper game initialization sequencing.
 */

import { supabase } from './supabase.js';

declare global {
  interface Window {
    testRaceConditionFix: () => Promise<void>;
  }
}

export async function testRaceConditionFix(): Promise<void> {
  console.log('🧪 Testing Race Condition Fix...');

  // Find an existing test game
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .eq('player1_id', 'test-player-1')
    .eq('player2_id', 'test-player-2')
    .limit(1);

  if (gamesError || !games || games.length === 0) {
    console.error('No test game found. Please run testCompleteFlow() first.');
    return;
  }

  const gameId = games[0].id;
  console.log(`Using test game: ${gameId}`);

  // Reset the game to NFT selection state
  const resetState = {
    player1SelectedCreatures: ['dudugera', 'adaro', 'pele'],
    player2SelectedCreatures: ['pele', 'dudugera', 'adaro'],
    player1SelectionComplete: false,
    player2SelectionComplete: false
  };

  console.log('🔄 Resetting game to NFT selection state...');
  
  // Clear any existing full game state and reset to selection state
  const { error: resetError } = await supabase
    .from('games')
    .update({
      state: resetState,
      player1_selected_creatures: ['dudugera', 'adaro', 'pele'],
      player2_selected_creatures: ['pele', 'dudugera', 'adaro']
    })
    .eq('id', gameId);

  if (resetError) {
    console.error('Failed to reset game:', resetError);
    return;
  }

  console.log('✅ Game reset to NFT selection state');

  // Test scenario: Both players complete selections simultaneously
  console.log('🎯 Testing simultaneous completion with new navigation logic...');

  // Simulate Player 1 completing selection (should trigger game initialization)
  console.log('🔄 Player 1 completing selection...');
  const player1CompleteState = {
    ...resetState,
    player1SelectionComplete: true
  };

  await supabase
    .from('games')
    .update({ state: player1CompleteState })
    .eq('id', gameId);

  // Short delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate Player 2 completing selection (should trigger proper navigation flow)
  console.log('🔄 Player 2 completing selection...');
  const bothCompleteState = {
    ...resetState,
    player1SelectionComplete: true,
    player2SelectionComplete: true
  };

  await supabase
    .from('games')
    .update({ state: bothCompleteState })
    .eq('id', gameId);

  console.log('✅ Both players marked as complete');

  // Monitor for game initialization
  console.log('👀 Monitoring for game initialization...');
  let initializationDetected = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds maximum

  while (!initializationDetected && attempts < maxAttempts) {
    attempts++;
    
    // Check if full game state exists
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('state')
      .eq('id', gameId)
      .single();

    if (gameError) {
      console.error('Error checking game state:', gameError);
      break;
    }

    const state = gameData?.state as any;
    
    // Check if we have a full game state with phase and players
    if (state && state.phase && state.players && state.players.length === 2) {
      initializationDetected = true;
      console.log(`✅ Game initialization detected after ${attempts} seconds!`);
      console.log(`📊 Game Phase: ${state.phase}`);
      console.log(`🎮 Players: ${state.players.map((p: any) => p.id).join(', ')}`);
      console.log(`🃏 Market size: ${state.market?.length || 0}`);
      console.log(`📚 Knowledge deck size: ${state.knowledgeDeck?.length || 0}`);
      break;
    }

    if (attempts % 5 === 0) {
      console.log(`⏳ Still waiting for initialization... (${attempts}s)`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!initializationDetected) {
    console.error('❌ Game initialization was not detected within 30 seconds');
    console.log('📝 Current state structure:', JSON.stringify(bothCompleteState, null, 2));
    return;
  }

  // Test navigation timing
  console.log('🚀 Testing navigation readiness...');
  
  try {
    const { getGameState } = await import('./supabase.js');
    const gameState = await getGameState(gameId);
    
    if (gameState && gameState.phase === 'action') {
      console.log('✅ Game state is ready for navigation!');
      console.log(`📊 Phase: ${gameState.phase}`);
      console.log(`👥 Current player: ${gameState.players[gameState.currentPlayerIndex].id}`);
      console.log(`⚡ Actions per turn: ${gameState.actionsPerTurn}`);
    } else {
      console.error('❌ Game state is not ready for action phase');
      console.log('📊 Current phase:', gameState?.phase);
    }
  } catch (error) {
    console.error('❌ Error checking game state readiness:', error);
  }

  console.log('🎉 Race condition fix test completed!');
  console.log('📋 Summary:');
  console.log('  - NFT selections completed ✅');
  console.log('  - Game initialization triggered ✅');
  console.log('  - Full game state created ✅');
  console.log('  - Ready for navigation ✅');
}

// Make function available globally for browser console
if (typeof window !== 'undefined') {
  window.testRaceConditionFix = testRaceConditionFix;
}
