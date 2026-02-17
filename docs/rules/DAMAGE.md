# Centralize Damage/Defense Implementation Tasks

- [x] Adjust effect signatures & imports
    - [ ] Verify each `KnowledgeEffectFn` signature includes `buffers: CombatBuffers`.
    - [ ] Import `CombatBuffers` in `effects.ts` and disable or remove unused‑var linting as needed.

- [x] Refactor all knowledge effects
    - [ ] Remove direct `state.players[*].power` mutations in `effects.ts` (except intentional self‑buffs).
    - [ ] Push damage into `buffers.damage[index]` and defense into `buffers.defense[index]`.

- [x] Update tests for Knowledge Phase
     - [x] Modify `rules.test.ts` to expect power changes after the central resolution step.
    - [x] Add a test case where multiple effects accumulate damage and defense correctly and net damage is applied.

- [ ] Integrate defense passives (e.g., Trepulcahue)
    - [ ] In `passives.ts`, on the `DAMAGE_CALCULATION` trigger, increment `buffers.defense[playerIndex]` for applicable passives.

- [ ] Clean up and validate end‑to‑end
    - [ ] Run the full test suite and fix any signature or logic errors.
    - [ ] Perform a manual playthrough to verify:
        - Effects → buffer collection
        - Combat resolution (damage minus defense)
        - Power updates and logs
        - Rotation/discard and passive triggers

Once complete, your Knowledges Phase pipeline will be:

1. Execute each effect → collect into `buffers`  
2. Resolve all buffers → apply net Power changes + log  
3. Rotate/discard cards → trigger `KNOWLEDGE_LEAVE` passives