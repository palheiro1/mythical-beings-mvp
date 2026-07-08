import React from 'react';
import { BookOpen, Download, ScrollText, Sparkles } from 'lucide-react';
import Card from '../components/Card.js';
import { Creature, Knowledge } from '../game/types.js';
import creatureData from '../assets/creatures.json' with { type: 'json' };
import knowledgeData from '../assets/knowledges.json' with { type: 'json' };
import { ArenaButton, PageShell, Panel, StatusBadge } from '../components/ui/index.js';

const ALL_CREATURES: Creature[] = creatureData as Creature[];
const ALL_KNOWLEDGES: Knowledge[] = knowledgeData as Knowledge[];

// Map knowledge IDs to user-friendly effect descriptions
const knowledgeEffectDescriptions: Record<string, string> = {
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
  aerial5: "The Rival rotates all his Creatures 90º.",
};

const HowToPlay: React.FC = () => {
  // Deduplicate knowledge cards by ID for display (since JSON might have duplicates for deck building)
  const uniqueKnowledgeCards = ALL_KNOWLEDGES.reduce((acc, current) => {
    if (!acc.find(item => item.id === current.id)) {
      acc.push(current);
    }
    return acc;
  }, [] as Knowledge[]);

  return (
    <PageShell contentClassName="grid gap-6 pb-24 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <Panel className="sticky top-[calc(var(--navbar-height)+24px)] p-4">
          <p className="mb-4 text-xs font-bold uppercase tracking-normal text-slate-500">Compendium</p>
          <nav className="space-y-2 text-sm">
            <a href="#overview" className="flex items-center gap-2 rounded-lg bg-violet-500/15 px-3 py-2 text-violet-100"><BookOpen className="h-4 w-4" aria-hidden /> Overview</a>
            <a href="#rulebook" className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-white/[0.05]"><ScrollText className="h-4 w-4" aria-hidden /> Rulebook</a>
            <a href="#creatures" className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-white/[0.05]"><Sparkles className="h-4 w-4" aria-hidden /> Creatures</a>
            <a href="#knowledge" className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-white/[0.05]"><Sparkles className="h-4 w-4" aria-hidden /> Knowledge</a>
          </nav>
        </Panel>
      </aside>

      <div className="space-y-6">
        <Panel id="overview" className="arena-banner p-6 sm:p-8" glow>
          <StatusBadge tone="violet" className="mb-4">Player Reference</StatusBadge>
          <h1 className="font-display text-4xl font-black text-slate-50 sm:text-5xl">How to Play</h1>
          <p className="mt-3 max-w-3xl text-slate-300">Everything you need to know to enter the arena, read the cards, and follow the digital match flow.</p>
        </Panel>

        <Panel id="rulebook" className="grid gap-5 p-5 md:grid-cols-[180px_1fr_auto] md:items-center">
          <div className="mx-auto h-40 w-32 overflow-hidden rounded-xl border border-amber-300/25 shadow-[0_16px_34px_rgba(0,0,0,0.34)] md:mx-0">
            <div className="card-back-face h-full w-full" aria-hidden>
              <img src="/logos/logo-header-dark.png" alt="" className="card-back-crest" />
            </div>
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold text-slate-50">Official Rulebook</h2>
            <p className="mt-2 text-slate-300">For the complete visual rules reference, open the official rulebook PDF. The digital engine remains the source of truth for implemented behavior.</p>
          </div>
          <a href="/RULEBOOK.pdf" target="_blank" rel="noopener noreferrer">
            <ArenaButton type="button" icon={<Download className="h-4 w-4" aria-hidden />}>Download Rulebook (PDF)</ArenaButton>
          </a>
        </Panel>

        <Panel id="creatures" className="p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusBadge tone="amber">Creatures</StatusBadge>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">Legendary Beings</h2>
              <p className="mt-1 text-sm text-slate-400">Each creature has a passive ability and a Wisdom cycle driven by rotation.</p>
            </div>
            <span className="text-sm text-slate-500">{ALL_CREATURES.length} creatures</span>
          </div>
          <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {ALL_CREATURES.map((creature) => (
              <div key={creature.id} className="flex flex-col items-center text-center">
                <div className="mb-3 h-[210px] w-[150px]">
                  <Card card={creature} isDisabled={true} />
                </div>
                <p className="max-w-[170px] text-xs leading-5 text-slate-400">{creature.passiveAbility}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel id="knowledge" className="p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusBadge tone="blue">Knowledge</StatusBadge>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">Knowledge Cards</h2>
              <p className="mt-1 text-sm text-slate-400">Knowledge shapes the flow of battle through costs, effects, rotations, and discard timing.</p>
            </div>
            <span className="text-sm text-slate-500">{uniqueKnowledgeCards.length} unique cards</span>
          </div>
          <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {uniqueKnowledgeCards.map((knowledge) => (
              <div key={knowledge.id} className="flex flex-col items-center text-center">
                <div className="mb-3 h-[210px] w-[150px]">
                  <Card card={knowledge} isDisabled={true} />
                </div>
                <p className="max-w-[170px] text-xs leading-5 text-slate-400">
                  {knowledgeEffectDescriptions[knowledge.id] || 'Effect description missing.'}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
};

export default HowToPlay;
