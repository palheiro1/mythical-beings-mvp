// Test script to debug NFT Selection navigation issues
// Run this in the browser console to simulate game states

const testNavigationBug = async () => {
  console.log('🔍 Starting NFT Selection navigation test...');
  
  try {
    // Get current URL to extract gameId
    const urlParts = window.location.pathname.split('/');
    const gameId = urlParts[urlParts.length - 1];
    
    if (!gameId || gameId === 'nft-selection') {
      console.error('❌ No gameId found in URL');
      return;
    }
    
    console.log(`🎮 Testing game: ${gameId}`);
    
    // Check current game state
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      console.error('❌ Error fetching game:', gameError);
      return;
    }
    
    console.log('📊 Current game data:', gameData);
    
    const state = gameData.state || {};
    console.log('🎯 Current state:', {
      player1Complete: state.player1SelectionComplete,
      player2Complete: state.player2SelectionComplete,
      player1Creatures: state.player1SelectedCreatures,
      player2Creatures: state.player2SelectedCreatures
    });
    
    // Test scenario: Force both players to complete
    console.log('🧪 Testing: Force both players complete...');
    
    const testState = {
      ...state,
      player1SelectionComplete: true,
      player2SelectionComplete: true,
      player1SelectedCreatures: state.player1SelectedCreatures || ['test1', 'test2', 'test3'],
      player2SelectedCreatures: state.player2SelectedCreatures || ['test4', 'test5', 'test6']
    };
    
    const { error: updateError } = await supabase
      .from('games')
      .update({ state: testState })
      .eq('id', gameId);
    
    if (updateError) {
      console.error('❌ Error updating game state:', updateError);
      return;
    }
    
    console.log('✅ Updated game state to force both players complete');
    console.log('🔄 This should trigger navigation to game screen...');
    
    // Wait and check again
    setTimeout(async () => {
      const { data: updatedGame } = await supabase
        .from('games')
        .select('state')
        .eq('id', gameId)
        .single();
      
      console.log('📊 Final state check:', updatedGame?.state);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Also create a reset function
const resetGameState = async () => {
  const urlParts = window.location.pathname.split('/');
  const gameId = urlParts[urlParts.length - 1];
  
  if (!gameId || gameId === 'nft-selection') {
    console.error('❌ No gameId found in URL');
    return;
  }
  
  const { error } = await supabase
    .from('games')
    .update({ 
      state: {
        player1SelectionComplete: false,
        player2SelectionComplete: false
      }
    })
    .eq('id', gameId);
    
  if (error) {
    console.error('❌ Error resetting game state:', error);
  } else {
    console.log('✅ Game state reset - both players set to incomplete');
  }
};

// Make functions available globally
window.testNavigationBug = testNavigationBug;
window.resetGameState = resetGameState;

console.log('🛠️ Debug functions loaded:');
console.log('  - testNavigationBug() - Test navigation trigger');
console.log('  - resetGameState() - Reset selections to test again');

export { testNavigationBug, resetGameState };
