// Navigation Manager for NFTSelection - prevents race conditions
// Handles game state updates and navigation in a centralized way

import {
  getCardGameSessionState,
  getGameDetails,
  setCardGameSelection,
  supabase,
  RealtimeChannel,
} from '../utils/supabase.js';

export interface NFTSelectionState {
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
  private pollInterval: ReturnType<typeof setInterval> | null = null;
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
      console.log('[NavigationManager] Checking card game session state:', this.options.gameId);

      const [sessionDetails, cardState] = await Promise.all([
        getGameDetails(this.options.gameId),
        getCardGameSessionState(this.options.gameId),
      ]);

      if (!sessionDetails || !cardState || this.destroyed) return;

      const participant = sessionDetails.participants?.find(p => p.player_id === this.options.currentPlayerId);
      const slot = participant?.slot;
      const player1Complete = Boolean(cardState.selected_creatures?.['0']?.length === 3);
      const player2Complete = Boolean(cardState.selected_creatures?.['1']?.length === 3);
      const currentPlayerComplete = slot === 0 ? player1Complete : slot === 1 ? player2Complete : false;

      console.log('[NavigationManager] Game state check:', {
        player1Complete,
        player2Complete,
        currentPlayerComplete,
        slot,
        currentPlayerId: this.options.currentPlayerId,
        player1_id: sessionDetails.player1_id,
        player2_id: sessionDetails.player2_id,
        selectedCreatures: cardState.selected_creatures,
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
        table: 'card_game_session_state',
        filter: `session_id=eq.${this.options.gameId}`
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
    
    const updatedState = payload.new;
    if (!updatedState) {
      console.log('[NavigationManager] No state row in update payload');
      return;
    }

    const selectedCreatures = updatedState.selected_creatures || {};
    const player1Complete = Array.isArray(selectedCreatures['0']) && selectedCreatures['0'].length === 3;
    const player2Complete = Array.isArray(selectedCreatures['1']) && selectedCreatures['1'].length === 3;

    console.log('[NavigationManager] Update status:', { 
      player1Complete, 
      player2Complete,
      selectedCreatures,
    });

    // Both completed - navigate immediately
    if (player1Complete && player2Complete) {
      console.log('[NavigationManager] 🎯 REALTIME: Both players completed, navigating to game initialization');
      this.cleanup();
      this.options.onNavigateToGame();
      return;
    }

    // Check if current player just completed
    void this.checkGameState();
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

      const updated = await setCardGameSelection(this.options.gameId, selectedCreatures);
      if (!updated) throw new Error('Failed to update selected creatures');

      console.log('[NavigationManager] Selection updated successfully');

      // Set waiting state immediately
      this.options.onWaitingStateChange(true);

      // Check if both players are now complete (immediate check)
      const player1Complete = updated.selected_creatures?.['0']?.length === 3;
      const player2Complete = updated.selected_creatures?.['1']?.length === 3;
      if (player1Complete && player2Complete) {
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
