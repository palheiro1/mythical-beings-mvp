// Navigation Manager for NFTSelection - prevents race conditions
// Handles game state updates and navigation in a centralized way

import { supabase, RealtimeChannel } from '../utils/supabase.js';

export interface GameState {
  player1SelectionComplete?: boolean;
  player2SelectionComplete?: boolean;
  player1SelectedCreatures?: string[];
  player2SelectedCreatures?: string[];
}

export interface NavigationManagerOptions {
  gameId: string;
  currentPlayerId: string;
  onNavigateToGame: () => void;
  onWaitingStateChange: (waiting: boolean) => void;
  onError: (error: string) => void;
}

export class NFTSelectionNavigationManager {
  private channel: RealtimeChannel | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private destroyed = false;
  private options: NavigationManagerOptions;

  constructor(options: NavigationManagerOptions) {
    this.options = options;
    this.initialize();
  }

  private async initialize() {
    console.log('[NavigationManager] Initializing for game:', this.options.gameId);
    
    // Check initial state
    await this.checkGameState();
    
    // Set up realtime subscription
    this.setupRealtimeSubscription();
    
    // Start polling as backup (will be cancelled if realtime works)
    setTimeout(() => {
      if (!this.destroyed && !this.pollInterval) {
        console.log('[NavigationManager] Starting backup polling (realtime may not be working)');
        this.startPolling();
      }
    }, 5000); // Start backup polling after 5 seconds
  }

  private async checkGameState(): Promise<void> {
    if (this.destroyed) return;

    try {
      console.log('[NavigationManager] Checking game state for gameId:', this.options.gameId);
      
      const { data: gameData, error } = await supabase
        .from('games')
        .select('state, player1_id, player2_id')
        .eq('id', this.options.gameId)
        .single();

      if (error) throw error;
      if (!gameData || this.destroyed) return;

      const isPlayer1 = gameData.player1_id === this.options.currentPlayerId;
      const state = gameData.state as GameState || {};
      
      const player1Complete = state.player1SelectionComplete || false;
      const player2Complete = state.player2SelectionComplete || false;
      const currentPlayerComplete = isPlayer1 ? player1Complete : player2Complete;

      console.log('[NavigationManager] Game state check:', {
        player1Complete,
        player2Complete,
        currentPlayerComplete,
        isPlayer1,
        currentPlayerId: this.options.currentPlayerId,
        player1_id: gameData.player1_id,
        player2_id: gameData.player2_id,
        fullState: state
      });

      // Both players completed - navigate to game
      if (player1Complete && player2Complete) {
        console.log('[NavigationManager] 🎯 DELAYED CHECK: Both players completed, navigating to game initialization');
        this.cleanup();
        this.options.onNavigateToGame();
        return;
      }

      // Current player completed but opponent hasn't - set waiting
      if (currentPlayerComplete) {
        console.log('[NavigationManager] ⏳ WAITING: Current player completed, waiting for opponent');
        this.options.onWaitingStateChange(true);
      }

    } catch (error: any) {
      console.error('[NavigationManager] Error checking game state:', error);
      this.options.onError(`Failed to check game state: ${error.message}`);
    }
  }

