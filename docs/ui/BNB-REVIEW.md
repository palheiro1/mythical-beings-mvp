# Wisdom Duel — UI review

This revision prepares the existing solo card game for product review. It does not deploy BSC contracts, change game balance, enable PvP, or imply a BNB partnership.

## Review journey

1. Open the homepage and choose **Learn to Play**.
2. Inspect the recommended creatures and start the lesson.
3. Draw Lepidoptera, rotate Tarasca, and watch the bot's turn.
4. Select Lepidoptera and play it on Tarasca. Resolve Tulpar's optional free rotation. The wording of Tulpar's ability now matches the existing team-wide trigger; its implementation is unchanged.
5. End the turn and choose **Continue Practice**. The current board is preserved and a full 30-second turn starts when the player can act.
6. Finish the match, review the board/history, replay with the same team, or choose a new one.

**Practice** goes straight to a random five-creature hand; select three. Both routes are public and require no account, wallet, token, or network transaction. The lesson's prepared opening is disclosed; later moves and the outcome use the same engine as free practice.

## Implementation boundaries

Phone matches now ask the player to rotate to landscape. The board pairs each creature with its knowledge in three complete lanes on the left; the hand/market tabs remain visible on the right, with the turn controls below. A portrait fallback remains available for players who cannot rotate. While the rotation prompt is shown, both the bot and the clock pause; rotating back preserves the remaining seconds, selected card, tutorial step and pending effects. This is an in-game prompt, not a browser orientation lock. The compact styles load with the match route, preserving the initial CSS budget.

- Based on published commit `f175e6f6b9c664d8f066a1b69599c3e6528e7026`, isolated in `codex/wisdom-bnb-ui-20260917`.
- The shared competitive board and game rules are unchanged. The new practice controller validates every move with `isValidAction` and delegates to `gameReducer`.
- The solo bot retains its rotate → first affordable play or draw → end policy. Its scheduled actions are cancelled on unmount and a new match creates a fresh controller.
- Card inspection is separate from gameplay. Invalid plays preserve selection. Replacing an occupied slot identifies the outgoing card.
- A versioned local flag records whether the lesson was completed or skipped; the current match is not advertised as saved across refreshes. A direct free-practice URL without a valid team returns to team selection.
- Existing analytics event names and privacy controls are retained. Local review builds disable external product telemetry to avoid counting QA as traction. Rebuild with the existing production environment for a future release; do not promote the local review configuration blindly.
- No dependency, database or API migration is needed. Existing responsive WebP assets are reused.

## Validation

Run the repository's existing checks:

```sh
npm run lint:ci
npm run typecheck
npm run typecheck:edge
npm run test:coverage
npm run build
npm run verify:bundle-budget
npm run verify:public-artifact
npm run verify:production-logging
npm audit --omit=dev --audit-level=high
```

New tests exercise the prepared deal's card conservation, accepted-action progression, Tulpar's actual pending effect, invalid action recovery, occupied-slot replacement, Hurricane validation, skipping the lesson, clock resumption and expiry, inspection/Escape/focus restoration, match result/replay, navigation recovery and explicit release flags.

Browser review includes 1280×720, 1440×900, 390×844, 360×800, 768×1024 and 844×390. The 640×360 viewport checks the reflow equivalent of a 1280×720 viewport at 200% zoom. This is not a claim of testing every assistive technology or a physical phone.

A complete real browser match reached a natural result on turn 22. The reviewer deliberately passed turns after completing the lesson; this verifies match progression and result handling, not player engagement or game balance.

## Remaining acceptance gate

The team still needs five people who have not played Wisdom Duel. At least four should complete the lesson and perform their first free-practice turn without verbal instructions. Use the accompanying test protocol; no participant results have been invented. Production publication follows review of the preview.
