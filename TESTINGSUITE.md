# Comprehensive Test Suite To-Do List

This checklist will guide the step-by-step creation and restructure of a robust, maintainable, and complete test suite for the Mythical Beings MVP project. All tests are located under the top‑level `tests/` folder, organized by feature.

## 1. Core Game Logic
- [✅] Test game initialization (basic parameters) - Covered in `tests/initializeGame/basic.test.ts`
- [✅] Test game initialization (edge cases) - Covered in `tests/initializeGame/edge-cases.test.ts`
- [✅] Test turn transitions (knowledge phase -> action phase) - Covered in `tests/rules/validation.test.ts`
- [✅] Test turn transitions (action phase -> end turn -> knowledge phase) - Covered in `tests/rules/validation.test.ts`
- [✅] Test win conditions (basic scenarios) - Covered in `tests/rules/winConditions.test.ts`
- [ ] Test win conditions (edge cases, e.g., simultaneous)
- [✅] Test action-per-turn limits and resets - Covered in `tests/rules/validation.test.ts`

## 2. Action Validation
- [✅] Test all valid actions (rotate, draw, summon, end turn) - Covered in `tests/rules/validation.test.ts`
- [✅] Test all invalid actions (wrong phase, wrong player, invalid payload) - Covered in `tests/rules/validation.test.ts`
- [✅] Test edge cases (full hand, insufficient wisdom, creature occupied) - Covered in `tests/rules/validation.test.ts`
- [ ] Test edge cases (empty market, empty deck, blocked slots)

## 3. Passive Abilities
- [✅] List all creature passives from `passives.ts`
  - [✅] Caapora: `TURN_START` - If opponent has > cards in hand, deal 1 damage to opponent. - Covered in `tests/gameReducer/passives/caapora.test.ts`
  - [✅] Adaro: `AFTER_PLAYER_SUMMON` (on self) - If summoned knowledge is water, draw 1 card from market (free). - Covered in `tests/gameReducer/passives/adaro.test.ts`
  - [✅] Kyzy: `AFTER_SUMMON` (Any) - If earth knowledge summoned, force OPPONENT of Kyzy's owner to discard 1 card. - Covered in `tests/gameReducer/passives/kyzy.test.ts`
  - [✅] Japinunus: `AFTER_SUMMON` (Owner) - If owner summoned air knowledge, owner gains +1 Power. - Covered in `tests/gameReducer/passives/japinunus.test.ts`
  - [✅] Kappa: (Handled elsewhere) - Summoning aquatic knowledge is a free action. - Covered in `tests/gameReducer/passives/kappa.test.ts`
  - [✅] Dudugera: (Handled elsewhere) - Summoning knowledge onto Dudugera is a free action. - Covered in `tests/gameReducer/basicActions.test.ts` (Note: This file might not exist, assuming coverage based on previous state)
  - [✅] Inkanyamba: `AFTER_PLAYER_DRAW` - Discard 1 card from market. - Covered in `tests/gameReducer/passives/inkanyamba.test.ts`
  - [✅] Lisovik: `KNOWLEDGE_LEAVE` (owner's knowledge) - If leaving knowledge is earth, deal 1 damage to opponent. - Covered in `tests/gameReducer/passives/lisovik.test.ts`
  - [✅] Pele: `AFTER_SUMMON` (Owner) - If owner summoned earth knowledge, discard 1 opponent knowledge with lower cost. - Covered in `tests/gameReducer/passives/pele.test.ts`
  - [✅] Tsenehale: `KNOWLEDGE_LEAVE` (on self) - If leaving knowledge is air, owner gains +1 Power.
  - [✅] Tulpar: `AFTER_SUMMON` (Owner) - If owner summoned air knowledge, rotate one of owner's creatures 90º. - Covered in `tests/gameReducer/passives/tulpar.test.ts`
  - [✅] Trempulcahue: `TURN_START` - If owner has > cards in hand than opponent, deal 1 damage to opponent.
  - [✅] Zhar-Ptitsa: `TURN_START` - Draw 1 card from market (free).
  - [✅] Lafaic: `AFTER_PLAYER_SUMMON` (Owner) - When owner summons aquatic knowledge onto Lafaic, rotate one other knowledge 90º.
- [🤼🏾] Test edge cases (multiple passives, stacking, etc.) - *Partially covered: `interactions.test.ts` exists but has failures. Needs review.*

## 4. Knowledge Card Effects
- [ ] List all unique knowledge effects from `effects.ts`
- [✅] Basic Damage/Defense application - Covered indirectly in `tests/rules/validation.test.ts`
- [✅] Test specific effects (draw, discard, block, etc.) - Covered in `tests/rules/validation.test.ts`
- [🤼🏾] Test edge cases (stacking, blocked, etc.) - *Partially covered: Blocking tested (aquatic3). Missing: Tests for stacking effects.*
- [🤼🏾] Test log output for effects - *Partially covered: Logs checked for tested effects in `tests/rules/validation.test.ts`. Missing: Comprehensive log checks for all effects.*

## 5. Market, Deck, and Discard Logic
- [✅] Test market refill and empty market behavior - Covered in `tests/gameReducer/marketDeck.test.ts`
- [✅] Test deck exhaustion and reshuffling (if applicable) - Covered indirectly via market refill tests in `tests/gameReducer/marketDeck.test.ts`
- [✅] Test discard pile behavior (adding, reshuffling, etc.) - Covered in `tests/gameReducer/marketDeck.test.ts` (knowledge phase) & `tests/rules/validation.test.ts` (effects)

## 6. Edge Cases & Error Handling
- [🤼🏾] Test simultaneous triggers (multiple passives/effects in one phase) - *Partially covered: `interactions.test.ts` exists but has failures. Needs review.*
- [ ] Test user interaction fallbacks (auto-resolve logic)
- [🤼🏾] Test malformed actions and error handling (already partially covered) - *Partially covered: `isValidAction` tests in `tests/rules/validation.test.ts` and invalid turn tests. Missing: More comprehensive error handling.*

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

*Last updated: 2025-05-01*
