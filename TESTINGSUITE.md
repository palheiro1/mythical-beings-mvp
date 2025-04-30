# Comprehensive Test Suite To-Do List

This checklist will guide the step-by-step creation and restructure of a robust, maintainable, and complete test suite for the Mythical Beings MVP project. All tests are located under the top‑level `tests/` folder, organized by feature.

## 1. Core Game Logic
- [✅] Test game initialization (basic parameters) - Covered in `tests/state.test.ts`
- [ ] Test game initialization (edge cases)
- [✅] Test turn transitions (knowledge phase -> action phase) - Covered in `tests/rules.ts`
- [✅] Test turn transitions (action phase -> end turn -> knowledge phase)
- [✅] Test win conditions (basic scenarios) - Covered in `tests/rules.ts`
- [ ] Test win conditions (edge cases, e.g., simultaneous)
- [✅] Test action-per-turn limits and resets - Covered in `tests/rules.ts`

## 2. Action Validation
- [✅] Test all valid actions (rotate, draw, summon, end turn) - Covered in `tests/rules.ts`
- [✅] Test all invalid actions (wrong phase, wrong player, invalid payload) - Covered in `tests/rules.ts`
- [✅] Test edge cases (full hand, insufficient wisdom, creature occupied) - Covered in `tests/rules.ts`
- [ ] Test edge cases (empty market, empty deck, blocked slots)

## 3. Passive Abilities
- [ ] List all creature passives from `passives.ts`
  - [✅] Caapora: `TURN_START` - If opponent has > cards in hand, deal 1 damage to opponent.
  - [✅] Adaro: `AFTER_PLAYER_SUMMON` (on self) - If summoned knowledge is water, draw 1 card from market (free).
  - [✅] Kyzy: `AFTER_SUMMON` (Any) - If earth knowledge summoned, force OPPONENT of Kyzy's owner to discard 1 card.
  - [✅] Japinunus: `AFTER_SUMMON` (Owner) - If owner summoned air knowledge, owner gains +1 Power.
  - [✅] Kappa: (Handled elsewhere) - Summoning aquatic knowledge is a free action. - Covered in `tests/gameReducer/passives/kappa.test.ts`
  - [✅] Dudugera: (Handled elsewhere) - Summoning knowledge onto Dudugera is a free action. - Covered in `tests/gameReducer/basicActions.test.ts`
  - [✅] Inkanyamba: `AFTER_PLAYER_DRAW` - Discard 1 card from market.
  - [✅] Lisovik: `KNOWLEDGE_LEAVE` (owner's knowledge) - If leaving knowledge is earth, deal 1 damage to opponent.
  - [✅] Pele: `AFTER_PLAYER_SUMMON` or `AFTER_OPPONENT_SUMMON` - If owner summoned earth knowledge, discard 1 opponent knowledge with lower cost.
  - [ ] Tsenehale: `KNOWLEDGE_LEAVE` (on self) - If leaving knowledge is air, owner gains +1 Power.
  - [ ] Tulpar: `AFTER_PLAYER_SUMMON` or `AFTER_OPPONENT_SUMMON` - If owner summoned air knowledge, rotate one of owner's creatures 90º.
  - [ ] Trepulcahue: `TURN_START` - If owner has > cards in hand than opponent, deal 1 damage to opponent.
  - [ ] Zhar-Ptitsa: `TURN_START` - Draw 1 card from market (free).
- [✅] Dudugera: Test trigger conditions (summon) - Covered in `tests/state.test.ts`
- [✅] Dudugera: Test effect on game state (wisdom gain) - Covered in `tests/state.test.ts`
- [✅] Dudugera: Test log output - Covered in `tests/state.test.ts`
- [🤼🏾] Test other passives (Adaro, Pele, Kyzy, etc.) - *Partially covered: Creatures are used in setup, but specific passive logic isn't explicitly tested.*
- [🤼🏾] Test edge cases (multiple passives, stacking, etc.) - *Partially covered: Basic interactions exist, but complex stacking/simultaneous triggers are not tested.*

## 4. Knowledge Card Effects
- [ ] List all unique knowledge effects from `effects.ts`
- [✅] Basic Damage/Defense application - Covered indirectly in `tests/rules.test.ts`
- [✅] Test specific effects (draw, discard, block, etc.) - Covered in `tests/rules.test.ts`
- [🤼🏾] Test edge cases (stacking, blocked, etc.) - *Partially covered: Blocking tested (aquatic3). Missing: Tests for stacking effects.*
- [🤼🏾] Test log output for effects - *Partially covered: Logs checked for tested effects in `tests/rules.test.ts`. Missing: Comprehensive log checks for all effects.*

## 5. Market, Deck, and Discard Logic
- [✅] Test market refill and empty market behavior - Covered in `tests/state.test.ts`
- [✅] Test deck exhaustion and reshuffling (if applicable) - Covered indirectly via market refill tests in `tests/state.test.ts`
- [✅] Test discard pile behavior (adding, reshuffling, etc.) - Covered in `tests/state.test.ts` (knowledge phase) & `tests/rules.test.ts` (effects)

## 6. Edge Cases & Error Handling
- [ ] Test simultaneous triggers (multiple passives/effects in one phase)
- [ ] Test user interaction fallbacks (auto-resolve logic)
- [🤼🏾] Test malformed actions and error handling (already partially covered) - *Partially covered: `isValidAction` tests in `tests/rules.test.ts` and invalid turn tests in `tests/state.test.ts`. Missing: More comprehensive error handling.*

## 7. UI/Component Testing (if applicable)
- [ ] (Out of scope for this request - requires different tools/setup)

## 8. Multiplayer/Sync (if applicable)
- [ ] (Out of scope for this request - requires different tools/setup)

## 9. Test Quality & Maintenance
- [ ] Refactor tests to use helpers and fixtures for setup
- [ ] Remove duplication and improve readability
- [ ] Add comments and documentation to complex tests
- [✅] Ensure all tests are deterministic (no random failures)

---

**Tip:**
- Tackle one section at a time.
- Mark each item as complete when done.
- Regularly run the full suite to catch regressions.

---

*Last updated: 2025-04-25*
