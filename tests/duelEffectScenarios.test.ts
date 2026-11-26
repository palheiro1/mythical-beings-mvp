import { describe, expect, it } from 'vitest';
import { projectMatch, advanceMatch, COMMAND_PROTOCOL_V2 } from '@mythicalb/wisdom-duel-engine';
import { duelMotion, describeMotion } from '../src/utils/trainingMotion.js';
import { effectScenario, resolveScenario } from './browser/duelEffectScenarios.js';

const now = '2026-01-01T12:00:00Z';
describe('effects as received by a duel participant', () => {
  it('explains a zero-Wisdom Earthquake to both players without reporting a block', async () => {
    const setup = await effectScenario('Earthquake', now);
    const creature = setup.state.players[0].creatures[0];
    creature.rotation = 0;
    creature.currentWisdom = 0;
    const end = resolveScenario('Earthquake', setup, now);
    for (const viewer of ['north', 'south']) {
      const steps = duelMotion(projectMatch(setup, viewer, now), projectMatch(end, viewer, now), true);
      const message = steps.map(step => describeMotion(step, viewer)).join(' ');
      expect(message).toContain('Earthquake · Final rotation · 0 damage because the Creature has 0 Wisdom');
      expect(message).not.toContain('Fully blocked');
    }
    expect(end.state.players[1].power).toBe(20);
  });

  it('shows attack, each contribution and the actual score on either side', async () => {
    const setup = await effectScenario('Earthquake', now);
    const end = resolveScenario('Earthquake', setup, now);
    for (const viewer of ['north', 'south']) {
      const before = projectMatch(setup, viewer, now),
        after = projectMatch(end, viewer, now);
      const cues = duelMotion(before, after, true);
      expect(cues[0]).toMatchObject({
        kind: 'combat',
        label: 'Earthquake',
        attack: 4,
        amount: 2,
        before: 20,
        after: 18,
        defense: [{ label: 'Galapago', amount: 2 }],
      });
      expect(describeMotion(cues[0], viewer)).toContain('20 → 18');
      expect(duelMotion(after, projectMatch(end, viewer, now), true)).toEqual([]);
    }
    expect(end.state.players[1].power).toBe(18);
  });
  it('links a forced discard to its leave-play reaction, preserving the other slot', async () => {
    const setup = await effectScenario('Fire', now);
    const end = resolveScenario('Fire', setup, now);
    const cues = end.events.at(-1)!.cues!;
    expect(cues.slice(0, 2)).toMatchObject([
      { action: 'discard', label: 'Fire', targets: [{ label: 'Serpent', destination: 'discard' }] },
      { kind: 'power', label: 'Lisovik', amount: -1, before: 20, after: 19, triggeredBy: { label: 'Serpent' } },
    ]);
    expect(end.state.players[1].field.some((s) => s.knowledge?.name === 'Hurricane')).toBe(true);
  });
  it('rotates only eligible Creatures and reports Wisdom per target', async () => {
    const end = resolveScenario('Migration', await effectScenario('Migration', now), now);
    expect(end.events.at(-1)!.cues?.[0]).toMatchObject({
      action: 'reverse',
      label: 'Migration',
      targets: [
        { label: 'Tarasca', before: 2, after: 0 },
        { label: 'Adaro', before: 4, after: 1 },
      ],
    });
    expect(end.state.players.map((p) => p.power)).toEqual([20, 20]);
  });
  it('redacts the identity of a new opposing hand card in the event and both projections', async () => {
    const m = await effectScenario('Earthquake', now),
      card = m.state.market[0];
    const next = advanceMatch(
      m,
      'south',
      {
        matchId: m.state.gameId,
        expectedVersion: 0,
        commandId: 'ef000000-0000-4000-8000-000000000003',
        protocolVersion: COMMAND_PROTOCOL_V2,
        command: { type: 'draw_knowledge', marketInstanceId: card.instanceId! },
      },
      now,
    );
    const own = projectMatch(next, 'south', now),
      other = projectMatch(next, 'north', now);
    expect(own.events.at(-1)!.cues?.[0]).toMatchObject({ action: 'draw', targets: [{ label: card.name }] });
    expect(JSON.stringify(other)).not.toContain(card.instanceId);
    expect(other.events.at(-1)!.cues?.[0]).toMatchObject({
      action: 'draw',
      targets: [{ concealed: true, label: 'a card' }],
    });
  });
});

