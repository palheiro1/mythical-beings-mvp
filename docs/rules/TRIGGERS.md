# Knowledge card effect timing

Use the public wording in cards, lessons and match history. The engine and replay protocol retain their event identifiers.

| Player-facing wording | Engine event or condition | Example |
| --- | --- | --- |
| On play | `onSummon` | Lepidoptera gives its player 1 Power when played. |
| During your Knowledge Phase | `onPhase` on the active player's card | Fire discards qualifying opposing Knowledge cards. |
| On final rotation | `onPhase` with `isFinalRotation` | Galapago grants an extra action. |
| While in play | Continuous board state, also called `whileInPlay` in the trigger types | Owl modifies Wisdom. Hurricane blocks play on the facing Creature. |
| When this card leaves play | `KNOWLEDGE_LEAVE` | Lisovik also reacts when an Earth Knowledge card is replaced. |
| When you play a card | `AFTER_PLAYER_SUMMON`, `AFTER_OPPONENT_SUMMON` | Tulpar offers a free rotation when its player plays an Air Knowledge card. |
| When you draw a card | `AFTER_PLAYER_DRAW`, `AFTER_OPPONENT_DRAW` | Inkanyamba can discard a card from the Market. |
| At the start of your turn | `TURN_START` | Caapora compares hand sizes. |

The [digital rules](RULES.md) describe the turn sequence. The [Creature catalog](../../src/assets/creatures.json) and [Knowledge card catalog](../../src/assets/knowledges.json) contain the current player-facing text.
