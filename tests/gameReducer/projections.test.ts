import { describe, expect, it } from 'vitest';
import { buildGameProjection } from '../../src/game/projections.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

function createStateWithPrivateHands() {
  const state = initializeGame({
    gameId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120002',
    player1Id: 'player-1',
    player2Id: 'player-2',
    player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
    player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
  }, createGameRandomState('33'.repeat(32)));
  state.players[0].hand.push(state.knowledgeDeck.shift()!);
  state.players[1].hand.push(state.knowledgeDeck.shift()!);
  return state;
}

const metadata = { stateVersion: 4, eventSequence: 4, seedCommitment: 'aa'.repeat(32) };

describe('private game projections', () => {
  it('shows only the viewer hand and never includes the private random seed', () => {
    const state = createStateWithPrivateHands();
    const ownCardId = state.players[0].hand[0].instanceId!;
    const opponentCardId = state.players[1].hand[0].instanceId!;
    const seed = state.privateRandom!.seedHex;
    const projection = buildGameProjection(state, { kind: 'player', playerId: 'player-1' }, metadata);
    const serialized = JSON.stringify(projection);

    expect(projection.players[0].hand).toMatchObject({ visibility: 'visible', count: 1 });
    expect(projection.players[1].hand).toEqual({ visibility: 'hidden', count: 1 });
    expect(serialized).toContain(ownCardId);
    expect(serialized).not.toContain(opponentCardId);
    expect(serialized).not.toContain(seed);
    expect(projection.deckCount).toBe(state.knowledgeDeck.length);
  });

  it('hides both hands and all pending effects from spectators', () => {
    const state = createStateWithPrivateHands();
    state.pendingEffect = {
      id: 'pending-effect',
      type: 'chooseOpponentHandDiscard',
      playerId: 'player-1',
      sourcePlayerId: 'player-1',
      prompt: 'Choose one card.',
      choices: [{
        kind: 'hand',
        playerIndex: 1,
        instanceId: state.players[1].hand[0].instanceId!,
        label: state.players[1].hand[0].name,
        image: state.players[1].hand[0].image,
      }],
    };

    const projection = buildGameProjection(state, { kind: 'spectator' }, metadata);
    expect(projection.players.map((player) => player.hand)).toEqual([
      { visibility: 'hidden', count: 1 },
      { visibility: 'hidden', count: 1 },
    ]);
    expect(projection.pendingEffect).toBeNull();
  });

  it('gives the selected actor opaque keys instead of hidden card identities', () => {
    const state = createStateWithPrivateHands();
    const hiddenCard = state.players[1].hand[0];
    state.pendingEffect = {
      id: 'pending-effect',
      type: 'chooseOpponentHandDiscard',
      playerId: 'player-1',
      sourcePlayerId: 'player-1',
      prompt: 'Choose one card.',
      choices: [{
        kind: 'hand',
        playerIndex: 1,
        instanceId: hiddenCard.instanceId!,
        label: hiddenCard.name,
        image: hiddenCard.image,
      }],
    };

    const actorProjection = buildGameProjection(state, { kind: 'player', playerId: 'player-1' }, metadata);
    const opponentProjection = buildGameProjection(state, { kind: 'player', playerId: 'player-2' }, metadata);
    const serialized = JSON.stringify(actorProjection.pendingEffect);

    expect(actorProjection.pendingEffect?.choices).toEqual([
      { key: 'choice-1', kind: 'hand', label: 'Hidden card 1' },
    ]);
    expect(serialized).not.toContain(hiddenCard.instanceId!);
    expect(serialized).not.toContain(hiddenCard.name);
    expect(opponentProjection.pendingEffect).toBeNull();
  });
});
