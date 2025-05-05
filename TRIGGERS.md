# Knowledge Card Effect Triggers

## Overview

In Mythical Beings MVP, card effects and passives trigger at specific, well-defined moments:
- **onSummon**: When a card is summoned/enters play.
- **onPhase**: Each knowledge phase (rotation step).
- **onFinalRotation**: When a card leaves play due to reaching its max rotation.
- **whileInPlay**: As long as the card remains on the field.
- **TURN_START**: At the start of a player's turn (for passives).
- **AFTER_PLAYER_SUMMON / AFTER_OPPONENT_SUMMON**: After a player or opponent summons a knowledge card.
- **AFTER_PLAYER_DRAW / AFTER_OPPONENT_DRAW**: After a player or opponent draws a card.
- **KNOWLEDGE_LEAVE**: When a knowledge card leaves play (for passives that care about this event).

## Why Standardize Triggers?
- **Clarity**: Developers and designers can see exactly when and how each effect triggers.
- **Consistency**: All effects use the same mechanism, reducing bugs and confusion.
- **Extensibility**: New triggers can be added easily if needed in the future.
- **Testing**: Unit tests can target specific triggers and edge cases.

## Standard Triggers Table

| Trigger Name         | When It Fires                                         | Example Cards/Creatures           |
|---------------------|-------------------------------------------------------|-----------------------------------|
| onSummon            | When the card is summoned/enters play                 | Aerial1, Aquatic4, Terrestrial2   |
| onPhase             | Each knowledge phase (rotation step)                  | Most rotational effects           |
| onFinalRotation     | When the card leaves play due to max rotation         | Terrestrial5, Aquatic5            |
| whileInPlay         | As long as the card is on the field                   | Aerial3, Aquatic3                 |
| TURN_START          | At the start of a player's turn                       | Caapora, Trepulcahue, Zhar-Ptitsa |
| AFTER_PLAYER_SUMMON | After the player summons a knowledge card             | Adaro, Japinunus, Pele, Tulpar    |
| AFTER_OPPONENT_SUMMON| After the opponent summons a knowledge card          | Tarasca, Kyzy                     |
| AFTER_PLAYER_DRAW   | After the player draws a card                         | Inkanyamba                       |
| AFTER_OPPONENT_DRAW | After the opponent draws a card                       | Inkanyamba                       |
| KNOWLEDGE_LEAVE     | When a knowledge card leaves play                     | Lisovik, Tsenehale                |

## Passive Abilities: Standardized Triggers

All creature passives now use a standardized trigger and are documented in code. See the table below for a summary:

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

## Benefits
- Unified, extensible, and testable effect system.
- Easier to add new cards and triggers.
- Fewer bugs from inconsistent trigger handling.

## See Also
- `EFFECTS.md` for effect implementation details.
- `REFACTOR.md` for ongoing effect/data refactoring.
- `TESTINGSUITE.md` for test coverage and plans.
