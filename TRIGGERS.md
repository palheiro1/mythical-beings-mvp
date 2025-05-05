# Knowledge Card Effect Triggers

## Overview

In Mythical Beings MVP, Knowledge card effects can trigger at different moments:
- **On Summon (Apparition/Appearance):** When the card enters play.
- **On Phase/Rotation:** Effects that trigger each knowledge phase, often based on rotation.
- **Final Rotation:** Effects that trigger only on the last rotation before the card is discarded (and only if the card leaves play due to reaching its max rotation).
- **While In Play:** Effects that persist as long as the card remains on the field.

**Design Decision:**
- There is **no generic `onLeave` trigger** for knowledge cards. Effects that should happen when a card leaves play only trigger if the card is leaving due to reaching its final rotation (not if destroyed, replaced, or otherwise removed early).

## Why Standardize Triggers?
- **Clarity:** Developers and designers can see exactly when and how each effect triggers.
- **Consistency:** All effects use the same mechanism, reducing bugs and confusion.
- **Extensibility:** New triggers (e.g., on-draw, on-destroy) can be added easily if needed in the future.
- **Testing:** Unit tests can target specific triggers and edge cases.

## Proposed Standard Triggers

| Trigger Name        | When It Fires                                         | Example Cards                |
|--------------------|-------------------------------------------------------|------------------------------|
| `onSummon`         | When the card is summoned/enters play                 | Aerial1, Aquatic4, Terrestrial2 |
| `onPhase`          | Each knowledge phase (rotation step)                  | Most rotational effects      |
| `onFinalRotation`  | Only when the card leaves play due to max rotation    | Terrestrial5, Aquatic5       |
| `whileInPlay`      | As long as the card is on the field                   | Aerial3, Aquatic3            |

**Note:**
- `onFinalRotation` is only triggered if the card leaves play due to reaching its max rotation. If a card is destroyed or removed by another effect before its final rotation, its `onFinalRotation` effect does **not** trigger.

## Plan for Standardization

1. **Define a Trigger Enum/Type:**
   - In `types.ts`, define a `KnowledgeEffectTrigger = 'onSummon' | 'onPhase' | 'onFinalRotation' | 'whileInPlay'`.
2. **Refactor Effect Functions:**
   - All effect functions in `effects.ts` should accept a `trigger` parameter (or similar), indicating why the effect is being called.
   - Split logic inside each effect function by trigger type.
3. **Update Effect Execution:**
   - In the reducer/phase logic (`actions.ts`, `rules.ts`), call effect functions with the correct trigger:
     - On summon: call with `trigger: 'onSummon'`.
     - Each phase: call with `trigger: 'onPhase'`.
     - On final rotation: call with `trigger: 'onFinalRotation'` (only if leaving due to max rotation).
     - For persistent effects: check/apply `whileInPlay` as needed.
4. **Update Tests:**
   - Update and expand tests to check each trigger for each card.
5. **Document Triggers:**
   - Update this file and code comments to explain the trigger system.

## Sequential To-Do List

1. **Design:**
   - [ ] Add `KnowledgeEffectTrigger` type to `types.ts`.
   - [ ] Update `KnowledgeEffectFn` signature to accept a `trigger` parameter.
2. **Refactor Effect Functions:**
   - [ ] Refactor all effect functions in `effects.ts` to use the new trigger system.
   - [ ] Remove hardcoded checks for rotation, apparition, etc., in favor of trigger-based logic.
3. **Update Effect Execution:**
   - [ ] In `actions.ts`, call the effect with `trigger: 'onSummon'` when a card is summoned.
   - [ ] In `rules.ts` (knowledge phase), call the effect with `trigger: 'onPhase'` or `onFinalRotation` as appropriate.
   - [ ] Remove any generic `onLeave` effect logic for knowledge cards.
   - [ ] For persistent effects, ensure `whileInPlay` is checked/applied each phase.
4. **Update Tests:**
   - [ ] Update all effect tests to use the new trigger system.
   - [ ] Add tests for onSummon and onFinalRotation triggers for all relevant cards.
5. **Documentation:**
   - [ ] Update this file and code comments to reflect the new system.
   - [ ] Add a table in the README or EFFECTS.md mapping each card to its triggers.

---

**Benefits:**
- Unified, extensible, and testable effect system.
- Easier to add new cards and triggers.
- Fewer bugs from inconsistent trigger handling.

**See also:**
- `EFFECTS.md` for effect implementation details.
- `REFACTOR.md` for ongoing effect/data refactoring.
- `TESTINGSUITE.md` for test coverage and plans.
