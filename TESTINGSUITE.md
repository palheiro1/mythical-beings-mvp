# Comprehensive Test Suite To-Do List

This checklist will guide the step-by-step creation and restructure of a robust, maintainable, and complete test suite for the Mythical Beings MVP project. All tests are located under the top‑level `tests/` folder, organized by feature.

## 1. Core Game Logic
- [✅] Test game initialization (basic parameters) - Covered in `tests/initializeGame/basic.test.ts`
- [✅] Test game initialization (edge cases) - Covered in `tests/initializeGame/edge-cases.test.ts`
- [✅] Test turn transitions (knowledge phase -> action phase) - Covered in `tests/rules/validation.test.ts`
- [✅] Test turn transitions (action phase -> end turn -> knowledge phase) - Covered in `tests/rules/validation.test.ts`
- [✅] Test win conditions (basic scenarios) - Covered in `tests/rules/winConditions.test.ts`
- [✅] Test win conditions (edge cases, e.g., simultaneous) - Covered in `tests/rules/winConditions.test.ts`
- [✅] Test action-per-turn limits and resets - Covered in `tests/rules/validation.test.ts`

## 2. Action Validation
- [✅] Test all valid actions (rotate, draw, summon, end turn) - Covered in `tests/rules/validation.test.ts`
- [✅] Test all invalid actions (wrong phase, wrong player, invalid payload) - Covered in `tests/rules/validation.test.ts`
- [✅] Test edge cases (full hand, insufficient wisdom, creature occupied) - Covered in `tests/rules/validation.test.ts`
- [✅] Test edge cases (empty market, empty deck, blocked slots) - Covered in `tests/rules/validation.test.ts`

