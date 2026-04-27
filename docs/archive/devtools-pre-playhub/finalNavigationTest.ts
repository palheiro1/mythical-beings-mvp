// Final comprehensive test with real creature data
import { supabase } from '../utils/supabase.js';

// Real creature IDs from the creatures.json file
const VALID_CREATURES = [
  'adaro', 'caapora', 'dudugera', 'inkanyamba', 
  'japinunus', 'kappa', 'kyzy', 'lamia', 
  'mishipeshu', 'nachzehrer', 'quetzalcoatl', 'wendigo'
];

export async function runComprehensiveNavigationTest() {
  console.log('🎮 COMPREHENSIVE NAVIGATION TEST WITH REAL CREATURES');
  console.log('==================================================');
  
  try {
    // Get current game ID from URL
    const currentPath = window.location.pathname;
    const gameId = currentPath.split('/')[2];
    
    if (!gameId) {
      console.error('❌ No game ID found in URL');
      return false;
    }

    console.log(`🎯 Testing game: ${gameId}`);
    console.log(`📍 Current URL: ${window.location.href}`);

    // Step 1: Reset game to clean state
    console.log('\n📋 Step 1: Resetting game to clean state...');
    await resetGameCompletely(gameId);
    
    // Step 2: Set realistic creature selections
    console.log('\n📋 Step 2: Setting up realistic creature selections...');
    const player1Creatures = VALID_CREATURES.slice(0, 3); // ['adaro', 'caapora', 'dudugera']
    const player2Creatures = VALID_CREATURES.slice(3, 6); // ['inkanyamba', 'japinunus', 'kappa']
    
    console.log('🎭 Player 1 creatures:', player1Creatures);
    console.log('🎭 Player 2 creatures:', player2Creatures);
    
    const gameState = {
      player1SelectionComplete: true,
      player2SelectionComplete: true,
      player1SelectedCreatures: player1Creatures,
      player2SelectedCreatures: player2Creatures
    };
    
    const { error } = await supabase
      .from('games')
      .update({ 
        state: gameState,
        status: 'selecting'
      })
      .eq('id', gameId);
    
    if (error) throw error;
    
    console.log('✅ Step 2 complete: Both players have valid creature selections');
    console.log('⏳ Waiting for automatic navigation...');
    
    // Step 3: Monitor navigation
    let navigationSuccess = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkNavigation = () => {
      attempts++;
      const currentUrl = window.location.pathname;
      
      console.log(`📍 Check ${attempts}: Current URL is ${currentUrl}`);
      
      if (currentUrl.includes('/game/')) {
        navigationSuccess = true;
        console.log('🎉 SUCCESS: Navigation to game screen completed!');
        console.log('🎮 Game should now initialize with real creatures');
        
        // Give the game a moment to initialize and check for errors
        setTimeout(() => {
          console.log('\n📋 Step 3: Checking game initialization...');
          checkGameInitialization();
        }, 2000);
        
        return;
      }
      
      if (attempts < maxAttempts) {
        console.log(`⏳ Still on selection screen... retrying in 1s (${attempts}/${maxAttempts})`);
        setTimeout(checkNavigation, 1000);
      } else {
        console.log('❌ NAVIGATION FAILED: Max attempts reached');
        console.log('🔧 Navigation system may need further debugging');
      }
    };
    
    // Start monitoring navigation after a short delay
    setTimeout(checkNavigation, 1000);
    
    return true;
  } catch (error) {
    console.error('❌ Error in comprehensive test:', error);
    return false;
  }
}

async function resetGameCompletely(gameId: string) {
  try {
    const cleanState = {
      player1SelectionComplete: false,
      player2SelectionComplete: false,
      player1SelectedCreatures: [],
      player2SelectedCreatures: []
    };
    
    await supabase
      .from('games')
      .update({ 
        state: cleanState,
        status: 'selecting'
      })
      .eq('id', gameId);
    
    console.log('✅ Game state reset successfully');
  } catch (error) {
    console.error('❌ Error resetting game:', error);
    throw error;
  }
}

function checkGameInitialization() {
  try {
    // Check if there are any error messages visible
    const errorElements = document.querySelectorAll('[data-testid*="error"], .error, .alert-error');
    if (errorElements.length > 0) {
      console.log('⚠️ Found error elements on page:', errorElements);
      errorElements.forEach((el, i) => {
        console.log(`Error ${i + 1}:`, el.textContent);
      });
    } else {
      console.log('✅ No obvious error elements found');
    }
    
    // Check if game components loaded
    const gameElements = document.querySelectorAll('[data-testid*="game"], .game-board, .game-screen');
    if (gameElements.length > 0) {
      console.log('🎮 Game elements found:', gameElements.length);
      console.log('✅ Game appears to be initializing correctly!');
    } else {
      console.log('⚠️ No game elements found - may still be loading');
    }
    
    console.log('\n🎉 NAVIGATION TEST COMPLETE!');
    console.log('📊 Summary:');
    console.log('- Navigation: ✅ Working correctly');
    console.log('- Real creature data: ✅ Used valid IDs');
    console.log('- Game initialization: Check above for any issues');
    
  } catch (error) {
    console.error('❌ Error checking game initialization:', error);
  }
}

// Quick test function that can be called from console
export async function quickNavigationTest() {
  console.log('⚡ QUICK NAVIGATION TEST');
  console.log('======================');
  
  const currentPath = window.location.pathname;
  const gameId = currentPath.split('/')[2];
  
  if (!gameId) {
    console.error('❌ No game ID found in URL');
    return;
  }
  
  // Use the first 6 valid creatures
  const player1 = VALID_CREATURES.slice(0, 3);
  const player2 = VALID_CREATURES.slice(3, 6);
  
  console.log('🎭 Setting up with creatures:', { player1, player2 });
  
  try {
    const { error } = await supabase
      .from('games')
      .update({ 
        state: {
          player1SelectionComplete: true,
          player2SelectionComplete: true,
          player1SelectedCreatures: player1,
          player2SelectedCreatures: player2
        },
        status: 'selecting'
      })
      .eq('id', gameId);
    
    if (error) throw error;
    
    console.log('✅ Game state updated - navigation should happen automatically!');
    console.log('⏳ Watch for automatic navigation to game screen...');
    
  } catch (error) {
    console.error('❌ Error in quick test:', error);
  }
}

// Export to window for console access
(window as any).runComprehensiveNavigationTest = runComprehensiveNavigationTest;
(window as any).quickNavigationTest = quickNavigationTest;

console.log('🎮 Final navigation test functions loaded!');
console.log('📞 Available functions:');
console.log('  - runComprehensiveNavigationTest() - Full test with monitoring');
console.log('  - quickNavigationTest() - Quick test');
