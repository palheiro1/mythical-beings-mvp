# Mythical Beings PvP Card Game MVP – Phase 2 Tasks

This document outlines the next steps after completing the initial setup and basic implementation described in `TODO.md`. The focus is on refining core mechanics, implementing detailed rules, enhancing the UI, and thorough testing to complete the MVP.

---

## General Instructions
- Follow tasks sequentially where dependencies exist.
- Test thoroughly after implementing significant features.
- Commit changes frequently.
- Mark tasks as complete using checkboxes (`- [ ]`).

---

## Task 0: Implement Authentication (Clerk + Supabase)
- [ ] **Action:** Integrate Clerk for Web3 authentication and configure Supabase JWT handling.
    - **Details:**
        - Install `@clerk/clerk-react`.
        - Set up a Clerk application in the Clerk dashboard.
        - Enable Web3 authentication (MetaMask/WalletConnect) in Clerk settings.
        - Create a Clerk JWT template compatible with Supabase (correct issuer, signature algorithm, `sub` claim mapping to Clerk User ID, potentially add `wallet_address` as custom claim).
        - Configure Supabase Auth settings (via dashboard or config) to use Clerk's JWKS endpoint for JWT verification.
        - Wrap the React application (`App.tsx` or `main.tsx`) with `<ClerkProvider>`.
        - Implement sign-in/sign-up UI using Clerk components (`<SignInButton>`, `<SignUpButton>`, `<UserButton>`) or hooks (`useSignIn`, `useSignUp`, `useAuth`) in `Home.tsx`.
        - Update `src/utils/supabase.ts` to initialize the Supabase client and configure it to automatically fetch the JWT token from the active Clerk session (`getToken({ template: 'supabase' })`).
        - Update Supabase RLS policies for `games`, `game_states`, `moves` tables to use `auth.uid()` (which will now be the Clerk User ID) for authorization. Ensure `player1_id` and `player2_id` in the `games` table store the Clerk User ID (text).

---

## Task 1: Refine `SUMMON_KNOWLEDGE` Action
- [x] **Action:** Fully implement and test the `SUMMON_KNOWLEDGE` action handler and UI interaction.
    - **Details:**
        - Ensure strict validation of Creature's `currentWisdom` >= Knowledge card `cost`.
        - Implement logic to replace/discard a previously summoned Knowledge card on the target Creature if one exists (as per `RULES.md`).
        - Update `rules.ts` (`isValidAction`) and `actions.ts` (`summonKnowledge`).
        - Connect the UI in `GameScreen.tsx` to allow selecting a Knowledge card from hand and a target Creature on the field.
        - Provide clear UI feedback on success or failure (e.g., highlighting valid targets, showing error messages).

---

## Task 2: Implement Full Knowledges Phase Logic
- [x] **Action:** Implement the automatic execution of the Knowledges Phase.
    - **Details:**
        - Modify the game state transition logic (likely in `state.ts` or `rules.ts`) to automatically trigger this phase at the start of each turn (from turn 2 onwards).
        - Implement effect execution for **Allies** and **Spells** currently in play (attached to creatures). Reference `effects.ts` if applicable, or implement basic effect handling based on the `effect` string for MVP.
        - Implement the 90° counterclockwise rotation of all active Knowledge cards after effects resolve.
        - Implement the discarding logic: remove Knowledge cards that complete a 360° rotation or have no further actions (requires defining card actions/lifecycles more clearly, potentially adding data to `knowledges.json` or `types.ts`).
        - Update `GameState` and sync with Supabase.

---

