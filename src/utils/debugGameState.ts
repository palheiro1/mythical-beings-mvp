import { supabase } from './supabase';

export async function debugGameStateAfterNavigation(gameId: string) {
  console.log('🔍 DEBUG: Investigating game state after navigation...');
  
  try {
    // Check the full game record
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError) {
      console.error('❌ Error fetching game data:', gameError);
      return;
    }

    console.log('📋 Full game record:', gameData);
    console.log('📋 Game state object:', gameData.state);
    
    if (gameData.state) {
      const state = gameData.state as any;
      console.log('🎯 Player 1 selected creatures:', state.player1SelectedCreatures);
      console.log('🎯 Player 2 selected creatures:', state.player2SelectedCreatures);
      console.log('✅ Player 1 complete:', state.player1SelectionComplete);
      console.log('✅ Player 2 complete:', state.player2SelectionComplete);
    }

    console.log('📋 Database columns:');
    console.log('🎯 player1_selected_creatures:', gameData.player1_selected_creatures);
    console.log('🎯 player2_selected_creatures:', gameData.player2_selected_creatures);
    console.log('📊 Status:', gameData.status);

    // Check game_states table
    const { data: gameStateData, error: gameStateError } = await supabase
      .from('game_states')
      .select('*')
      .eq('game_id', gameId)
      .single();

    if (gameStateError) {
      console.log('📝 No game_states record found (this is expected before initialization):', gameStateError.message);
    } else {
      console.log('🎮 Game state from game_states table:', gameStateData);
    }

    return {
      gameData,
      gameStateData: gameStateData || null
    };

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

export async function fixCreatureSelectionData(gameId: string) {
  console.log('🔧 FIXING: Moving creature selections from state to database columns...');
  
  try {
    // Get current game data
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('state')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;
    if (!gameData?.state) {
      console.log('❌ No state data found');
      return false;
    }

    const state = gameData.state as any;
    const player1Creatures = state.player1SelectedCreatures;
    const player2Creatures = state.player2SelectedCreatures;

    if (!player1Creatures || !player2Creatures) {
      console.log('❌ Creature selection data not found in state');
      return false;
    }

    console.log('📋 Found creatures in state:');
    console.log('🎯 Player 1:', player1Creatures);
    console.log('🎯 Player 2:', player2Creatures);

    // Update the database columns
    const { error: updateError } = await supabase
      .from('games')
      .update({
        player1_selected_creatures: player1Creatures,
        player2_selected_creatures: player2Creatures
      })
      .eq('id', gameId);

    if (updateError) {
      console.error('❌ Error updating database columns:', updateError);
      return false;
    }

    console.log('✅ Successfully updated database columns with creature selections');
    return true;

  } catch (error) {
    console.error('❌ Fix error:', error);
    return false;
  }
}

// Add to global window for browser console access
declare global {
  interface Window {
    debugGameStateAfterNavigation: typeof debugGameStateAfterNavigation;
    fixCreatureSelectionData: typeof fixCreatureSelectionData;
  }
}

window.debugGameStateAfterNavigation = debugGameStateAfterNavigation;
window.fixCreatureSelectionData = fixCreatureSelectionData;