  private setupRealtimeSubscription(): void {
    if (this.destroyed) return;

    console.log('[NavigationManager] Setting up realtime subscription for game:', this.options.gameId);
    
    // Use a unique channel name to avoid conflicts
    const channelName = `nft-navigation-${this.options.gameId}-${Date.now()}`;
    this.channel = supabase.channel(channelName);
    
    this.channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${this.options.gameId}`
      }, (payload) => {
        if (this.destroyed) return;
        console.log('[NavigationManager] Raw realtime payload:', payload);
        this.handleGameUpdate(payload);
      })
      .subscribe((status, err) => {
        if (this.destroyed) return;
        
        console.log('[NavigationManager] Subscription status:', status, err);
        
        if (status === 'SUBSCRIBED') {
          console.log('[NavigationManager] Realtime subscription active for channel:', channelName);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error('[NavigationManager] Realtime failed, falling back to polling:', status, err);
          this.startPolling();
        }
      });
  }

  private handleGameUpdate(payload: any): void {
    if (this.destroyed) return;

    console.log('[NavigationManager] Realtime update received:', payload);
    
    const updatedGame = payload.new;
    if (!updatedGame?.state) {
      console.log('[NavigationManager] No state in update payload');
      return;
    }

    const state = updatedGame.state as GameState;
    const player1Complete = state.player1SelectionComplete || false;
    const player2Complete = state.player2SelectionComplete || false;

    console.log('[NavigationManager] Update status:', { 
      player1Complete, 
      player2Complete,
      fullState: state 
    });

    // Both completed - navigate immediately
    if (player1Complete && player2Complete) {
      console.log('[NavigationManager] 🎯 REALTIME: Both players completed, navigating to game initialization');
      this.cleanup();
      this.options.onNavigateToGame();
      return;
    }

    // Check if current player just completed
    const isPlayer1 = updatedGame.player1_id === this.options.currentPlayerId;
    const currentPlayerComplete = isPlayer1 ? player1Complete : player2Complete;
    
    console.log('[NavigationManager] Current player status:', {
      isPlayer1,
      currentPlayerId: this.options.currentPlayerId,
      currentPlayerComplete
    });
    
    if (currentPlayerComplete) {
      console.log('[NavigationManager] ⏳ REALTIME WAITING: Current player completed');
      this.options.onWaitingStateChange(true);
    }
  }

  private startPolling(): void {
    if (this.destroyed || this.pollInterval) return;

    console.log('[NavigationManager] Starting polling fallback');
    
    this.pollInterval = setInterval(async () => {
      if (this.destroyed) return;
      console.log('[NavigationManager] Polling check...');
      await this.checkGameState();
    }, 2000); // Poll every 2 seconds
  }

  public async updatePlayerSelection(selectedCreatures: string[]): Promise<void> {
    if (this.destroyed) return;

    try {
      console.log('[NavigationManager] Updating player selection');

      // Get current game data to determine player role
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('player1_id, player2_id, state')
        .eq('id', this.options.gameId)
        .single();

      if (gameError) throw gameError;
      if (!gameData) throw new Error('Game not found');

      const isPlayer1 = gameData.player1_id === this.options.currentPlayerId;
      const currentState = (gameData.state as GameState) || {};

      // Create updated state
      const newState: GameState = {
        ...currentState,
        ...(isPlayer1 ? {
          player1SelectedCreatures: selectedCreatures,
          player1SelectionComplete: true
        } : {
          player2SelectedCreatures: selectedCreatures,
          player2SelectionComplete: true
        })
      };

      console.log('[NavigationManager] About to update with state:', {
        isPlayer1,
        currentState,
        newState,
        player1Complete: newState.player1SelectionComplete,
        player2Complete: newState.player2SelectionComplete
      });

      // Update database - include both state and column updates
      const updatePayload: any = { 
        state: newState 
      };
      
      // Also update the dedicated columns for creature selections
      if (isPlayer1) {
        updatePayload.player1_selected_creatures = selectedCreatures;
      } else {
        updatePayload.player2_selected_creatures = selectedCreatures;
      }

      console.log('[NavigationManager] Updating database with payload:', updatePayload);

      const { error: updateError } = await supabase
        .from('games')
        .update(updatePayload)
        .eq('id', this.options.gameId);

      if (updateError) throw updateError;

      console.log('[NavigationManager] Selection updated successfully');

      // Set waiting state immediately
      this.options.onWaitingStateChange(true);

      // Check if both players are now complete (immediate check)
      if (newState.player1SelectionComplete && newState.player2SelectionComplete) {
        console.log('[NavigationManager] 🎯 BOTH PLAYERS COMPLETED: Navigating to game initialization');
        
        // Navigate both players to the initialization screen
        // The initialization screen will handle the coordination
        setTimeout(() => {
          if (!this.destroyed) {
            this.cleanup();
            this.options.onNavigateToGame();
          }
        }, 100);
        return;
      }

      // Add a small delay then re-check the database to catch any race conditions
      setTimeout(async () => {
        if (this.destroyed) return;
        console.log('[NavigationManager] Delayed check for both players completion...');
        await this.checkGameState();
      }, 500);

    } catch (error: any) {
      console.error('[NavigationManager] Error updating selection:', error);
      throw error;
    }
  }

  public cleanup(): void {
    if (this.destroyed) return;
    
    console.log('[NavigationManager] Cleaning up');
    this.destroyed = true;

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
