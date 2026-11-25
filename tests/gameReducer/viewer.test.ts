import { describe, expect, it } from 'vitest';
import {
  createFieldKnowledgeSnapshot,
  detectPowerDamage,
  findAttackMoveSource,
  findRemovedFieldKnowledge,
  getViewerPlayerIndex,
  isViewerTurn,
  parseDamageLogLine,
  parseRecentDefenseFromLogs,
} from '../../src/game/viewer.js';
import { createInitialTestState } from '../utils/testHelpers.js';
import { createTestKnowledge } from '../utils/testHelpers.js';

const createViewerState = () => {
  const state = createInitialTestState();
  state.players[0].id = 'player-one';
  state.players[1].id = 'player-two';
  return state;
};

describe('game viewer selectors', () => {
  it('finds both player slots and classifies outsiders as spectators', () => {
    const state = createViewerState();
    expect(getViewerPlayerIndex(state, 'player-one')).toBe(0);
    expect(getViewerPlayerIndex(state, 'player-two')).toBe(1);
    expect(getViewerPlayerIndex(state, 'outsider')).toBe(-1);
  });

  it('fails closed while viewer or game state is incomplete', () => {
    const state = createViewerState();
    expect(getViewerPlayerIndex(null, 'player-one')).toBe(-1);
    expect(getViewerPlayerIndex(state, null)).toBe(-1);
    expect(getViewerPlayerIndex({ players: [] } as never, 'player-one')).toBe(-1);
    expect(isViewerTurn(undefined, 'player-one')).toBe(false);
  });

  it('derives the active turn for either participant without local state', () => {
    const state = createViewerState();
    state.currentPlayerIndex = 0;
    expect(isViewerTurn(state, 'player-one')).toBe(true);
    expect(isViewerTurn(state, 'player-two')).toBe(false);
    state.currentPlayerIndex = 1;
    expect(isViewerTurn(state, 'player-one')).toBe(false);
    expect(isViewerTurn(state, 'player-two')).toBe(true);
  });

  it('never reports a spectator or any player after a winner exists as active', () => {
    const state = createViewerState();
    expect(isViewerTurn(state, 'outsider')).toBe(false);
    state.winner = 'player-one';
    expect(isViewerTurn(state, 'player-one')).toBe(false);
    expect(isViewerTurn(state, 'player-two')).toBe(false);
  });

  it('parses only the newest ten relevant defense log entries', () => {
    const old = 'player-one deals something to target-player. Defense: 99 bypassed';
    const logs = [old, ...Array.from({ length: 10 }, (_, index) => `unrelated ${index}`)];
    expect(parseRecentDefenseFromLogs(logs, 'target-player')).toEqual({});

    logs.push('player-one deals 4 damage to target-player. Defense: 3 bypassed');
    expect(parseRecentDefenseFromLogs(logs, 'target-player')).toEqual({
      blocked: 3,
      bypass: true,
    });
    expect(parseRecentDefenseFromLogs(logs, 'another-player')).toEqual({});
    expect(parseRecentDefenseFromLogs(logs, '')).toEqual({});
  });

  it('detects a power decrease once and ignores unchanged or increased power', () => {
    const playerIds: [string, string] = ['player-one', 'player-two'];
    expect(detectPowerDamage(null, { p0: 20, p1: 20 }, playerIds, [])).toBeNull();
    expect(detectPowerDamage(
      { p0: 20, p1: 20 },
      { p0: 20, p1: 21 },
      playerIds,
      [],
    )).toBeNull();
    expect(detectPowerDamage(
      { p0: 20, p1: 20 },
      { p0: 20, p1: 16 },
      playerIds,
      ['player-one deals 4 damage to player-two. Defense: 2'],
    )).toEqual({ playerIndex: 1, damage: 4, blocked: 2 });
  });

  it('preserves the existing first-player priority if both powers fall together', () => {
    expect(detectPowerDamage(
      { p0: 20, p1: 20 },
      { p0: 18, p1: 15 },
      ['player-one', 'player-two'],
      [],
    )).toEqual({ playerIndex: 0, damage: 2 });
  });

  it('detects a removed field card with its previous image', () => {
    const state = createViewerState();
    const card = createTestKnowledge('aerial1', { instanceId: 'own-field-card' });
    state.players[0].field[0].knowledge = card;
    const previous = createFieldKnowledgeSnapshot(state.players, 0);
    state.players[0].field[0].knowledge = null;
    const current = createFieldKnowledgeSnapshot(state.players, 0);

    expect(findRemovedFieldKnowledge(previous, current)).toEqual({
      instanceId: 'own-field-card',
      image: card.image,
    });
    expect(findRemovedFieldKnowledge(current, current)).toBeNull();
  });

  it('preserves own-field priority when both sides lose a card in one snapshot', () => {
    const state = createViewerState();
    state.players[0].field[0].knowledge = createTestKnowledge('aerial1', {
      instanceId: 'own-field-card',
    });
    state.players[1].field[0].knowledge = createTestKnowledge('aquatic1', {
      instanceId: 'opponent-field-card',
    });
    const previous = createFieldKnowledgeSnapshot(state.players, 0);
    state.players[0].field[0].knowledge = null;
    state.players[1].field[0].knowledge = null;

    expect(findRemovedFieldKnowledge(
      previous,
      createFieldKnowledgeSnapshot(state.players, 0),
    )).toMatchObject({ instanceId: 'own-field-card' });
  });

  it('orients mine/opponent snapshots for the second viewer', () => {
    const state = createViewerState();
    state.players[0].field[0].knowledge = createTestKnowledge('aerial1', {
      instanceId: 'player-one-card',
    });
    state.players[1].field[0].knowledge = createTestKnowledge('aquatic1', {
      instanceId: 'player-two-card',
    });

    expect(createFieldKnowledgeSnapshot(state.players, 1)).toMatchObject({
      mine: ['player-two-card'],
      opponent: ['player-one-card'],
    });
  });

  it('parses a positive damage log only when the target is a UUID', () => {
    const target = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';
    expect(parseDamageLogLine(`Aerial deals 4 damage to ${target}.`)).toEqual({
      amount: 4,
      targetPlayerId: target,
    });
    expect(parseDamageLogLine('Aerial deals 4 damage to player-two.')).toBeNull();
    expect(parseDamageLogLine(`Aerial deals 0 damage to ${target}.`)).toBeNull();
    expect(parseDamageLogLine('unrelated log')).toBeNull();
  });

  it('selects the first field card opposite the damaged player', () => {
    const state = createViewerState();
    state.players[0].id = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
    state.players[1].id = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';
    const attacker = createTestKnowledge('aerial1', { instanceId: 'attacker-card' });
    state.players[0].field[0].knowledge = attacker;

    expect(findAttackMoveSource(
      `Aerial deals 4 damage to ${state.players[1].id}.`,
      state.players,
    )).toEqual({
      attackerInstanceId: 'attacker-card',
      image: attacker.image,
      targetPlayerIndex: 1,
    });
  });

  it('does not invent attack movement for an outsider or empty attacker field', () => {
    const state = createViewerState();
    state.players[0].id = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
    state.players[1].id = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';
    expect(findAttackMoveSource(
      'Aerial deals 4 damage to 018f2f9a-4e1c-7b8a-8f2c-0242ac120099.',
      state.players,
    )).toBeNull();
    expect(findAttackMoveSource(
      `Aerial deals 4 damage to ${state.players[1].id}.`,
      state.players,
    )).toBeNull();
  });
});
