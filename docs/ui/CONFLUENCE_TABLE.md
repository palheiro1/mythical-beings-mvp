# The Confluence Table

## Art direction

A newly imagined meeting place for the world's mythical beings: an astronomical
slate table with aged brass inlay and four elemental corners. This name and
setting are an original visual proposal for Wisdom Duel, not a claim about
established Mythical Beings canon.

The existing illustrations and digital card faces remain the focal point. The
surroundings suggest shared knowledge and natural forces: water channels, roots,
wind-carved stone and a warm ember. Circular instrument engravings echo the
game's quarter-turn wisdom and knowledge cycles. There are no new game resources,
lanes, rule symbols or interactive environmental objects.

## Research and references

- [Mythical Beings](https://mythicalbeings.io/) presents creatures from five
  continents. The setting therefore avoids identifying the whole game with one
  particular historical culture.
- [The official physical board game](https://mythicalbeings.io/board-game.html)
  connects creature wisdom, summoning and quarter-turn card effects. The digital
  engine and current card catalogue remain authoritative for this implementation;
  the physical game's older terminology and rules are not imported into the UI.
- [Hearthstone: Art with Ben Thompson](https://hearthstone.blizzard.com/en-us/news/13023802/hearthside-chat-art-with-ben-thompson-2-25-2014)
  discusses physical materiality and keeping art, titles and numeric values clear.
  That informed the restrained furniture around the existing cards.
- [MTG Arena: Making Battlefields](https://magic.wizards.com/en/news/mtg-arena/making-the-april-fools-battlefield-and-other-battlefields)
  describes starting from a world's visual guide and reviewing effects for
  distraction. That informed the original setting and a static, quiet play surface.
- The user's three screenshots informed the physical rim, recessed card spaces
  and coherent materials. No artwork, frame or layout was copied from those games.

## The playable composition

- One illustrated table connects the field, hand, market and action controls.
- Six stone-and-brass bases group each being with its knowledge. Small elemental
  seals repeat the game's existing icon vocabulary. The gold target highlight
  retains its existing meaning.
- On wide desktop screens, the being and knowledge share a horizontal base. Card
  size adapts to the available field height, keeping the action controls visible.
- Hand and market have recessed folio frames with their existing names and counts.
- Power sits in inset medallions; the active player's plaque is more prominent.
- Phone landscape retains its three lanes, direct card controls, hand/market tabs
  and square artwork. Ornament does not consume the card area or intercept input.
- Background, seals and framing are static. Existing card movement, damage,
  shielding, reduced-motion support and screen-reader announcements are preserved.

## Assets and generation

Created with the built-in `image_gen` tool. Existing card illustrations by Ana
Santiso have not been regenerated or modified. The generated table was encoded
as WebP; the phone version was proportionally downscaled.

- `public/images/arena/confluence-table-v1.webp`: 1672×941, approximately 128 KiB.
- `public/images/arena/confluence-table-mobile-v1.webp`: 1024×576, approximately 57 KiB.
- Styles load with the match route in `src/trainingArena.css`.

### Final generation prompt

> Use case: stylized-concept. Asset type: final production background art for the playable Wisdom Duel card-game table, NOT a screenshot or mockup. Create a single landscape image, 2048 by 1152. Art direction: 'The Confluence Table', an ancient scholar's astronomical table where mythic beings from many cultures meet to wield elemental knowledge. Top-down orthographic view, symmetrical broad rectangular tabletop with gracefully chamfered corners, filling the image. The broad central 75% must be a calm uninterrupted dark blue-green slate playing surface, medium-low contrast, subtly worn and softly illuminated, with a barely-visible huge circular astrolabe and four faint arcs engraved in the stone. The center must remain largely plain and uniformly readable behind live card UI. Tactile hand-painted fantasy game environment, sophisticated carved mineral and patinated bronze craftsmanship, soft believable beveled depth, no photorealism and no generic neon tech. Concentrate rich detail at the OUTERMOST edges and four corners: upper left has a shallow turquoise water channel with carved wave relief; upper right has pearly wind whorls engraved into pale stone and a small moonstone; lower left has a few old roots, moss and carved leaves joining the stone; lower right has an amber ember stone set in warm copper, softly glowing, no lava. Fine aged brass inlay ties all four corners together like an instrument for studying nature. Thin restrained golden geometric border, deep navy shadows beyond the table, a little verdigris. Warm gold against desaturated teal stone; colors harmonize with vivid illustrated creature cards that will later be placed on top. Corners should occupy no more than 12 percent of image each; nothing intrudes into playable center. Keep rim narrow and not massive. Existing Wisdom Duel identity uses navy, antique gold, cyan crystal, astronomical symbols. The game uses real folklore creatures, wisdom gained through quarter-turn cycles, and water/earth/air/fire elements. This is a newly invented visual setting, not an imitation of another game's board. No text, letters, numbers, logos, user interface, card slots, cards, characters, weapons, hero portraits, candles, UI buttons, large central jewel, game tokens or watermark. The output must be just the clean reusable artwork.

## Verification

Browser checks include both sparse and full fields (six attached knowledges and
five hand cards), desktop at 1440×900 and 1280×720, landscape phones at 844×390,
667×375 and 568×320, tablet portrait and the optional phone portrait layout.
Checks cover card bounds, page width, control visibility, scrolling trays and
console errors. Existing tutorial, animation lifecycle, game and coverage tests,
build, lint and public-artifact checks remain the release gates.
