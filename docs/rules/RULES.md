# Mythical Beings (Digital) - Rules

This rules document describes the **current digital implementation** (the truth is the engine + tests in `mythical-beings-mvp/src/game/**` and `mythical-beings-mvp/tests/**`).

**Players:** 2  
**Objective:** Reduce your opponent’s Power from 20 to 0.  
**Draw:** If both players reach 0 Power or less simultaneously.

## Setup

1. Each player selects **3 Creatures** (in the app this happens during the selection flow).
2. Each player starts at **20 Power**.
3. The game creates a Knowledge deck and reveals a **Market** of **5** Knowledge cards.

## Cards

### Creatures

Each Creature has:
- **Element**
- **Passive ability**
- **Wisdom cycle**: Wisdom is determined by the Creature’s rotation (0/90/180/270 degrees).

Rotating a Creature changes its Wisdom to the value for the new rotation (it is not a simple +1).

### Knowledge (Spells)

In the current digital deck, all Knowledge cards are `spell` type.

Each Knowledge has:
- **Cost**: can be summoned only if the target Creature’s current Wisdom is >= cost
- **Rotation**: starts at 0 when played, then advances each Knowledge Phase
- **maxRotations**: when the card reaches its maximum rotations it **leaves play** and is discarded

Board limits:
- Each Creature slot can hold **at most 1 Knowledge**.
- **Knowledge replacement is not allowed**: you cannot summon a Knowledge onto an occupied slot.
- Some effects can **block** a slot from summoning (example: `aquatic3`).

## Turn Structure

Each turn has two phases.

### 1) Knowledge Phase (automatic)

At the start of a turn, the game resolves the Knowledge Phase:

1. For every Knowledge currently in play (both players):
   - Its effect is resolved using its **current rotation** (pre-rotation).
   - Then it rotates **+90 degrees**.
   - If it reaches `maxRotations`, it leaves play and is discarded (this can trigger passives).
2. Win conditions are checked.

### 2) Action Phase (current player)

The current player gets `actionsPerTurn` actions (normally **2**, but some effects can grant extra actions next turn).

Available actions:
- **Rotate a Creature**: +90 degrees (max 270). Updates its Wisdom using the wisdom cycle.
- **Draw a Knowledge** from the Market: hand max size is **5**. The Market refills from the deck if possible.
- **Summon a Knowledge** from hand onto a Creature slot (must be empty and not blocked, and Wisdom >= cost).
  - Summoning usually costs 1 action.
  - Some passives can make a summon **free** (does not spend an action).
- **End Turn**: you may end early; otherwise the turn ends automatically when you spend all actions.

## Notes

- Knowledge effect text may mention “Appearance/Ongoing/Final”, but the digital behavior is implemented by code in `mythical-beings-mvp/src/game/effects.ts` and may differ from the physical rulebook.

