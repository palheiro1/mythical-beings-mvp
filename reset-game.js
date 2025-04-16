
// Reset Game Script
import { supabase } from './src/utils/supabase';

// Change this to the game ID you want to reset
const gameIdToReset = 'test-game';

async function resetGame() {
  try {
    const { data, error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameIdToReset);
      
    if (error) {
      console.error('Error deleting game:', error);
      return;
    }
    
    console.log('Game successfully reset:', gameIdToReset);
    console.log('Now refresh your browser or navigate to a new game URL');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

resetGame();