## Task 3: Implement Creature Passive Abilities
[Approach 2: Centralized Passive Ability Check Function

Concept: Create a dedicated function, perhaps applyPassiveAbilities(state: GameState, triggerEvent: string, eventData: any): GameState, likely within src/game/rules.ts or a new src/game/passives.ts. This function is called from various points in the action handlers or reducer whenever a potential trigger occurs.
Example Triggers: 'BEFORE_SUMMON', 'AFTER_SUMMON', 'AFTER_DRAW', 'TURN_START', 'BEFORE_ACTION_VALIDATION', 'DAMAGE_CALCULATION', etc.
eventData would contain relevant context (e.g., { playerId, creatureId, knowledgeId } for a summon).
The applyPassiveAbilities function would contain a large switch statement or series of if statements based on triggerEvent and then check all relevant creatures' passive abilities.
Pros:
Centralizes passive ability logic in one place.
Keeps action handlers and the main reducer slightly cleaner.
Easier to see all passive logic together.
Cons:
The central function can become a bottleneck and very large/complex itself.
Still requires identifying all necessary trigger points in the codebase to call this function.
Passing the correct eventData for every trigger can be cumbersome.
Managing interactions and timing might still be complex within this single function.
]
- [x] **Action:** Set up the central passive ability handling framework and integrate triggers.
    - **Details:**
        - Create `src/game/passives.ts` with `applyPassiveAbilities` function structure and trigger types.
        - Integrate calls to `applyPassiveAbilities` into the `gameReducer` at key trigger points (e.g., `TURN_START`, `KNOWLEDGE_LEAVE` from rotation/Pele).
- [x] **Action:** Integrate **missing** passive ability triggers.
    - **Details:**
        - In `src/game/state.ts` (`gameReducer`), add calls to `applyPassiveAbilities` for the `SUMMON_KNOWLEDGE` action to trigger `AFTER_PLAYER_SUMMON` and `AFTER_OPPONENT_SUMMON` with appropriate `eventData`.
        - In `src/game/state.ts` (`gameReducer`), add calls to `applyPassiveAbilities` for the `DRAW_KNOWLEDGE` action to trigger `AFTER_PLAYER_DRAW` and `AFTER_OPPONENT_DRAW` with appropriate `eventData`.
        - Ensure `KNOWLEDGE_LEAVE` is triggered for *all* relevant discard/removal scenarios (e.g., `terrestrial4` effect).
- [x] **Action:** Implement logic for remaining Creature passive abilities within `applyPassiveAbilities`.
    - **Details:**
        - Implement passives requiring specific integrations:
            - **Dudugera/Kappa:** Modify `isValidAction` in `src/game/rules.ts` to check for these creatures and prevent the relevant action if the passive is active (Handled action cost reduction in `isValidAction`).
            - **Zhar Ptitsa:** Implement blocking logic if applicable to MVP. (Blocking is post-MVP).
        - Review `src/assets/creatures.json` and ensure all passives listed there have corresponding logic implemented in `applyPassiveAbilities` based on their triggers (or handled elsewhere).
        - Verify logic for existing passives (Adaro, Caapora, Inkanyamba, etc.) is correct now that triggers are integrated.
- [x] **Action:** Review Trepulcahue's defense passive.
    - **Details:**
        - The current implementation adds defense directly in `executeKnowledgePhase` (`rules.ts`).
        - Decided this is acceptable for MVP simplicity.

---

## Task 4: Implement Remaining Knowledge Effect Types
- [x] **Action:** Implement "While In Play" Knowledge effects.
    - **Details:**
        - Identify effects marked as "While In Play" (e.g., `aquatic3` - prevent summon).
        - Modify the relevant game logic functions (e.g., `isValidAction` in `rules.ts`) to check the active Knowledge cards on creatures and apply these persistent effects.
        - Example: `isValidAction` for `SUMMON_KNOWLEDGE` should check if the opponent has `aquatic3` active. (Implemented in `rules.ts`)
- [x] **Action:** Implement "User Interaction" Knowledge effects.
    - **Details:**
        - Identify effects requiring player choice (e.g., `terrestrial2` - choose discard, `terrestrial4` - choose target, `aquatic1` - choose target).
        - Determine MVP scope:
            - **Option B (Simplified):** Keep the current auto-resolve/logging behavior for MVP, but clearly document this limitation. (Decision made, current implementation aligns with this).
        - Update `effects.ts` and potentially `state.ts`, `actions.ts`, and UI components based on the chosen approach. (No changes needed for Option B).

---

