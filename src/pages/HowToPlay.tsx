import React, { useMemo, useState } from 'react';
import { BookOpen, Download, GraduationCap, Play, RotateCw, Search, ScrollText, Sparkles, Swords } from 'lucide-react';
import Card from '../components/Card.js';
import { Creature, Knowledge } from '../game/types.js';
import creatureData from '../assets/creatures.json' with { type: 'json' };
import knowledgeData from '../assets/knowledges.json' with { type: 'json' };
import { ArenaLink, Input, PageShell, Panel, StatusBadge } from '../components/ui/index.js';

const ALL_CREATURES: Creature[] = creatureData as Creature[];
const ALL_KNOWLEDGES: Knowledge[] = knowledgeData as Knowledge[];
const UNIQUE_KNOWLEDGES = ALL_KNOWLEDGES.filter(
  (knowledge, index, cards) => cards.findIndex((candidate) => candidate.id === knowledge.id) === index,
);

type CardTypeFilter = 'all' | 'creature' | 'knowledge';
type ElementFilter = 'all' | 'earth' | 'water' | 'air' | 'fire';

const matchesCardFilters = (
  cardElement: string,
  searchableText: string,
  selectedElement: ElementFilter,
  normalizedQuery: string,
) => (
  (selectedElement === 'all' || cardElement === selectedElement)
  && (!normalizedQuery || searchableText.toLocaleLowerCase().includes(normalizedQuery))
);

// Map knowledge IDs to user-friendly effect descriptions
const knowledgeEffectDescriptions: Record<string, string> = {
  terrestrial1: "If the opposing creature has no allied Knowledge, Ursus deals 1 additional damage.",
  terrestrial2: "Apparition: Look at the opponent's hand and discard 1 card.",
  terrestrial3: "Deal damage equal to the Wisdom of the creature that summoned this card.",
  terrestrial4: "Discard opposing creatures with Wisdom X or lower, where X is the value in the upper-left corner.",
  terrestrial5: "Final: Remove 1 Knowledge card from the opponent's field.",
  aquatic1: "Immediately rotate one of your other Knowledge cards.",
  aquatic2: "Gain +1 when defending if the opposing Creature has no Knowledge cards.",
  aquatic3: "The opposing creature cannot summon Knowledge cards.",
  aquatic4: "Apparition: Draw 1 card from the Market with no cost.",
  aquatic5: "Final: Win 1 extra Action.",
  aerial1: "Apparition: Gain +1 Power.",
  aerial2: "Gain X Power (X being the value in the upper left corner).",
  aerial3: "While in play, it adds +1 to the Wisdom of all your Creatures.",
  aerial4: "Each point of damage caused by the Chiropter gives you +1 Power.",
  aerial5: "The opponent rotates all their creatures 90°.",
};

