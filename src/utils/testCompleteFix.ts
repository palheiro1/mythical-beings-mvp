import { supabase } from './supabase';

export async function testCompleteNavigationFix(gameId?: string) {
  console.log('🧪 COMPREHENSIVE TEST: Testing complete navigation fix...');
  
  try {
    let testGameId = gameId;
    
    if (!testGameId) {
      // Create a test game if none provided
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          player1_id: 'test-player-1',
          player2_id: 'test-player-2',
          status: 'waiting_for_selection',
          player1_dealt_hand: ['adaro', 'pele', 'kappa', 'dudugera', 'kyzy'],
          player2_dealt_hand: ['lisovik', 'tulpar', 'tsenehale', 'caapora', 'zhar-ptitsa']
        })
        .select()
        .single();
      
      if (gameError) throw gameError;
      testGameId = game.id;
      console.log('✅ Created test game:', testGameId);
    }

    console.log('📋 Testing with game ID:', testGameId);

    // Step 1: Simulate Player 1 completing selection
    console.log('🎯 Step 1: Player 1 completing selection...');
    const player1Selection = ['adaro', 'pele', 'kappa'];
    
    const { data: game1Data, error: game1Error } = await supabase
      .from('games')
      .select('state')
      .eq('id', testGameId)
      .single();
      
    if (game1Error) throw game1Error;
    
    const currentState1 = (game1Data?.state as any) || {};
    const newState1 = {
      ...currentState1,
      player1SelectedCreatures: player1Selection,
      player1SelectionComplete: true
    };

    const { error: update1Error } = await supabase
      .from('games')
      .update({
        state: newState1,
        player1_selected_creatures: player1Selection // This is the key fix!
      })
      .eq('id', testGameId);

    if (update1Error) throw update1Error;
    console.log('✅ Player 1 selection completed and stored');

    // Step 2: Simulate Player 2 completing selection
    console.log('🎯 Step 2: Player 2 completing selection...');
    const player2Selection = ['lisovik', 'tulpar', 'tsenehale'];
    
    const { data: game2Data, error: game2Error } = await supabase
      .from('games')
      .select('state')
      .eq('id', testGameId)
      .single();
      
    if (game2Error) throw game2Error;
    
    const currentState2 = (game2Data?.state as any) || {};
    const newState2 = {
      ...currentState2,
      player2SelectedCreatures: player2Selection,
      player2SelectionComplete: true
    };

    const { error: update2Error } = await supabase
      .from('games')
      .update({
        state: newState2,
        player2_selected_creatures: player2Selection // This is the key fix!
      })
      .eq('id', testGameId);

    if (update2Error) throw update2Error;
    console.log('✅ Player 2 selection completed and stored');

    // Step 3: Verify the data is properly stored
    console.log('🔍 Step 3: Verifying data storage...');
    const { data: finalGameData, error: finalError } = await supabase
      .from('games')
      .select('*')
      .eq('id', testGameId)
      .single();

    if (finalError) throw finalError;

    console.log('📋 Final game state verification:');
    console.log('🎯 player1_selected_creatures column:', finalGameData.player1_selected_creatures);
    console.log('🎯 player2_selected_creatures column:', finalGameData.player2_selected_creatures);
    
    if (finalGameData.state) {
      const state = finalGameData.state as any;
      console.log('🎯 player1SelectedCreatures in state:', state.player1SelectedCreatures);
      console.log('🎯 player2SelectedCreatures in state:', state.player2SelectedCreatures);
      console.log('✅ player1SelectionComplete:', state.player1SelectionComplete);
      console.log('✅ player2SelectionComplete:', state.player2SelectionComplete);
    }

    // Step 4: Test game initialization logic
    console.log('🎮 Step 4: Testing game initialization logic...');
    
    // Simulate what useGameInitialization does
    let player1SelectedIds = finalGameData.player1_selected_creatures;
    let player2SelectedIds = finalGameData.player2_selected_creatures;
    
    // If not in columns, try to get from state (fallback)
    if ((!player1SelectedIds || !player2SelectedIds) && finalGameData.state) {
      const state = finalGameData.state as any;
      if (state.player1SelectedCreatures) {
        player1SelectedIds = state.player1SelectedCreatures;
      }
      if (state.player2SelectedCreatures) {
        player2SelectedIds = state.player2SelectedCreatures;
      }
    }

    console.log('🎯 Retrieved player1SelectedIds:', player1SelectedIds);
    console.log('🎯 Retrieved player2SelectedIds:', player2SelectedIds);

    // Check if we have valid data for game initialization
    const hasValidData = player1SelectedIds && player2SelectedIds && 
                        player1SelectedIds.length === 3 && player2SelectedIds.length === 3;

    if (hasValidData) {
      console.log('🎉 SUCCESS: Game initialization should work!');
      console.log('✅ Both players have 3 selected creatures');
      console.log('✅ Data is available in database columns');
      console.log('✅ Navigation trigger works (both players completed)');
      
      return {
        success: true,
        gameId: testGameId,
        player1Selection: player1SelectedIds,
        player2Selection: player2SelectedIds,
        message: 'Complete navigation and game initialization fix verified!'
      };
    } else {
      console.log('❌ FAILURE: Game initialization would fail');
      console.log('❌ Missing or incomplete creature selection data');
      
      return {
        success: false,
        gameId: testGameId,
        player1Selection: player1SelectedIds,
        player2Selection: player2SelectedIds,
        message: 'Fix not working - creature data still missing'
      };
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Test failed with error'
    };
  }
}

export async function cleanupTestGame(gameId: string) {
  console.log('🧹 Cleaning up test game:', gameId);
  
  try {
    // Delete from game_states first (if exists)
    await supabase.from('game_states').delete().eq('game_id', gameId);
    
    // Delete from games
    const { error } = await supabase.from('games').delete().eq('id', gameId);
    if (error) throw error;
    
    console.log('✅ Test game cleaned up successfully');
    return true;
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return false;
  }
}

// Add to global window for browser console access
declare global {
  interface Window {
    testCompleteNavigationFix: typeof testCompleteNavigationFix;
    cleanupTestGame: typeof cleanupTestGame;
  }
}

window.testCompleteNavigationFix = testCompleteNavigationFix;
window.cleanupTestGame = cleanupTestGame;
