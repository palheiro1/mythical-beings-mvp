# Refactoring Knowledge Card Effects (May 2025)

**Goal:** Move rotational damage/defense values from hardcoded logic in `effects.ts` to a new data property in `knowledges.json` and update the effect functions to use this data.

**Proposed Data Format:** Add an optional `valueCycle: number[]` property to knowledge card objects in `knowledges.json`.
*   The array index corresponds to the rotation step (0 = 0º, 1 = 90º, 2 = 180º, 3 = 270º).
*   Positive values represent **damage** dealt to the opponent.
*   Negative values represent **defense** points gained (relevant primarily for `calculateDamage` logic, though `aquatic2` is special).
*   `0` represents no damage/defense effect at that rotation.
*   The array length should ideally match the card's `maxRotations`.
*   Effects like pure power gain (`aerial2`) or non-value-based actions won't use this cycle directly.

---

**Refactoring TODO List:**

1.  **[✅] Update Type Definition (`src/game/types.ts`):**
    *   Locate the `Knowledge` interface.
    *   Add the new optional property: `valueCycle?: number[];`

2.  **[✅] Populate Data (`src/assets/knowledges.json`):**
    *   Carefully edit this file.
    *   For *each* knowledge card object that has rotational damage or defense values based on the provided list:
        *   Add the `valueCycle` property.
        *   Populate the array with the correct numbers, using positive for damage and negative for defense. Ensure the order matches the rotations (0º, 90º, 180º, 270º).
        *   Use `0` for rotations where no damage/defense occurs.
        *   Ensure array length is appropriate (e.g., if `maxRotations` is 3, the array might have 3 values for 0º, 90º, 180º).
    *   **Example (`terrestrial1` - Ursus):**
        ```json
        {
          "id": "terrestrial1",
          // ... other properties ...
          "maxRotations": 3,
          "valueCycle": [1, 0, 2] // Corresponds to +1 dmg @ 0º, 0 @ 90º, +2 dmg @ 180º
        },
        ```
    *   **Example (`aquatic2` - Asteroid):**
        ```json
        {
          "id": "aquatic2",
          // ... other properties ...
          "maxRotations": 4,
          "valueCycle": [-1, 1, -1, 1] // Corresponds to -1 def @ 0º, +1 dmg @ 90º, -1 def @ 180º, +1 dmg @ 270º (Note: The defense part is handled specially in calculateDamage)
        },
        ```
    *   **Example (`aerial2` - Blue Sky):** (No `valueCycle` as it's power gain, not damage/defense)
        ```json
        {
          "id": "aerial2",
          // ... other properties ...
          "maxRotations": 3
          // No valueCycle needed here
        },
        ```
    *   Double-check all entries against the provided data and the card's `maxRotations`.

3.  **[✅] Refactor Effect Logic (`src/game/effects.ts`):**
    *   Go through each function within the `knowledgeEffects` object.
    *   **Identify Functions to Change:** Focus on functions currently using `if/else` or ternary operators based on the `rotation` parameter to determine a base damage value (e.g., `terrestrial1`, `aerial4`, potentially others that should have cycles like `aerial1`, `aerial3`, `aquatic2`, `aquatic4`, `aquatic5`, `terrestrial2`, `terrestrial5`).
    *   **Modify Logic:**
        *   Inside the function, calculate the cycle index: `const cycleIndex = rotation / 90;`
        *   Safely access the value from the cycle: `const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;`
        *   Check if the `baseValue` represents damage (positive): `if (baseValue > 0) { ... }`
        *   Use this `baseValue` as the `damageAmount` passed to `calculateDamage` or used in direct damage application.
        *   Remove the old hardcoded `if/else` blocks that determined damage based on rotation.
        *   **Keep** other specific logic (e.g., `terrestrial1`'s bonus damage check, `terrestrial4`'s cost check, `terrestrial5`'s discard logic, `aquatic3`'s block logic, etc.).
        *   **Special Cases:**
            *   `aerial2`: Keep its existing power gain logic based on rotation, as `valueCycle` is for damage/defense.
            *   `aquatic2`: The effect function itself likely remains empty. The `calculateDamage` function already handles its specific defense condition. The `valueCycle` data might be used if `aquatic2` *also* deals damage at certain rotations (like the data `[-1, 1, -1, 1]` suggests). If it deals damage, the `aquatic2` effect function *would* need logic to read `valueCycle` and call `calculateDamage` if `baseValue > 0`.
            *   Effects with "Apparition" or "Final": Ensure the core logic is still wrapped in the appropriate checks (`if (!isFinalRotation)` or `if (isFinalRotation)` where applicable, or confirm this is handled by the reducer/passive system). `terrestrial5` needs the `if (isFinalRotation)` check added around its discard logic.
    *   **Review `calculateDamage`:** Ensure it correctly uses the incoming `damageAmount` and handles defense calculations (including the specific `aquatic2` check) without assuming anything about rotational cycles itself.

4.  **Update & Add Unit Tests (`tests/gameReducer/effects/`):**
    *   **Review `Ursus.test.ts`:** Verify it still passes after the `terrestrial1` refactor.
    *   **Create New Test Files:** For *every other* knowledge card ID that has an entry in the `knowledgeEffects` object (e.g., `aerial1.test.ts`, `aerial2.test.ts`, ..., `terrestrial5.test.ts`).
    *   **Write Tests:** In each new file, add tests to:
        *   Verify the correct damage/defense/power gain/effect occurs at *each relevant rotation*, using the values now defined in `knowledges.json` (via `valueCycle`) or the hardcoded logic (for power gain/special actions).
        *   Test edge cases (e.g., opponent slot empty/full for `terrestrial1`, no cards to discard for `terrestrial2`, market empty for `aquatic4`).
        *   Verify "Apparition" effects trigger correctly (likely on initial summon state).
        *   Verify "Final" effects trigger only when `isFinalRotation` is true (`terrestrial5`, `aquatic5`).
        *   Assert correct changes in game state (player power, hand size, field state, blocked slots, extra actions).
        *   Assert correct log messages are generated.

5.  **Run Full Test Suite:**
    *   Execute `npm test` (or your test command) to ensure the refactoring hasn't broken any existing tests (passives, validation, win conditions, etc.). Fix any regressions.

6.  **Documentation (Optional):**
    *   Update `TESTINGSUITE.md` to accurately reflect the improved test coverage for effects.
    *   Add comments in `src/game/types.ts` explaining the `valueCycle` property (index = rotation/90, positive=damage, negative=defense).

---