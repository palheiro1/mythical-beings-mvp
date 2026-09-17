# Digital card series

The approved Kappa / Asteroid direction is applied to all 15 Beings and 15
Knowledges. `DigitalCardFace` owns the shared frame in selection, the board,
market, hand, inspection, target choices and card motion. It has a compact face
for play and a detailed face for reading rules.

The compact-only stylesheet is imported by `TrainingCard`, `Card` and
`CardFaceByImage`, so those rules load with the play/selection routes. Tailwind
scans application sources, excluding bundled analytics vendors, rather than
turning examples in tests and documentation into production utilities. The
existing initial CSS budget is preserved.

- Original illustrations remain in their existing assets; CSS clips the printed
  frame and puts editable, selectable text above clean digital panels.
- Water, earth, air and fire use distinct accent colours and element icons.
- The gold badge shows effective Wisdom for a Being and summoning cost for a
  Knowledge. The separate Knowledge effect and rotation track never replace cost.
- Cards stay upright, including the opponent's cards. Rotation is communicated
  by the active cycle step. Knowledge cards identify their final rotation.
- Effective Wisdom includes active bonuses. Effect choices resolve the actual
  game instance instead of showing catalog values.
- Hidden cards keep their existing concealed back. Inspection retains its focus
  trap, Escape dismissal and focus restoration.
- Narrow board cards emphasize the numeric value and effect; the full rules and
  rotation cycle are available through inspection.

## Artwork provenance

Existing illustrations are by Ana Santiso. Lafaic previously had a temporary SVG
placeholder. Its original artwork was recovered from the official Mythical Beings
collection, confirmed against `monsters.json` in the wallet repository:
<https://media.mythicalbeings.io/sm/mythical15.jpg>.

The source was only resized and encoded as WebP (720 px and 360 px). The UI clips
its printed title/lore; the illustration was not regenerated. All other source
image files remain unchanged.

## Verification

The series was visually checked as two contact sheets. Browser verification
covers selection, inspection, drawing, rotation, summoning, target resolution,
turn completion and free practice at 1440, 768, 390 and 360 px. The automated
tests cover all 30 faces, cost versus effect, live Wisdom, special effect cycles,
target instance values and concealed cards. Existing game and tutorial tests,
critical coverage, lint, type checks and production artifact checks also apply.

The release is based on the live `upgrade/wisdom-duel-complete-20260830` branch.
It changes presentation and artwork only; existing production service settings
and gameplay rules are preserved.
