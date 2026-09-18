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
- The gold value shows effective Wisdom for a Being and summoning cost for a
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

The Lafaic source was only resized and encoded as WebP (720 px and 360 px). The UI
clips its printed title/lore; the illustration was not regenerated.

The other 29 illustrations originate in CMYK JPEGs with a Coated FOGRA39 print
profile. Their WebP derivatives are converted through that profile to sRGB,
then resized and encoded with an embedded sRGB profile. The originals are
preserved in Git at `d143d3b6e08128ba89e1b01c9f0402bbf3956edb`.
`python3 scripts/prepare-card-colours.py` rebuilds both responsive sizes using
Pillow with ImageCms/LittleCMS and records conversion checks under `artifacts/`.
No print JPEGs or print profiles are added to the public build.

Artwork uses normal compositing and no saturation or contrast filters. Element
colours belong to the frame and panels. `cardAssets.ts` versions both image
candidates so returning players receive corrected colours despite cached images.

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

## Mobile play composition

`PlayCardFace` is the phone and short-landscape face used by direct card controls.
The original illustration has a square viewport; its value strip and rotation
track sit below it. A Being shows effective Wisdom once. A Knowledge shows cost
and its current effect as separate values. Neither statistics nor controls cover
its art. The card name appears once, below the frame, and is the inspection
control when tapping the artwork performs a move.

All board cards use the same size, whether a Knowledge is attached or the slot is
empty. Hand and market cards are approximately 25% wider. The detailed inspection
is preserved. Pending-effect choices use the mobile face too.
Replacement hints fit in the name row without covering values or adding height.

Visual review uses both the reported sparse board and a full board with six
attached Knowledges and five hand cards. Checks cover 793×380, 844×390, 667×375,
568×320, 390×844 and 360×800, including square artwork, unclipped numeric values,
separate inspection targets of at least 24×24 px and no horizontal page overflow.
The complete touch tutorial and return to the desktop layout are also checked.

## Desktop play composition

Compact cards reserve separate rows for the name, illustration and statistics.
Being Wisdom appears once in the lower frame, beside the element icon. Knowledge
cost and current effect occupy opposite ends of that row; its element sits in
the title row. No numeric badge or element symbol covers the illustration.
Board captions retain the creature name without repeating Wisdom, and market
metadata retains the element without repeating cost.

Small cards use thinner title and statistic rows to preserve more artwork.
Market miniatures hide the title already shown beside them and keep cost,
effect and rotation visible. The final-rotation marker remains on larger faces;
miniatures use the highlighted final track segment and accessible rotation label.
The compact grid constrains long titles to the card width.

Browser checks cover every card at 44, 74, 96, 154 and 200 px through all four
rotation inputs, with no statistics over the artwork or outside the frame.
Selection and the complete desktop lesson are checked at 884×891, 875×913,
1399×884 and 1366×768. Mobile play and detailed inspection remain verified.
