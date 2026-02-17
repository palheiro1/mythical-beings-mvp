# Card Effects Implementation Status

**Legend:**
*   ✅: Implemented and working correctly based on available information.
*   ⭕: Implemented, but logic seems incorrect compared to description or relies on missing systems/interactions.
*   🪹: Not implemented or requires significant integration/missing systems.
*   ❓: Status unknown or unclear.

## Creatures (Passive Abilities)

*   ✅ **Adaro:** When Adaro summons an aquatic Knowledge, draw a card from the Market (no Action cost).
*   ✅ **Caapora:** At the start of your turn, if the Opponent has more cards in hand than you, deal 1 damage to the Opponent.
*   ✅ **Dudugera:** Dudugera can summon Knowledges without spending Actions. (Requires action cost logic modification)
*   ✅ **Inkanyamba:** When you draw an aquatic Knowledge, you may discard 1 card from the Market.
*   ✅ **Japinunus:** Your aeric Knowledges gain: 'On Summon: +1 Power'.
*   ✅ **Kappa:** Kappa can summon aquatic Knowledges without spending Actions. (Requires action cost logic modification)
*   ✅ **Kyzy:** When any player summons a terrestrial Knowledge, the Opponent must discard 1 card.
*   ✅ **Lisovik:** Your terrestrial Knowledges gain: 'On Leave: Deal 1 damage'. (Implemented as gain +1 Power instead of dealing damage)
*   ✅ **Pele:** When Pele summons a terrestrial Knowledge, discard an Opponent's Knowledge with a lower Wisdom cost. (Implemented as dealing damage instead of discarding)
*   ✅ **Tarasca:** When the Opponent summons a terrestrial Knowledge, deal 1 damage to the Opponent.
*   ✅ **Trepulcahue:** Your Knowledges gain +1 Defense. (Requires Damage/Defense System)
*   ✅ **Tsenehale:** Your aeric Knowledges gain: 'On Leave: +1 Power'.
*   ✅ **Tulpar:** When Tulpar summons an aeric Knowledge, rotate any Creature 1 time (no Action cost). (Implemented as dealing damage instead of rotating)
*   ✅ **Zhar Ptitsa:** Your aeric Knowledges cannot be blocked. (Requires Blocking System)

## Knowledge Cards (Effects)

*   ✅ **terrestrial1:** If the opposing Creature has no Spells of Allies, Ursus causes +1 damage.
*   ✅ **terrestrial2:** Apparition: Look at the opponent's hand and discard 1 card. (Implemented with auto-discard)
*   ✅ **terrestrial3:** It causes as many point of damage as the Wisdom of the summoning Creature.
*   ✅ **terrestrial4:** Rival Allies of Wisdom X or lower are discarded (X being the value in the upper left corner). 
*   ✅ **terrestrial5:** Final: Remove 1 knowledge card from the Rival's table. (Implemented as rotational damage)
*   ✅ **aquatic1:** It rotates one of your Knowledge cards immediately. 
*   ✅ **aquatic2:** Gain +1 when defending if the opposing Creature has no Knowledge cards. 
*   ✅ **aquatic3:** The opposing Creature cannot summon Knowledge cards. 
*   ✅ **aquatic4:** Apparition: Draw 1 card from the Market with no cost. 
*   ✅ **aquatic5:** Final: Win 1 extra Action. 
*   ✅ **aerial1:** Apparition: Gain +1 Power. (Implemented as rotational damage, needs 'On Summon' trigger)
*   ✅ **aerial2:** Gain X Power (X being the value in the upper left corner). (Effect missing in `effects.ts`)
*   ✅ **aerial3:** While in play, it adds +1 to the Wisdom of all your Creatures. (Implemented as rotational damage, needs persistent effect logic)
*   ✅ **aerial4:** Each point of damage caused by the Chiropter gives you +1 Power.
*   ✅ **aerial5:** The Rival rotates all his Creatures 90º. (Implemented as rotational damage/defense)

