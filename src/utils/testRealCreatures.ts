import { supabase } from './supabase';

export async function updateTestGameWithRealCreatures(gameId: string) {
  console.log('🔧 UPDATING: Test game with real creature IDs...');
  
  try {
    // Use actual creature IDs from the game
    const realPlayer1Creatures = ['adaro', 'pele', 'kappa'];
    const realPlayer2Creatures = ['tulpar', 'kyzy', 'dudugera'];
    
    // Get current state
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('state')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;
    
    const currentState = (gameData?.state as any) || {};
    
    // Update with real creature IDs
    const newState = {
      ...currentState,
      player1SelectedCreatures: realPlayer1Creatures,
      player2SelectedCreatures: realPlayer2Creatures,
      player1SelectionComplete: true,
      player2SelectionComplete: true
    };
    
    // Update both state and columns
    const { error: updateError } = await supabase
      .from('games')
      .update({
        state: newState,
        player1_selected_creatures: realPlayer1Creatures,
        player2_selected_creatures: realPlayer2Creatures
      })
      .eq('id', gameId);

    if (updateError) throw updateError;
    
    console.log('✅ Updated game with real creature IDs:');
    console.log('🎯 Player 1:', realPlayer1Creatures);
    console.log('🎯 Player 2:', realPlayer2Creatures);
    
    return true;
    
  } catch (error) {
    console.error('❌ Update error:', error);
    return false;
  }
}

export async function testNavigationToGame(gameId: string) {
  console.log('🧪 TESTING: Navigation to game screen...');
  
  try {
    // Navigate to the game screen
    const gameUrl = `/game/${gameId}`;
    console.log('🎯 Navigating to:', gameUrl);
    
    // In a real test, this would trigger the navigation
    window.location.href = window.location.origin + gameUrl;
    
    return true;
  } catch (error) {
    console.error('❌ Navigation test error:', error);
    return false;
  }
}

// Add to global window
declare global {
  interface Window {
    updateTestGameWithRealCreatures: typeof updateTestGameWithRealCreatures;
    testNavigationToGame: typeof testNavigationToGame;
  }
}

window.updateTestGameWithRealCreatures = updateTestGameWithRealCreatures;
window.testNavigationToGame = testNavigationToGame;
