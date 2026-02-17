# NFT Selection Implementation Plan (Option 1: Backend Dealing)

## Phase 1: Database Setup

- [✅] **Modify `games` Table:**
    - [✅] Add column: `player1_dealt_hand` (Type: `text[]` or `jsonb`)
    - [✅] Add column: `player2_dealt_hand` (Type: `text[]` or `jsonb`)
    - [✅] Add column: `player1_selected_creatures` (Type: `text[]` or `jsonb`)
    - [✅] Add column: `player2_selected_creatures` (Type: `text[]` or `jsonb`)
    - [✅] Add column: `player1_selection_complete` (Type: `boolean`, Default: `false`)
    - [✅] Add column: `player2_selection_complete` (Type: `boolean`, Default: `false`)

## Phase 2: Backend Logic (Dealing)

- [✅] **Define Creature Pool:**
    - [✅] Create/confirm a definitive list/source of 14+ base `Creature` objects with unique IDs and details. (Verified `creatures.json`)
- [✅] **Create Supabase Edge Function (`deal-cards`):**
    - [✅] Function receives `gameId`.
    - [✅] Function retrieves the base creature IDs.
    - [✅] Function shuffles the IDs randomly.
    - [✅] Function assigns the first 5 IDs to `p1Hand` and the next 5 to `p2Hand`.
    - [✅] Function updates the `games` table row for the `gameId`, setting `player1_dealt_hand`, `player2_dealt_hand`, and updating `status`.
    - [✅] Function returns success/failure. (Deployed)
- [✅] **Trigger Dealing:**
    - [✅] Modify `handleJoinGame` in `Lobby.tsx`.
    - [✅] After successful join confirmation, invoke the `deal-cards` function with the `gameId`.
    - [✅] Add error handling for the function invocation.

## Phase 3: Frontend NFT Selection Page (`NFTSelection.tsx`)

- [ ] **Fetch Dealt Hand:**
    - [ ] Remove `mockHand`.
    - [ ] Add state: `dealtCreatures: Creature[]`, `isLoadingHand: boolean`.
    *   [ ] Implement `useEffect` to fetch game data (`player1_id`, `player2_id`, `player1_dealt_hand`, `player2_dealt_hand`) based on `gameId`.
    *   [ ] Add logic to handle cases where dealt hands aren't populated yet (polling/retry or loading message).
    *   [ ] Determine if current user is player 1 or 2.
    *   [ ] Get the correct array of dealt creature IDs.
    *   [ ] Fetch full `Creature` details for the dealt IDs.
    *   [ ] Update `dealtCreatures` state.
    *   [ ] Set `isLoadingHand` to `false`.
- [ ] **Display Dealt Hand:**
    - [ ] Render `<Card>` components mapping over `dealtCreatures`.
    - [ ] Show loading indicator based on `isLoadingHand`.
- [✅] **Handle Selection:**
    - [✅] Ensure `selected` state stores IDs from `dealtCreatures`.
    - [✅] Verify `toggleSelect` logic works with the new state.
- [✅] **Confirm Selection:**
    *   [✅] Modify `handleConfirm` function.
    *   [✅] Check if exactly 3 cards are selected.
    *   [✅] Determine player role (1 or 2).
    *   [✅] Call Supabase `update` to set `playerX_selected_creatures` and `playerX_selection_complete`.
    *   [✅] Handle update errors.
    *   [✅] Set local `waiting` state to `true` on success.
- [✅] **Wait for Opponent & Navigate:**
    *   [✅] Implement `useEffect` triggered by `waiting === true`.
    *   [✅] Set up Supabase Realtime subscription to the game row, filtering by `gameId`.
    *   [✅] In the subscription callback, check if both `player1_selection_complete` and `player2_selection_complete` are `true`.
    *   [✅] If both are true, clean up the subscription and navigate to `/game/:gameId`.
    *   [✅] Return a cleanup function to remove the subscription on unmount or when `waiting` becomes false.

## Phase 4: Game Initialization (`GameScreen.tsx`)

- [✅] **Modify `useGameInitialization` Hook:**
    - [✅] Ensure initial game state fetch includes `player1_selected_creatures` and `player2_selected_creatures`.
- [✅] **Modify `initializeGame` Function:**
    - [✅] Update signature to accept `player1SelectedIds: string[]` and `player2SelectedIds: string[]`.
    - [✅] Use these IDs to look up full `Creature` objects from the defined pool.
    - [✅] Use the full `Creature` objects to set initial player creatures in the game state.
- [✅] **Pass Data in `GameScreen.tsx`:**
    - [✅] Ensure the fetched selected creature ID arrays are passed correctly to `initializeGame`.