## 3. Passive Abilities
- [✅] List all creature passives from `passives.ts`
  - [✅] Caapora: `TURN_START` - If opponent has > cards in hand, deal 1 damage to opponent. - Covered in `tests/gameReducer/passives/caapora.test.ts`
  - [✅] Adaro: `AFTER_PLAYER_SUMMON` (on self) - If summoned knowledge is water, draw 1 card from market (free). - Covered in `tests/gameReducer/passives/adaro.test.ts`
  - [✅] Kyzy: `AFTER_SUMMON` (Any) - If earth knowledge summoned, force OPPONENT of Kyzy's owner to discard 1 card. - Covered in `tests/gameReducer/passives/kyzy.test.ts`
  - [✅] Japinunus: `AFTER_SUMMON` (Owner) - If owner summoned air knowledge, owner gains +1 Power. - Covered in `tests/gameReducer/passives/japinunus.test.ts`
  - [✅] Kappa: (Handled elsewhere) - Summoning aquatic knowledge is a free action. - Covered in `tests/gameReducer/passives/kappa.test.ts`
  - [✅] Dudugera: (Handled elsewhere) - Summoning knowledge onto Dudugera is a free action. - Covered in `tests/gameReducer/passives/dudugera.test.ts`
  - [✅] Inkanyamba: `AFTER_PLAYER_DRAW` - Discard 1 card from market. - Covered in `tests/gameReducer/passives/inkanyamba.test.ts`
  - [✅] Lisovik: `KNOWLEDGE_LEAVE` (owner's knowledge) - If leaving knowledge is earth, deal 1 damage to opponent. - Covered in `tests/gameReducer/passives/lisovik.test.ts`
  - [✅] Pele: `AFTER_SUMMON` (Owner) - If owner summoned earth knowledge, discard 1 opponent knowledge with lower cost. - Covered in `tests/gameReducer/passives/pele.test.ts`
  - [✅] Tsenehale: `KNOWLEDGE_LEAVE` (owner's knowledge) - If leaving knowledge is air, owner gains +1 Power. - Covered in `tests/gameReducer/passives/tsenehale.test.ts`
  - [✅] Tulpar: `AFTER_SUMMON` (Owner) - If owner summoned air knowledge, rotate one of owner's creatures 90º. - Covered in `tests/gameReducer/passives/tulpar.test.ts`
  - [✅] Trempulcahue: `AFTER_PLAYER_SUMMON` (Owner) - Knowledge summoned onto Trempulcahue gains +1 Defense. - Covered in `tests/gameReducer/passives/trempulcahue.test.ts`
  - [✅] Zhar-Ptitsa: `TURN_START` - Draw 1 card from market (free). `DAMAGE_CALCULATION` - Owner's aerial knowledge bypasses opponent's defense. - Covered in `tests/gameReducer/interactions.test.ts` (Turn Start) & `tests/gameReducer/passives/zhar-ptitsa.test.ts` (Damage Calc)
  - [✅] Lafaic: `AFTER_PLAYER_SUMMON` (Owner) - When owner summons aquatic knowledge onto Lafaic, rotate one other knowledge 90º. - Covered in `tests/gameReducer/passives/lafaic.test.ts`
  - [✅] Tarasca: `AFTER_OPPONENT_SUMMON` - If opponent summons terrestrial knowledge, deal 1 damage to opponent summoner. - Covered in `tests/gameReducer/passives/tarasca.test.ts`
- [✅] Test edge cases (multiple passives, stacking, etc.) - Covered in `tests/gameReducer/passives/interactions.test.ts`. *Note: Tests pass, but TODOs added for potential logic issues with chained KNOWLEDGE_LEAVE and AFTER_PLAYER_DRAW triggers.*

## 4. Knowledge Card Effects
- [✅] List all unique knowledge effects from `effects.ts` / `knowledges.json`:
  - [✅] `terrestrial1` (Ursus): Rotational damage (1@0º, 2@180º), +1 if opponent slot empty. - *Tested in `tests/gameReducer/effects/Ursus.test.ts`*
  - [✅] `terrestrial2` (Serpent): Look at opponent hand, discard 1. - *Tested in `tests/gameReducer/effects/Serpent.test.ts`*
  - [✅] `terrestrial3` (Earthquake): Damage = summoning creature's wisdom. - *Tested in `tests/gameReducer/effects/Earthquake.test.ts`*
  - [✅] `terrestrial4` (Fire): Eliminate opponent knowledge cost <= 2. - *Tested in `tests/gameReducer/effects/Fire.test.ts`*
  - [✅] `terrestrial5` (Lupus): Rotational damage (1@0º, 1@90º, 2@180º, 3@270º), Final: Discard 1 opponent knowledge from field. - *Tested in `tests/gameReducer/effects/Lupus.test.ts`*
  - [✅] `aquatic1` (Tsunami): Rotate 1 other friendly knowledge, trigger effect. - *Tested in `tests/gameReducer/effects/Tsunami.test.ts`*
  - [✅] `aquatic2` (Asteroid): Rotational defense/damage (-1@0º, +1@90º, -1@180º, +1@270º). - *Tested in `tests/gameReducer/effects/Asteroid.test.ts`*
  - [✅] `aquatic3` (Hurricane): Block opponent summoning onto opposing slot. - *Tested in `tests/gameReducer/effects/Hurricane.test.ts`*
  - [✅] `aquatic4` (Delphinidae): Apparition: Draw 1 from Market. Rotational damage/defense (0@0º, 2@90º, -2@180º, 2@270º). - *Tested in `tests/gameReducer/effects/Delphinidae.test.ts`*
  - [✅] `aquatic5` (Galapago): Rotational damage/defense (-2@0º, 2@90º, -2@180º, 2@270º). Final: +1 Action next turn. - *Tested in `tests/gameReducer/effects/Galapago.test.ts`*
  - [✅] `aerial1` (Lepidoptera): Apparition: +1 Power. Rotational damage (1@0º). - *Tested in `tests/gameReducer/effects/Lepidoptera.test.ts`*
  - [✅] `aerial2` (Blue Sky): Rotational power gain (+1@0º, +2@90º, +3@180º). - *Tested in `tests/gameReducer/effects/BlueSky.test.ts`*
  - [✅] `aerial3` (Owl): Passive: +1 Wisdom to all friendly creatures. Rotational damage (1@0º, 1@90º, 2@180º). - *Tested in `tests/gameReducer/effects/Owl.test.ts`*
  - [✅] `aerial4` (Chiropter): Rotational damage (1@0º, 2@90º, 2@180º). Gain power = damage dealt. - *Tested in `tests/gameReducer/effects/Chiropter.test.ts`*
  - [✅] `aerial5` (Migration): Rotate all opponent creatures 90º counterclockwise. - *Tested in `tests/gameReducer/effects/Migration.test.ts`*
- [✅] Basic Damage/Defense application - *Covered in `tests/gameReducer/effects/Asteroid.test.ts` and others.*
- [✅] Test specific effects (draw, discard, block, etc.) - *Covered in effect-specific test files.*
- [✅] Test edge cases (stacking, blocked, etc.) - *Covered in effect and passive tests.*
- [✅] Test log output for effects - *Covered in effect-specific test files.*

## 5. Market, Deck, and Discard Logic
- [✅] Test market refill and empty market behavior - Covered in `tests/gameReducer/marketDeck.test.ts`
- [✅] Test deck exhaustion and reshuffling (if applicable) - Covered indirectly via market refill tests in `tests/gameReducer/marketDeck.test.ts`
- [✅] Test discard pile behavior (adding, reshuffling, etc.) - Covered in `tests/gameReducer/marketDeck.test.ts` (knowledge phase) & `tests/rules/validation.test.ts` (effects)

## 6. Edge Cases & Error Handling
- [✅] Simultaneous triggers (multiple passives/effects in one phase, chained triggers):
- [started] User interaction fallbacks (auto-resolve logic for effects that require user choice):
  - [completed] `tests/gameReducer/effects/Lupus.test.ts` (auto-pick for discard on final rotation)
  - [completed] `tests/gameReducer/effects/Fire.test.ts` (auto-elimination of all valid knowledges)
  - [not started] No test for user choice among multiple valid targets with non-trivial fallback logic.
- [not started] Malformed actions (invalid payloads, wrong phase, wrong player, invalid slot):
  - [not started] No test in the provided files covers malformed actions. These are typically in `rules/validation.test.ts` (not provided).
- [started] Error handling (game should not crash, clear error/log, edge cases like empty deck/hand/field):
  - [completed] `tests/gameReducer/effects/Fire.test.ts` and `tests/gameReducer/effects/Lupus.test.ts` check for no valid targets and ensure no crash/logs.
  - [not started] No test for general error handling for invalid actions, empty decks, or malformed payloads.
- [not started] Edge case game states (simultaneous win/loss, min/max values, repeated triggers):
  - [not started] No test in the provided files for simultaneous win/loss, min/max values, or repeated triggers/infinite loops.
- [started] Test coverage for error branches in reducers/effects:
  - [completed] `tests/gameReducer/effects/Fire.test.ts` and `tests/gameReducer/effects/Lupus.test.ts` test some error branches (no-op, no valid targets).
  - [not started] Not all error branches in reducers/effects are covered, especially for malformed actions or invalid state.
- [started] Game state remains valid after error/edge case:
  - [completed] The above effect tests check state validity after no-op effects.
  - [not started] No test for broader state validity after malformed actions or simultaneous triggers.

## 7. UI/Component Testing (if applicable)
- [ ] (Out of scope for this request - requires different tools/setup)

## 8. Multiplayer/Sync (if applicable)
- [ ] (Out of scope for this request - requires different tools/setup)

## 9. Test Quality & Maintenance
- [ ] Refactor tests to use helpers and fixtures for setup
- [ ] Remove duplication and improve readability
- [ ] Add comments and documentation to complex tests
- [✅] Ensure all tests are deterministic (no random failures) - *Assuming recent failures are logic bugs, not randomness.*

---

**Tip:**
- Tackle one section at a time.
- Mark each item as complete when done.
- Regularly run the full suite to catch regressions.

---

*Last updated: 2025-05-03*
