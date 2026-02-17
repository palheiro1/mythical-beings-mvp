# Passive Abilities Implementation Status

**Date:** 2025-05-05

## Purpose

Passive abilities are unique effects associated with each Creature card. They provide ongoing benefits or trigger specific effects based on game events, adding strategic depth and differentiating the creatures beyond their basic stats and wisdom cycles.

## Architecture

The implementation follows **Approach 2: Centralized Passive Ability Check Function** as outlined in `TODO2.md`.

- **Central Function:** A single function `applyPassiveAbilities(state: GameState, trigger: PassiveTriggerType, eventData: PassiveEventData): GameState` located in `src/game/passives.ts` handles the logic for *all* passive abilities.
- **Standardized Triggers:** The function is called whenever a standardized trigger event occurs in the game. Triggers are defined in `src/game/types.ts` and fully documented in `TRIGGERS.md`. Examples include:
  - `TURN_START`
  - `AFTER_PLAYER_SUMMON`
  - `AFTER_OPPONENT_SUMMON`
  - `AFTER_PLAYER_DRAW`
  - `AFTER_OPPONENT_DRAW`
  - `KNOWLEDGE_LEAVE`
- **Event Data:** Contextual information about the trigger event (e.g., which player acted, which card was involved) is passed via the `PassiveEventData` interface, also defined in `src/game/types.ts`.
- **State Handling:** The `applyPassiveAbilities` function receives the current game state, applies any relevant passive effects by potentially modifying the state, and returns the modified state. It iterates through all creatures of both players for each trigger.
- **Recursion:** The function can call itself recursively if one passive effect triggers another (e.g., Pele discarding a card triggers `KNOWLEDGE_LEAVE` for that card).

## Current Implementation (`src/game/passives.ts`)

The `applyPassiveAbilities` function includes logic for all standardized creature passives, each mapped to a specific trigger:

| Creature       | Trigger                | Effect Summary                                      |
|---------------|------------------------|-----------------------------------------------------|
| Caapora       | TURN_START             | If opponent has more cards in hand, deal 1 damage   |
| Trepulcahue   | TURN_START             | If owner has more cards in hand, deal 1 damage      |
| Zhar-Ptitsa   | TURN_START             | Owner draws 1 card from market (free draw)          |
| Adaro         | AFTER_PLAYER_SUMMON    | Owner draws 1 card from market (if water on Adaro)  |
| Japinunus     | AFTER_PLAYER_SUMMON    | Owner gains +1 Power (if air knowledge summoned)    |
| Kyzy          | AFTER_PLAYER_SUMMON/   | Opponent discards 1 card (if earth knowledge)       |
|               | AFTER_OPPONENT_SUMMON  |                                                     |
| Pele          | AFTER_PLAYER_SUMMON    | Discard 1 opponent knowledge with lower cost        |
| Tulpar        | AFTER_PLAYER_SUMMON    | Rotate one owner's creature 90º (if air knowledge)  |
| Trempulcahue  | AFTER_PLAYER_SUMMON    | Summoned knowledge gains +1 defense (log only)      |
| Lafaic        | AFTER_PLAYER_SUMMON    | Rotate one other knowledge 90º (if water on Lafaic) |
| Tarasca       | AFTER_PLAYER_SUMMON    | Opponent takes 1 damage (if earth knowledge)        |
| Inkanyamba    | AFTER_PLAYER_DRAW/     | Discard top card from market, refill if possible    |
|               | AFTER_OPPONENT_DRAW    |                                                     |
| Lisovik       | KNOWLEDGE_LEAVE        | Deal 1 damage to opponent (if earth knowledge)      |
| Tsenehale     | KNOWLEDGE_LEAVE        | Owner gains +1 Power (if air knowledge)             |

## Working Status

All passives above are implemented and use the standardized trigger system. The function is called from the appropriate points in the game logic with the correct `trigger` and `eventData`.

## Next Steps

- **Testing:** Test each passive individually and in combination after trigger integration.
- **UI:** Ensure game log (`state.log`) clearly indicates when passives trigger and what their effect was.
- **Edge Cases:** Continue to refine and test for chained triggers and complex interactions.

## References
- See `TRIGGERS.md` for a full list and explanation of standardized triggers.
- See `src/game/passives.ts` for the implementation.
- See `EFFECTS.md` for knowledge card effect triggers and logic.
