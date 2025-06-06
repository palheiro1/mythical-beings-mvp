// Test utility to debug navigation issue
import { supabase } from './supabase.js';

export async function testNavigationFix() {
  console.log('🔍 Testing navigation fix...');
  
  try {
    // Get the most recent game
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (gamesError) throw gamesError;
    if (!games || games.length === 0) {
      console.log('❌ No games found');
      return;
    }
    
    const game = games[0];
    console.log('🎮 Latest game:', {
      id: game.id,
      status: game.status,
      state: game.state,
      player1_id: game.player1_id,
      player2_id: game.player2_id,
      created_at: game.created_at
    });
    
    // Check if both players have completed selection
    const state = game.state as any;
    if (state) {
      console.log('📊 Game state analysis:', {
        player1SelectionComplete: state.player1SelectionComplete,
        player2SelectionComplete: state.player2SelectionComplete,
        player1SelectedCreatures: state.player1SelectedCreatures?.length || 0,
        player2SelectedCreatures: state.player2SelectedCreatures?.length || 0,
        bothComplete: state.player1SelectionComplete && state.player2SelectionComplete
      });
      
      if (state.player1SelectionComplete && state.player2SelectionComplete) {
        console.log('✅ Both players completed - navigation should have triggered!');
        
        // Check if game status needs to be updated
        if (game.status !== 'playing') {
          console.log('⚠️ Game status is not "playing", updating...');
          const { error: updateError } = await supabase
            .from('games')
            .update({ status: 'playing' })
            .eq('id', game.id);
          
          if (updateError) {
            console.error('❌ Error updating game status:', updateError);
          } else {
            console.log('✅ Game status updated to "playing"');
          }
        }
      }
    }
    
    return game;
    
  } catch (error) {
    console.error('❌ Error testing navigation fix:', error);
    throw error;
  }
}

// Test function to simulate navigation trigger
export async function triggerNavigationTest(gameId: string) {
  console.log('🚀 Testing navigation trigger for game:', gameId);
  
  try {
    const { data: gameData, error } = await supabase
      .from('games')
      .select('state, player1_id, player2_id')
      .eq('id', gameId)
      .single();
    
    if (error) throw error;
    if (!gameData) throw new Error('Game not found');
    
    const state = gameData.state as any;
    console.log('Current state:', state);
    
    if (state?.player1SelectionComplete && state?.player2SelectionComplete) {
      console.log('✅ Both players completed - should navigate!');
      return true;
    } else {
      console.log('⏳ Not all players completed yet');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error in navigation test:', error);
    return false;
  }
}
