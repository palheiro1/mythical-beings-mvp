// Debug utility to test the actual NFT selection confirmation flow
import { supabase } from './supabase.js';

export async function simulatePlayerConfirmSelection(gameId: string, playerId: string, selectedCreatures: string[]) {
  console.log('🧪 SIMULATING PLAYER CONFIRM SELECTION...');
  console.log('Parameters:', { gameId, playerId, selectedCreatures });
  
  try {
    // Step 1: Get current game data (same as NFTSelection.tsx does)
    console.log('📋 Step 1: Fetching current game data...');
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('player1_id, player2_id, state')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;
    if (!gameData) throw new Error("Game not found during confirmation.");

    console.log('Current game data:', gameData);

    // Step 2: Determine if player is player1 or player2
    const isPlayer1 = gameData.player1_id === playerId;
    console.log('📋 Step 2: Player role determination...');
    console.log('Is Player 1:', isPlayer1);
    console.log('Player ID:', playerId);
    console.log('Game Player 1 ID:', gameData.player1_id);
    console.log('Game Player 2 ID:', gameData.player2_id);

    // Step 3: Get current state and merge in new values
    console.log('📋 Step 3: Building new state...');
    const currentState = gameData.state || {};
    console.log('Current state:', currentState);

    const newState = {
      ...currentState,
      ...(isPlayer1 
        ? {
            player1SelectedCreatures: selectedCreatures,
            player1SelectionComplete: true
          }
        : {
            player2SelectedCreatures: selectedCreatures,
            player2SelectionComplete: true
          }
      )
    };

    console.log('New state:', newState);

    // Step 4: Create update payload (same as NFTSelection.tsx)
    console.log('📋 Step 4: Creating update payload...');
    const updatePayload: any = { 
      state: newState 
    };
    
    // Also update the dedicated columns for creature selections
    if (isPlayer1) {
      updatePayload.player1_selected_creatures = selectedCreatures;
    } else {
      updatePayload.player2_selected_creatures = selectedCreatures;
    }

    console.log('Update payload:', updatePayload);

    // Step 5: Execute the database update
    console.log('📋 Step 5: Executing database update...');
    const { error: updateError } = await supabase
      .from('games')
      .update(updatePayload)
      .eq('id', gameId);

    if (updateError) throw updateError;

    console.log('✅ Database update successful!');

    // Step 6: Check completion status
    console.log('📋 Step 6: Checking completion status...');
    const player1Complete = newState.player1SelectionComplete || false;
    const player2Complete = newState.player2SelectionComplete || false;
    
    console.log('Completion status:', {
      player1Complete,
      player2Complete,
      bothComplete: player1Complete && player2Complete
    });

    if (player1Complete && player2Complete) {
      console.log('🎯 BOTH PLAYERS COMPLETED! Navigation should trigger.');
      console.log('This is when the UI should navigate to /game/' + gameId);
    } else {
      console.log('⏳ Current player completed, should enter waiting state');
      console.log('Waiting for other player to complete...');
    }

    // Step 7: Final verification
    console.log('📋 Step 7: Final verification - re-fetching game data...');
    const { data: finalGameData, error: finalError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!finalError && finalGameData) {
      console.log('Final game state:', finalGameData.state);
      console.log('Final database columns:', {
        player1_selected_creatures: finalGameData.player1_selected_creatures,
        player2_selected_creatures: finalGameData.player2_selected_creatures
      });
    }

    return {
      success: true,
      bothComplete: player1Complete && player2Complete,
      newState,
      updatePayload
    };

  } catch (error) {
    console.error('❌ Error in simulation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function diagnoseNFTSelectionBug(gameId: string) {
  console.log('🔍 DIAGNOSING NFT SELECTION BUG...');
  console.log('Game ID:', gameId);
  
  try {
    // Get current game state
    const { data: gameData, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) throw error;

    console.log('Current game data:', gameData);
    
    const state = gameData.state as any;
    console.log('Current state object:', state);
    
    console.log('🔍 DIAGNOSIS RESULTS:');
    console.log('=====================================');
    
    // Check state completion flags
    const p1StateComplete = state?.player1SelectionComplete || false;
    const p2StateComplete = state?.player2SelectionComplete || false;
    console.log('State completion flags:');
    console.log('  Player 1 complete:', p1StateComplete);
    console.log('  Player 2 complete:', p2StateComplete);
    console.log('  Both complete:', p1StateComplete && p2StateComplete);
    
    // Check database columns
    const p1DbCreatures = gameData.player1_selected_creatures;
    const p2DbCreatures = gameData.player2_selected_creatures;
    console.log('Database creature columns:');
    console.log('  Player 1 creatures:', p1DbCreatures);
    console.log('  Player 2 creatures:', p2DbCreatures);
    
    // Check state creature arrays
    const p1StateCreatures = state?.player1SelectedCreatures;
    const p2StateCreatures = state?.player2SelectedCreatures;
    console.log('State creature arrays:');
    console.log('  Player 1 creatures:', p1StateCreatures);
    console.log('  Player 2 creatures:', p2StateCreatures);

    // Analysis
    const hasValidDbColumns = p1DbCreatures && p1DbCreatures.length > 0 && p2DbCreatures && p2DbCreatures.length > 0;
    const hasValidStateFlags = p1StateComplete && p2StateComplete;
    const hasValidStateCreatures = p1StateCreatures && p1StateCreatures.length > 0 && p2StateCreatures && p2StateCreatures.length > 0;
    
    console.log('🎯 ANALYSIS:');
    console.log('  Valid DB columns:', hasValidDbColumns ? '✅' : '❌');
    console.log('  Valid state flags:', hasValidStateFlags ? '✅' : '❌');
    console.log('  Valid state creatures:', hasValidStateCreatures ? '✅' : '❌');

    if (hasValidDbColumns && hasValidStateFlags && hasValidStateCreatures) {
      console.log('✅ ALL DATA VALID - Navigation should work!');
    } else {
      console.log('❌ MISSING DATA - This explains why navigation might not work');
    }

    return {
      gameData,
      hasValidDbColumns,
      hasValidStateFlags,
      hasValidStateCreatures
    };

  } catch (error) {
    console.error('❌ Error in diagnosis:', error);
    return { error: error.message };
  }
}
