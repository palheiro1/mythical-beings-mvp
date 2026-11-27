# Sound of the Confluence — playable audition

An epic, dramatic first audio pass for the solo training table. This is a playable
audition, not a complete adaptive soundtrack or a voiced creature catalogue.
The current match and guided lesson remain unchanged.

## Musical direction and provenance

The original instrumental was generated for this project through Magnific using
Google Lyria 3 Pro on 2026-09-18. A 90-second brief produced an 88-second stereo
cue: low strings, warm horns, deep percussion, a rising melodic motif and organic
bronze/glass accents. No existing game's recordings or music were imported.

Creation reference: `s7ZmvX1l8e`. The unmodified generated master is retained at
`/tmp/wisdom-duel-audio/confluence-original.mp3` for this audition's review.
The app asset is `public/audio/confluence-duel-v1.mp3`, 128 kbps stereo MP3,
approximately 1.34 MiB. Encoding removes external metadata, lowers gain by 9.2 dB,
and gives the loop a gentle 0.6-second entrance / 2-second exit. The cue has its
own composed rise and resolution; it does not switch orchestral stems based on
game state. Music/effects mixing does respond to actual impacts.

Generation prompt:

> Original instrumental score for Wisdom Duel, a strategic card game played on an ancient slate and bronze astronomical table where mythical creatures and elemental knowledge meet. Epic and dramatic, dignified, mysterious, emotionally stirring. 84 BPM, D minor, cinematic low strings and warm horns, a memorable rising four-note motif, restrained deep frame drums and timpani, shimmering bronze and glass accents, subtle breathy woodwinds. 0–15s sparse anticipation, 15–55s steady purposeful strategy pulse, 55–80s rising layered strings and stronger percussion for a decisive duel, 80–90s gentle resolution into a sustained D minor ambience suitable for a soft loop. Leave space between phrases for card and combat sound effects; powerful but not aggressively loud, no jarring hits or abrupt pauses. Elegant fantasy orchestration with organic textures, detailed natural reverberation. No vocals, no speech, no lyrics, no imitation of any existing game soundtrack or artist. A finished stereo game music cue.

## Effects and synchronization

- Original Web Audio synthesis combines filtered noise, resonant partials and
  pitch envelopes; no downloaded effects, external runtime service or audio SDK.
- Card draw/deal/discard use material swishes; a played card lands with a solid
  contact and elemental resonance. Rotation uses a brief bronze-like detent.
- Attack prepares the impact. Defense sounds at the shield; partial damage sounds
  only after the continuing strike reaches Power. Full blocks never play damage.
- Healing ascends; water/earth/air/fire effects use different textures. Turn change,
  victory and defeat have short musical signals. This version identifies elemental
  families, not an individual recorded sound for every creature.
- Sounds follow the existing animation queue, not logs or click guesses. Reduced
  motion retains audio; unavailable visual anchors use semantic fallback cues.
- Music drops to 48% of its selected level around major effects. Simultaneous
  repetitive cues share a beat; a master compressor limits combined peaks.

## Player controls and lifecycle

The scorebar offers immediate enable/mute and a settings panel with separate music
and effects levels plus eight audition buttons. The default is off; suggested
levels are music 38% / effects 70%. Preferences are validated and kept locally in
`wisdom-duel.audio.v1`. After a reload, remembered sound waits for a player gesture.
No music request or AudioContext is created before activation. Music at zero does
not load the track; effects at zero do not synthesize voices.

Hidden tabs and the phone orientation pause silence audio. Returning resumes the
track where the browser permits it; a subsequent gesture also unlocks playback.
Navigation/replay releases the player and context. Muting and cancelled visual
batches stop active and scheduled effects. Playback failures are caught and cannot
block game rules, clocks or choices. Sound is supplementary to the existing visual
and screen-reader feedback. The settings dialog shares the existing match dialog
coordination; its keyboard focus trap includes sliders.

## Validation and review

- Existing full suite plus audio lifecycle, preferences, controls and timing tests.
- Browser tutorial with enabled audio, mobile controls, mute, background/resume,
  independent sliders and navigation cleanup; check browser console errors.
- Offline Web Audio rendering checks every cue for nonzero output and clipping.
  A separate 88-second audition combines the actual music and renderer at the
  default relative levels, normalized for listening; it is not an extra web asset.
- Build, lint, bundle size, public-artifact and production-log checks remain gates.

Design references: [Hearthstone audio team](https://hearthstone.blizzard.com/en-us/news/23964694)
on rhythmic synchronization and choosing which sounds take priority;
[MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
for gesture-gated playback and rejected play requests.
