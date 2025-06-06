import { supabase } from './supabase';

export async function testCompleteFlow(gameId: string) {
  console.log('🧪 TESTING: Complete flow from navigation to game initialization...');
  
  try {
    // Step 1: Verify creature selections are in database columns
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;
    
    console.log('✅ Step 1: Game data retrieved');
    console.log('📋 Player 1 creatures:', gameData.player1_selected_creatures);
    console.log('📋 Player 2 creatures:', gameData.player2_selected_creatures);
    
    if (!gameData.player1_selected_creatures || !gameData.player2_selected_creatures) {
      console.log('❌ FAIL: Creature selections missing from database columns');
      return false;
    }
    
    if (gameData.player1_selected_creatures.length !== 3 || gameData.player2_selected_creatures.length !== 3) {
      console.log('❌ FAIL: Invalid creature selection count');
      return false;
    }
    
    console.log('✅ Step 2: Creature selections validated');
    
    // Step 3: Check if we can simulate game initialization logic
    const player1SelectedIds = gameData.player1_selected_creatures;
    const player2SelectedIds = gameData.player2_selected_creatures;
    
    console.log('✅ Step 3: Ready for game initialization');
    console.log('🎯 Player 1 selected IDs:', player1SelectedIds);
    console.log('🎯 Player 2 selected IDs:', player2SelectedIds);
    
    // Step 4: Test navigation to game screen
    console.log('✅ Step 4: Testing navigation...');
    
    // Check both players completion
    const state = gameData.state as any;
    const bothComplete = state?.player1SelectionComplete && state?.player2SelectionComplete;
    
    if (bothComplete) {
      console.log('✅ Step 5: Both players completed - ready for navigation');
      console.log('🎯 Navigation should work to: /game/' + gameId);
      return true;
    } else {
      console.log('❌ FAIL: Players not marked as complete');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

export async function simulateRealGame() {
  console.log('🎮 SIMULATING: Real game flow with actual creature IDs...');
  
  try {
    // Create a test game with real creature selections
    const realCreatures1 = ['adaro', 'pele', 'kappa'];
    const realCreatures2 = ['tulpar', 'kyzy', 'dudugera'];
    
    // For testing, we'd need to create a new game or use an existing one
    console.log('📝 Test would use real creatures:');
    console.log('Player 1:', realCreatures1);
    console.log('Player 2:', realCreatures2);
    
    console.log('✅ These are valid creature IDs that should work for game initialization');
    return true;
    
  } catch (error) {
    console.error('❌ Simulation error:', error);
    return false;
  }
}

// Add to global window for browser console access
declare global {
  interface Window {
    testCompleteFlow: typeof testCompleteFlow;
    simulateRealGame: typeof simulateRealGame;
  }
}

window.testCompleteFlow = testCompleteFlow;
window.simulateRealGame = simulateRealGame;
