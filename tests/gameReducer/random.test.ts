import { describe, expect, it } from 'vitest';
import {
  computeGameSeedCommitment,
  createGameRandomState,
  takeGameRandomBytes,
  verifyGameSeedCommitment,
} from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const SETUP = {
  gameId: MATCH_ID,
  player1Id: 'player-1',
  player2Id: 'player-2',
  player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
  player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
};

describe('authoritative deterministic random stream', () => {
  it('matches the RFC 8439 ChaCha20 zero-key block vector', () => {
    const state = createGameRandomState('00'.repeat(32));
    const bytes = takeGameRandomBytes(state, 64);
    const actual = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

    expect(actual).toBe(
      '76b8e0ada0f13d90405d6ae55386bd28'
      + 'bdd219b8a08ded1aa836efcc8b770dc7'
      + 'da41597c5157488d7724e03fb8d84a37'
      + '6a43b8f41518a11cc387b669b2ee6586',
    );
    expect(state.cursor).toBe(64);
  });

  it('creates byte-identical private states from the same seed', () => {
    const seed = '11'.repeat(32);
    const first = initializeGame(SETUP, createGameRandomState(seed));
    const second = initializeGame(SETUP, createGameRandomState(seed));
    const different = initializeGame(SETUP, createGameRandomState('22'.repeat(32)));

    expect(second).toEqual(first);
    expect(different.market.map((card) => card.instanceId)).not.toEqual(
      first.market.map((card) => card.instanceId),
    );
  });

  it('commits to a seed without revealing it and verifies the later reveal', async () => {
    const seed = 'ab'.repeat(32);
    const commitment = await computeGameSeedCommitment(seed);

    expect(commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(commitment).not.toContain(seed);
    await expect(verifyGameSeedCommitment(seed, commitment)).resolves.toBe(true);
    await expect(verifyGameSeedCommitment('cd'.repeat(32), commitment)).resolves.toBe(false);
  });
});
