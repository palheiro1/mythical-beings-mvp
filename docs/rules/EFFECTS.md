# Knowledge Card Effects – Technical Overview

## Overview

The effects of Knowledge cards (Spells/Allies) in the Mythical Beings MVP are implemented in a modular, extensible, and testable way. Each card with a special effect is mapped to a TypeScript function in `src/game/effects.ts`. This function receives the current game state, the player and field context, and the card's rotation, and returns the updated game state with logs for user feedback.

## Standardized Effect Triggers

All knowledge card effects are now mapped to a standardized set of triggers, fully documented in `TRIGGERS.md`:

- **onSummon**: When the card is summoned/enters play.
- **onPhase**: Each knowledge phase (rotation step).
- **onFinalRotation**: When the card leaves play due to reaching its max rotation.
- **whileInPlay**: As long as the card remains on the field.
- **TURN_START**: At the start of a player's turn (for passives).
- **AFTER_PLAYER_SUMMON / AFTER_OPPONENT_SUMMON**: After a player or opponent summons a knowledge card.
- **AFTER_PLAYER_DRAW / AFTER_OPPONENT_DRAW**: After a player or opponent draws a card.
- **KNOWLEDGE_LEAVE**: When a knowledge card leaves play (for passives that care about this event).

Each effect function in `effects.ts` is responsible for handling the logic for the appropriate trigger(s). The reducer or phase logic ensures the correct trigger and context are passed.

## How It Works

- **Effect Function Map:**
  - Each Knowledge card with a unique effect (e.g., `terrestrial1`, `aquatic5`, `aerial3`) has an entry in the `knowledgeEffects` map in `effects.ts`.
  - The function signature is:
    ```ts
    (params: {
      state: GameState;
      playerIndex: number;
      fieldSlotIndex: number;
      knowledge: Knowledge;
      rotation: number;
      isFinalRotation: boolean;
    }) => GameState;
    ```
  - The function can modify the game state (damage, defense, power, etc.) and always appends a detailed log message to `state.log` for user feedback and debugging.

- **Effect Execution:**
  - During the Knowledge Phase (`executeKnowledgePhase` in `rules.ts`), each summoned Knowledge card's effect function is called with the current context.
  - The effect function is responsible for applying its logic for the current rotation.
  - Effects that require special handling (e.g., "on summon", "on leave", "while in play") are noted in the code and may require additional logic in the reducer or UI.

- **Logging:**
  - Every effect function appends a human-readable log to `state.log` describing what happened (e.g., damage dealt, defense provided, special triggers).
  - These logs are intended for both debugging and user-facing ActionBar/notification UI.

## What Is Implemented

- All Terrestrial, Aquatic, and Aerial knowledge effects are implemented in `effects.ts` with detailed logs.
- Effects that depend on card rotation, opponent state, or special triggers are handled.
- Effects that require user interaction or persistent state (e.g., "on summon", "on leave", "while in play") are logged and marked for further implementation.

## What Is Missing / To-Do

- **On Summon/On Leave Effects:**
  - Some cards (e.g., `aquatic4`, `aquatic5`, `aerial1`) have effects that should trigger when the card is summoned or leaves play. These are currently only logged and must be handled in the reducer or phase logic (e.g., grant extra actions, draw a card, etc.).

- **While In Play Effects:**
  - Cards like `aquatic3` and `aerial3` require a persistent effect while they remain on the field (e.g., block summoning, boost wisdom). This requires either a flag in the game state or a check in the action validation logic.

- **Defense Mechanic:**
  - "Defense" is currently only logged. To implement it, add a defense property to creatures/players and update the damage calculation logic to respect defense.

- **User Interaction:**
  - Some effects (e.g., `aquatic1` rotating a selected knowledge, `terrestrial5` letting the user pick a card to destroy) require user input. For MVP, these are logged or auto-resolved, but a UI prompt and reducer support are needed for full implementation.

- **Testing:**
  - Add/expand unit tests in `tests/rules.test.ts` and `tests/state.test.ts` to cover all effect logic and edge cases.

## Possible Improvements

- **Data-Driven Effects:**
  - For simple effects, consider encoding logic in JSON (e.g., damage per rotation) and using a generic handler. For complex effects, keep using the function map.

- **Effect Triggers:**
  - Add explicit support for `onSummon`, `onLeave`, and `whileInPlay` triggers in the effect system and game state.

- **UI Feedback:**
  - Display `state.log` entries in the ActionBar or as in-game notifications for better user experience.

- **Type Safety:**
  - Expand TypeScript types for effect parameters and state mutations for even safer code.

- **Documentation:**
  - Keep this document and code comments up to date as new effects and mechanics are added.

## How to Add a New Effect

1. Add a new function to the `knowledgeEffects` map in `effects.ts` with the card's id as the key.
2. Implement the effect logic, using the provided parameters and updating the game state as needed.
3. Add a detailed log message for user feedback.
4. If the effect requires special triggers or UI, add a TODO or comment for further implementation.
5. Update tests to cover the new effect.

## References
- See `src/game/effects.ts` for all implemented effects and their logic.
- See `src/game/rules.ts` for phase and effect execution logic.
- See `README.md` for overall project structure and game rules.
- See `TRIGGERS.md` for standardized effect triggers and their documentation.

---

For questions or to contribute improvements, contact the core dev team or open a PR with your changes.
