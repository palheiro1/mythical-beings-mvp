"use strict";
exports.__esModule = true;
var react_1 = require("react");
var NavBar_1 = require("../components/NavBar");
var Card_1 = require("../components/Card");
var creatures_json_1 = require("../assets/creatures.json");
var knowledges_json_1 = require("../assets/knowledges.json");
var ALL_CREATURES = creatures_json_1["default"];
var ALL_KNOWLEDGES = knowledges_json_1["default"];
// Map knowledge IDs to user-friendly effect descriptions
var knowledgeEffectDescriptions = {
    terrestrial1: "If the opposing Creature has no Spells of Allies, Ursus causes +1 damage.",
    terrestrial2: "Apparition: Look at the opponent's hand and discard 1 card.",
    terrestrial3: "It causes as many point of damage as the Wisdom of the summoning Creature",
    terrestrial4: "Rival Allies of Wisdom X or lower are discarded (X being the value in the upper left corner).",
    terrestrial5: "Final: Remove 1 knowledge card from the Rival's table.",
    aquatic1: "It rotates one of your Knowledge cards inmediately.",
    aquatic2: "Gain +1 when defending if the opposing Creature has no Knowledge cards.",
    aquatic3: "The opposing Creature cannot summon Knowledge cards.",
    aquatic4: "Apparition: Draw 1 card from the Market with no cost.",
    aquatic5: "Final: Win 1 extra Action.",
    aerial1: "Apparition: Gain +1 Power.",
    aerial2: "Gain X Power (X being the value in the upper left corner).",
    aerial3: "While in play, it adds +1 to the Wisdom of all your Creatures.",
    aerial4: "Each point of damage caused by the Chiropter gives you +1 Power.",
    aerial5: "The Rival rotates all his Creatures 90º."
};
var HowToPlay = function () {
    // Deduplicate knowledge cards by ID for display (since JSON might have duplicates for deck building)
    var uniqueKnowledgeCards = ALL_KNOWLEDGES.reduce(function (acc, current) {
        if (!acc.find(function (item) { return item.id === current.id; })) {
            acc.push(current);
        }
        return acc;
    }, []);
    return (<div className="min-h-screen bg-gray-900 text-white pb-10 pt-16"> {/* Added pt-16 for fixed NavBar */}
      <NavBar_1["default"] />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300">
          How to Play Mythical Arena
        </h1>

        {/* Rulebook Section */}
        <section className="mb-12 text-center">
          <h2 className="text-3xl font-semibold mb-4 text-yellow-400">Rulebook</h2>
          <p className="mb-4 text-lg text-gray-300">
            For the complete rules, download the official rulebook PDF.
          </p>
          <a href="/RULEBOOK.pdf" target="_blank" rel="noopener noreferrer" className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg">
            Download Rulebook (PDF)
          </a>
        </section>

        {/* Creatures Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-center text-yellow-400">Creatures</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10 justify-items-center">
            {ALL_CREATURES.map(function (creature) { return (<div key={creature.id} className="flex flex-col items-center text-center">
                <div className="w-[150px] h-[210px] mb-2"> {/* Fixed size container */}
                  <Card_1["default"] card={creature} isDisabled={true}/>
                </div>
                <p className="text-xs text-gray-400 max-w-[150px]">{creature.passiveAbility}</p>
              </div>); })}
          </div>
        </section>

        {/* Knowledge Cards Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-6 text-center text-yellow-400">Knowledge Cards</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10 justify-items-center">
            {uniqueKnowledgeCards.map(function (knowledge) { return (<div key={knowledge.id} className="flex flex-col items-center text-center">
                <div className="w-[150px] h-[210px] mb-2"> {/* Fixed size container */}
                  <Card_1["default"] card={knowledge} isDisabled={true}/>
                </div>
                <p className="text-xs text-gray-400 max-w-[150px]">
                  {knowledgeEffectDescriptions[knowledge.id] || 'Effect description missing.'}
                </p>
              </div>); })}
          </div>
        </section>
      </div>
    </div>);
};
exports["default"] = HowToPlay;