const HowToPlay: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cardType, setCardType] = useState<CardTypeFilter>('all');
  const [element, setElement] = useState<ElementFilter>('all');

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  const filteredCreatures = useMemo(
    () => cardType === 'knowledge'
      ? []
      : ALL_CREATURES.filter((creature) => matchesCardFilters(
        creature.element,
        `${creature.name} ${creature.element} ${creature.passiveAbility}`,
        element,
        normalizedQuery,
      )),
    [cardType, element, normalizedQuery],
  );

  const filteredKnowledge = useMemo(
    () => cardType === 'creature'
      ? []
      : UNIQUE_KNOWLEDGES.filter((knowledge) => matchesCardFilters(
        knowledge.element,
        `${knowledge.name} ${knowledge.element} ${knowledge.effect} ${knowledgeEffectDescriptions[knowledge.id] ?? ''}`,
        element,
        normalizedQuery,
      )),
    [cardType, element, normalizedQuery],
  );

  const resultCount = filteredCreatures.length + filteredKnowledge.length;

  return (
    <PageShell contentClassName="grid gap-6 pb-24 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <Panel className="sticky top-[calc(var(--navbar-height)+24px)] p-4">
          <p className="mb-4 text-xs font-bold uppercase tracking-normal text-slate-500">Compendium</p>
          <nav className="space-y-2 text-sm">
            <a href="#overview" className="flex items-center gap-2 rounded-lg bg-violet-500/15 px-3 py-2 text-violet-100"><BookOpen className="h-4 w-4" aria-hidden /> Overview</a>
            <a href="#quick-start" className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-white/[0.05]"><GraduationCap className="h-4 w-4" aria-hidden /> Quick start</a>
            <a href="#card-finder" className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-white/[0.05]"><Search className="h-4 w-4" aria-hidden /> Card finder</a>
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

        <Panel id="quick-start" className="p-5 sm:p-6" glow>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <StatusBadge tone="blue"><GraduationCap className="h-3.5 w-3.5" aria-hidden /> Training in 60 seconds</StatusBadge>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">Learn one turn, then play</h2>
              <p className="mt-2 max-w-3xl text-slate-300">The guided Bot duel pauses your turn timer while it points out each control. It needs no wallet and awards no on-chain rewards.</p>
            </div>
            <ArenaLink href="/bot-selection" icon={<Play className="h-4 w-4" aria-hidden />}>
              Start guided training
            </ArenaLink>
          </div>

          <ol className="mt-6 grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Five steps to play a turn">
            {[
              ['1', 'Read the board', 'Check Power, actions, your hand, the Market, and each creature’s current Wisdom.'],
              ['2', 'Draw or prepare', 'Drawing a face-up Knowledge card normally costs one of your two actions.'],
              ['3', 'Select Knowledge', 'Choose a card whose cost does not exceed the summoning creature’s Wisdom.'],
              ['4', 'Use a creature', 'Summon the selected card, or rotate a creature to advance its Wisdom cycle.'],
              ['5', 'End deliberately', 'Use the remaining action or end the turn; reduce the rival’s Power to zero to win.'],
            ].map(([number, title, description]) => (
              <li key={number} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-cyan-300/35 bg-cyan-500/10 text-sm font-black text-cyan-100" aria-hidden>{number}</span>
                <h3 className="mt-3 font-bold text-slate-100">{title}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2"><Swords className="h-4 w-4 text-amber-300" aria-hidden /> Two actions per turn</span>
            <span className="inline-flex items-center gap-2"><RotateCw className="h-4 w-4 text-cyan-300" aria-hidden /> Rotation changes Wisdom and card values</span>
          </div>
        </Panel>

        <Panel id="card-finder" className="p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_auto_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-200">Search the card compendium</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Name, ability, effect, or element"
                  className="pl-10"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-200">Card type</span>
              <select
                value={cardType}
                onChange={(event) => setCardType(event.target.value as CardTypeFilter)}
                className="min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-100 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/15"
              >
                <option value="all">All card types</option>
                <option value="creature">Creatures</option>
                <option value="knowledge">Knowledge</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-200">Element</span>
              <select
                value={element}
                onChange={(event) => setElement(event.target.value as ElementFilter)}
                className="min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-100 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/15"
              >
                <option value="all">All elements</option>
                <option value="earth">Earth</option>
                <option value="water">Water</option>
                <option value="air">Air</option>
                <option value="fire">Fire</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-sm text-slate-400" role="status" aria-live="polite">
            {resultCount} {resultCount === 1 ? 'card matches' : 'cards match'} the current filters.
          </p>
        </Panel>

        <Panel id="rulebook" className="grid gap-5 p-5 md:grid-cols-[180px_1fr_auto] md:items-center">
          <div className="mx-auto h-40 w-32 overflow-hidden rounded-xl border border-amber-300/25 shadow-[0_16px_34px_rgba(0,0,0,0.34)] md:mx-0">
            <div className="card-back-face h-full w-full" aria-hidden>
              <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" />
            </div>
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold text-slate-50">Official Rulebook</h2>
            <p className="mt-2 text-slate-300">For the complete visual rules reference, open the official rulebook PDF. The digital engine remains the source of truth for implemented behavior.</p>
          </div>
          <ArenaLink href="/RULEBOOK.pdf" target="_blank" rel="noopener noreferrer" icon={<Download className="h-4 w-4" aria-hidden />}>
            Download Rulebook (PDF)
          </ArenaLink>
        </Panel>

        <Panel id="creatures" className="p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusBadge tone="amber">Creatures</StatusBadge>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">Legendary Beings</h2>
              <p className="mt-1 text-sm text-slate-400">Each creature has a passive ability and a Wisdom cycle driven by rotation.</p>
            </div>
            <span className="text-sm text-slate-500">{filteredCreatures.length} of {ALL_CREATURES.length} creatures</span>
          </div>
          {filteredCreatures.length > 0 ? (
            <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {filteredCreatures.map((creature) => (
              <div key={creature.id} className="flex flex-col items-center text-center">
                <div className="mb-3 h-[210px] w-[150px]">
                  <Card card={creature} isDisabled={true} imageLoading="lazy" />
                </div>
                <p className="max-w-[170px] text-xs leading-5 text-slate-400">{creature.passiveAbility}</p>
              </div>
            ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-slate-400">No creatures match these filters.</p>
          )}
        </Panel>

        <Panel id="knowledge" className="p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusBadge tone="blue">Knowledge</StatusBadge>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">Knowledge Cards</h2>
              <p className="mt-1 text-sm text-slate-400">Knowledge shapes the flow of battle through costs, effects, rotations, and discard timing.</p>
            </div>
            <span className="text-sm text-slate-500">{filteredKnowledge.length} of {UNIQUE_KNOWLEDGES.length} unique cards</span>
          </div>
          {filteredKnowledge.length > 0 ? (
            <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {filteredKnowledge.map((knowledge) => (
              <div key={knowledge.id} className="flex flex-col items-center text-center">
                <div className="mb-3 h-[210px] w-[150px]">
                  <Card card={knowledge} isDisabled={true} imageLoading="lazy" />
                </div>
                <p className="max-w-[170px] text-xs leading-5 text-slate-400">
                  {knowledgeEffectDescriptions[knowledge.id] || 'Effect description missing.'}
                </p>
              </div>
            ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-slate-400">No Knowledge cards match these filters.</p>
          )}
        </Panel>
      </div>
    </PageShell>
  );
};

export default HowToPlay;
