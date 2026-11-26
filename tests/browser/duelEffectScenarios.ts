import {
  advanceMatch,
  COMMAND_PROTOCOL_V2,
  initializeCompetitiveMatch,
  type CompetitiveSnapshot,
} from '@mythicalb/wisdom-duel-engine';
import { updateCreatureWisdomFromRotation } from '@mythicalb/wisdom-duel-engine/utils';
import type { GameState } from '../../src/game/types.js';

export const scenarios = ['Earthquake', 'Fire', 'Migration', 'Tulpar'] as const;
export type Scenario = (typeof scenarios)[number];

function takeCard(state: GameState, name: string) {
  const pile = [state.knowledgeDeck, state.market, ...state.players.map((p) => p.hand)].find((cards) =>
    cards.some((c) => c.name === name),
  )!;
  const [card] = pile.splice(
    pile.findIndex((c) => c.name === name),
    1,
  );
  return card;
}

function attach(state: GameState, side: 0 | 1, creature: string, name: string) {
  state.players[side].field.find((slot) => slot.creatureId === creature)!.knowledge = takeCard(state, name);
}

function rotate(state: GameState, side: 0 | 1, id: string, rotation: number) {
  state.players[side].creatures = state.players[side].creatures.map((creature) =>
    creature.id === id ? updateCreatureWisdomFromRotation({ ...creature, rotation }) : creature,
  );
}

export async function effectScenario(name: Scenario, now = new Date().toISOString()): Promise<CompetitiveSnapshot> {
  const match = await initializeCompetitiveMatch({
    matchId: 'ef000000-0000-4000-8000-000000000001',
    mode: 'casual',
    players: ['north', 'south'],
    selections: [
      ['adaro', 'kappa', 'tulpar'],
      ['tarasca', 'adaro', 'lisovik'],
    ],
    seedHex: '42'.repeat(32),
    now,
  });
  const game = match.state;
  if (name === 'Tulpar') {
    game.currentPlayerIndex = 0;
    match.clock.runningPlayerId = 'north';
    rotate(game, 0, 'adaro', 180);
    rotate(game, 0, 'tulpar', 270);
    game.players[0].hand.push(takeCard(game, 'Lepidoptera'));
    return match;
  }
  game.currentPlayerIndex = 1;
  match.clock.runningPlayerId = 'south';
  attach(game, 0, 'adaro', name);
  rotate(game, 0, 'adaro', name === 'Migration' ? 270 : 180);
  if (name === 'Earthquake') {
    attach(game, 1, 'tarasca', 'Galapago');
  } else if (name === 'Fire') {
    attach(game, 1, 'tarasca', 'Serpent');
    attach(game, 1, 'adaro', 'Hurricane');
  } else {
    rotate(game, 1, 'tarasca', 90);
    rotate(game, 1, 'adaro', 180);
  }
  return match;
}

export function resolveScenario(name: Scenario, match: CompetitiveSnapshot, now = new Date().toISOString()) {
  const actor = match.state.players[match.state.currentPlayerIndex];
  return advanceMatch(
    match,
    actor.id,
    {
      matchId: match.state.gameId,
      protocolVersion: COMMAND_PROTOCOL_V2,
      expectedVersion: match.version,
      commandId: 'ef000000-0000-4000-8000-000000000002',
      command: name === 'Tulpar'
        ? { type: 'summon_knowledge', creatureId: 'adaro', handInstanceId: actor.hand.find(c => c.name === 'Lepidoptera')!.instanceId! }
        : { type: 'end_turn' },
    },
    now,
  );
}
