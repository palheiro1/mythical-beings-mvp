// Add navigation debug tools to the window object
import { supabase } from '../utils/supabase.js';

export async function checkNavigationState() {
  console.log('🔍 Checking navigation state...');
  
  try {
    // Get the most recent game
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    if (!games || games.length === 0) {
      console.log('❌ No games found');
      return null;
    }
    
    const game = games[0];
    const state = game.state as any;
    
    console.log('📊 Current game state:', {
      id: game.id,
      status: game.status,
      player1Complete: state?.player1SelectionComplete || false,
      player2Complete: state?.player2SelectionComplete || false,
      shouldNavigate: state?.player1SelectionComplete && state?.player2SelectionComplete,
      state: state
    });
    
    return game;
  } catch (error) {
    console.error('❌ Error checking navigation state:', error);
    return null;
  }
}

export async function forceNavigationTest(gameId: string) {
  console.log('🚀 Force testing navigation for game:', gameId);
  
  try {
    // Use real creature IDs that exist in the game
    const realCreatureIds = ['adaro', 'caapora', 'dudugera', 'inkanyamba', 'japinunus', 'kappa'];
    
    const bothCompleteState = {
      player1SelectionComplete: true,
      player2SelectionComplete: true,
      player1SelectedCreatures: realCreatureIds.slice(0, 3), // ['adaro', 'caapora', 'dudugera']
      player2SelectedCreatures: realCreatureIds.slice(3, 6)  // ['inkanyamba', 'japinunus', 'kappa']
    };
    
    console.log('🎮 Setting realistic creature selections:', {
      player1: bothCompleteState.player1SelectedCreatures,
      player2: bothCompleteState.player2SelectedCreatures
    });
    
    const { error } = await supabase
      .from('games')
      .update({ 
        state: bothCompleteState,
        status: 'selecting'
      })
      .eq('id', gameId);
    
    if (error) throw error;
    
    console.log('✅ Both players set to complete with real creatures - navigation should trigger!');
    console.log('🎯 Navigation should happen automatically within a few seconds...');
    return true;
  } catch (error) {
    console.error('❌ Error forcing navigation test:', error);
    return false;
  }
}

export async function testCompleteGameFlow(gameId: string) {
  console.log('🎮 Testing complete game flow for:', gameId);
  
  try {
    // Step 1: Set up proper creature selections
    const realCreatureIds = ['adaro', 'caapora', 'dudugera', 'inkanyamba', 'japinunus', 'kappa'];
    
    console.log('📋 Step 1: Setting up creature selections...');
    const selectionState = {
      player1SelectionComplete: true,
      player2SelectionComplete: true,
      player1SelectedCreatures: realCreatureIds.slice(0, 3),
      player2SelectedCreatures: realCreatureIds.slice(3, 6)
    };
    
    await supabase
      .from('games')
      .update({ 
        state: selectionState,
        status: 'selecting'
      })
      .eq('id', gameId);
    
    console.log('✅ Step 1 complete: Both players have selected creatures');
    console.log('🎯 Navigation should trigger automatically...');
    
    // Step 2: Wait a moment and check if navigation happened
    setTimeout(async () => {
      console.log('📋 Step 2: Checking if navigation occurred...');
      
      // Check current URL
      const currentPath = window.location.pathname;
      if (currentPath.includes('/game/')) {
        console.log('✅ SUCCESS: Navigation to game screen completed!');
        console.log('🎮 Current URL:', window.location.href);
      } else {
        console.log('⚠️ WARNING: Still on NFT selection screen');
        console.log('🔧 This might indicate the navigation fix needs adjustment');
      }
    }, 3000);
    
    return true;
  } catch (error) {
    console.error('❌ Error in complete game flow test:', error);
    return false;
  }
}

export async function resetGameToSelectionPhase(gameId: string) {
  console.log('🔄 Resetting game to selection phase for testing...');
  
  try {
    const resetState = {
      player1SelectionComplete: false,
      player2SelectionComplete: false,
      player1SelectedCreatures: [],
      player2SelectedCreatures: []
    };
    
    await supabase
      .from('games')
      .update({ 
        state: resetState,
        status: 'selecting'
      })
      .eq('id', gameId);
    
    console.log('✅ Game reset to selection phase');
    console.log('🔄 You can now test the selection flow again');
    return true;
  } catch (error) {
    console.error('❌ Error resetting game:', error);
    return false;
  }
}

// Expose to window for easy testing
(window as any).checkNavigationState = checkNavigationState;
(window as any).forceNavigationTest = forceNavigationTest;
(window as any).testCompleteGameFlow = testCompleteGameFlow;
(window as any).resetGameToSelectionPhase = resetGameToSelectionPhase;
(window as any).testCompleteGameFlow = testCompleteGameFlow;
(window as any).resetGameToSelectionPhase = resetGameToSelectionPhase;