## Task 5: Implement Market Refill Logic
- [x] **Action:** Ensure the Knowledge Market refills automatically.
    - **Details:**
        - Modify the `drawKnowledge` action handler in `actions.ts`.
        - After a player successfully draws a card from the `market` array in `GameState`, check if the `knowledgeDeck` has cards remaining.
        - If yes, move the top card from `knowledgeDeck` to the `market` array to maintain 5 cards (or fewer if the deck is empty).
        - Update `GameState` and sync.

---

## Task 6: Enhance UI Feedback and State Display
- [ ] **Action:** Improve the user interface to provide clearer game state information and feedback.
    - **Details:**
        - Clearly display whose turn it is and the current game phase (`Knowledges` or `Action`).
        - Show the number of actions remaining in the Action Phase.
        - Visually indicate the `currentWisdom` of each Creature.
        - Visually represent attached Knowledge cards on Creatures (perhaps slightly overlapping or below).
        - Show Knowledge card rotation state if implemented visually.
        - Display game log messages (`GameState.log`) in a dedicated area.
        - Provide visual feedback when actions are successfully executed or invalid (including feedback from new passive/effect integrations).
        - Ensure the win condition display is clear when a player's Power reaches 0.

---

## Task 7: Comprehensive End-to-End Testing
- [ ] **Action:** Perform thorough testing of the complete game flow with multiplayer sync.
    - **Details:**
        - **Authentication:** Test signing in and out using Clerk with a Web3 wallet. Verify Supabase requests are authenticated correctly.
        - **Manual Testing:**
            - Simulate multiple full matches using two browser windows, each signed in with a different wallet via Clerk, connected via Supabase.
            - Test all actions (`ROTATE_CREATURE`, `DRAW_KNOWLEDGE`, `SUMMON_KNOWLEDGE`, `END_TURN`).
            - Verify Knowledges Phase execution (effects, rotation, discard), including damage/defense buffering and resolution.
            - **Test Passive Ability Triggers:** Specifically test `AFTER_..._SUMMON`, `AFTER_..._DRAW`, `TURN_START`, `KNOWLEDGE_LEAVE` triggers and verify the corresponding passive effects activate correctly (e.g., Adaro draw, Caapora damage, Inkanyamba discard option, Japinunus power gain, Lisovik/Tsenehale effects).
            - **Test Specific Passive Integrations:** Verify Dudugera/Kappa action prevention works. Test Trepulcahue defense bonus.
            - **Test "While In Play" Effects:** Verify effects like `aquatic3` correctly prevent actions.
            - **Test "User Interaction" Effects:** Verify the implemented behavior (auto-resolve or choice mechanism).
            - Verify Market refill.
            - Confirm win condition logic and display.
            - Test edge cases: full hand, empty market, empty deck, summoning with insufficient Wisdom, trying to take >2 actions.
        - **Debugging:**
            - Use browser developer tools to inspect state, network requests (Supabase), and console logs for errors.
            - Add temporary logging if needed to trace state changes.
        - **Fix Bugs:** Address any issues found in game logic, state synchronization, UI rendering, or authentication integration.

---

## Task 8: Code Review and Refinement
- [ ] **Action:** Review code for clarity, consistency, and potential improvements.
    - **Details:**
        - Ensure consistent coding style.
        - Add comments where logic is complex (especially in `passives.ts` and `effects.ts`).
        - Refactor repetitive code if necessary.
        - Verify TypeScript types are used effectively.
        - Remove any temporary debugging code.

---

## Task 9: Final Build and Commit
- [ ] **Action:** Prepare the final MVP build.
    - **Details:**
        - Run `npm run build` to ensure the project builds without errors.
        - Perform one final quick playthrough test on the built version if possible.
        - Commit the final, tested code: `git add . && git commit -m "feat: Complete Mythical Beings MVP implementation (Phase 2)"`.

---

## Post-MVP Considerations (Future Steps)
- Implement specific Knowledge card effect timings (Appearance, Ongoing, Final).
- Fetch real NFT data (Ethers.js) - potentially link NFTs to Clerk user profiles.
- Add animations and improved visual polish.
- Implement robust error handling for network issues or player disconnects.
- Consider Supabase Edge Functions for secure server-side validation (can still be triggered by authenticated requests).
- Expand unit and integration test coverage.

---

# End of Phase 2 Task List
