// Test the navigation fix by simulating the bug scenario
import { supabase } from '../utils/supabase.js';

export async function simulateNavigationBug() {
  console.log('🧪 Simulating navigation bug scenario...');
  
  try {
    // Find the most recent game
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
    console.log('🎮 Testing with game:', game.id);
    
    // Reset the game state to simulate the bug
    const resetState = {
      player1SelectionComplete: false,
      player2SelectionComplete: false,
      player1SelectedCreatures: [],
      player2SelectedCreatures: []
    };
    
    console.log('🔄 Resetting game state...');
    const { error: resetError } = await supabase
      .from('games')
      .update({ 
        state: resetState,
        status: 'nft_selection'
      })
      .eq('id', game.id);
      
    if (resetError) throw resetError;
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate player 1 completing selection
    console.log('👤 Simulating player 1 selection...');
    const player1State = {
      ...resetState,
      player1SelectionComplete: true,
      player1SelectedCreatures: ['creature1', 'creature2', 'creature3']
    };
    
    const { error: p1Error } = await supabase
      .from('games')
      .update({ state: player1State })
      .eq('id', game.id);
      
    if (p1Error) throw p1Error;
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate player 2 completing selection
    console.log('👤 Simulating player 2 selection...');
    const bothCompleteState = {
      ...player1State,
      player2SelectionComplete: true,
      player2SelectedCreatures: ['creature4', 'creature5', 'creature6']
    };
    
    const { error: p2Error } = await supabase
      .from('games')
      .update({ state: bothCompleteState })
      .eq('id', game.id);
      
    if (p2Error) throw p2Error;
    
    console.log('✅ Both players completed - navigation should trigger now!');
    
    // Check the final state
    const { data: finalGame, error: finalError } = await supabase
      .from('games')
      .select('*')
      .eq('id', game.id)
      .single();
      
    if (finalError) throw finalError;
    
    console.log('📊 Final game state:', {
      id: finalGame.id,
      status: finalGame.status,
      state: finalGame.state
    });
    
    return finalGame;
    
  } catch (error) {
    console.error('❌ Error simulating navigation bug:', error);
    throw error;
  }
}

// Call this function from the browser console to test
(window as any).simulateNavigationBug = simulateNavigationBug;