describe('Defense, choices and repeated card identities', () => {
  it('caps the actual block and names every contributor and the Creature that pierces it', async () => {
    const { calculateDamage } = await import('../src/game/effects.js');
    const { creatures } = await import('@mythicalb/wisdom-duel-engine/catalog');
    const match = await effectScenario('Earthquake', now),
      [attacker, defender] = match.state.players;
    defender.creatures[2] = { ...creatures.find((c) => c.id === 'trempulcahue')! };
    const card = attacker.field[0].knowledge!;
    const blocked = calculateDamage(match.state, 1, 1, 0, card, 0);
    expect(blocked.cue).toMatchObject({
      attack: 1,
      amount: 0,
      blocked: 1,
      defense: [
        { label: 'Galapago', amount: 2 },
        { label: 'Trempulcahue', amount: 1 },
      ],
    });
    attacker.creatures[0] = { ...creatures.find((c) => c.id === 'zhar-ptitsa')! };
    attacker.field[0].creatureId = 'zhar-ptitsa';
    const air = match.state.knowledgeDeck.find((c) => c.name === 'Lepidoptera')!;
    expect(calculateDamage(match.state, 1, 1, 0, air, 0).cue).toMatchObject({
      attack: 1,
      amount: 1,
      blocked: 0,
      bypass: true,
      provider: { label: 'Zhar Ptitsa' },
      defense: [{ amount: 2 }, { amount: 1 }],
    });
  });

  it('retains the exact source across a pending choice even with identical cards', async () => {
    const { gameReducer } = await import('../src/game/state.js');
    const match = await effectScenario('Earthquake', now),
      g = match.state;
    const [player] = g.players;
    g.currentPlayerIndex = 0;
    player.field[0].knowledge = null;
    const rivals = g.players[1];
    rivals.hand = [g.knowledgeDeck[4]];
    const copies = g.knowledgeDeck.filter((c) => c.name === 'Serpent');
    player.hand = [copies[0]];
    player.field[1].knowledge = copies[1];
    const summoned = gameReducer(
      { ...g, presentationCues: [] },
      {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: player.id,
          knowledgeId: copies[0].id,
          instanceId: copies[0].instanceId!,
          creatureId: 'adaro',
        },
      },
    )!;
    const pending = summoned.pendingEffect!;
    expect(pending.presentationSource?.source).toBe('card:' + copies[0].instanceId);
    const result = gameReducer(
      { ...summoned, presentationCues: [] },
      {
        type: 'RESOLVE_PENDING_EFFECT',
        payload: {
          playerId: player.id,
          resolution: { effectId: pending.id, choice: pending.choices[0] },
        },
      },
    )!;
    expect(result.presentationCues?.[0]).toMatchObject({
      source: 'card:' + copies[0].instanceId,
      action: 'discard',
      targets: [{ label: rivals.hand[0].name, zone: 'hand:south', destination: 'discard' }],
    });
  });

  it('offers only eligible Tulpar targets and skipping animates no rotation', async () => {
    const { gameReducer } = await import('../src/game/state.js');
    const { projectCues } = await import('../src/game/presentation.js');
    const match = await effectScenario('Earthquake', now),
      g = match.state;
    g.currentPlayerIndex = 0;
    const [player] = g.players;
    player.field[0].knowledge = null;
    player.creatures[2].rotation = 270;
    const air = g.knowledgeDeck.find((c) => c.name === 'Lepidoptera')!;
    player.hand = [air];
    const summoned = gameReducer(
      { ...g, presentationCues: [] },
      {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: player.id,
          knowledgeId: air.id,
          instanceId: air.instanceId!,
          creatureId: 'adaro',
        },
      },
    )!;
    expect(summoned.presentationCues?.find((c) => c.action === 'choose')).toMatchObject({
      label: 'Tulpar',
      targets: [{ label: 'Adaro' }, { label: 'Kappa' }],
    });
    expect(projectCues(summoned.presentationCues!, 'south').some((c) => c.action === 'choose')).toBe(false);
    const result = gameReducer(
      { ...summoned, presentationCues: [] },
      {
        type: 'RESOLVE_PENDING_EFFECT',
        payload: {
          playerId: player.id,
          resolution: { effectId: summoned.pendingEffect!.id, skip: true },
        },
      },
    )!;
    expect(result.presentationCues).toMatchObject([{ label: 'Tulpar', action: 'skip' }]);
    expect(result.players[0].creatures.map((c) => c.rotation)).toEqual(
      summoned.players[0].creatures.map((c) => c.rotation),
    );
  });
});
