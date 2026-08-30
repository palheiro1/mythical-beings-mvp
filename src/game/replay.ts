import {
  InMemoryAuthoritativeGameExecutor,
  type AuthoritativeGameEvent,
} from './authoritativeExecutor.js';
import {
  computeGameSeedCommitment,
  createGameRandomState,
  generateGameSeedHex,
} from './random.js';
import { initializeGame, type InitializeGamePayload } from './state.js';
import type { GameState } from './types.js';

export interface SeededAuthoritativeGame {
  state: GameState;
  seedCommitment: string;
}

export interface AuthoritativeReplayResult {
  state: GameState;
  stateVersion: number;
  eventSequence: number;
}

export class AuthoritativeReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthoritativeReplayError';
  }
}

export async function createSeededAuthoritativeGame(
  payload: InitializeGamePayload,
  seedHex = generateGameSeedHex(),
): Promise<SeededAuthoritativeGame> {
  const state = initializeGame(payload, createGameRandomState(seedHex));
  return {
    state,
    seedCommitment: await computeGameSeedCommitment(seedHex),
  };
}

export function replayAuthoritativeEvents(
  initialState: GameState,
  events: readonly AuthoritativeGameEvent[],
): AuthoritativeReplayResult {
  const executor = new InMemoryAuthoritativeGameExecutor({
    enabled: true,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  executor.registerMatch(initialState);

  let expectedSequence = 1;
  let expectedVersion = 1;
  for (const event of events) {
    if (
      event.sequence !== expectedSequence
      || event.stateVersion !== expectedVersion
      || event.commandId !== event.envelope.commandId
      || event.commandType !== event.envelope.command.type
    ) {
      throw new AuthoritativeReplayError('Replay event metadata is inconsistent.');
    }
    const result = executor.execute(event.actorId, event.envelope);
    if (
      result.status !== 'accepted'
      || result.stateVersion !== event.stateVersion
      || result.eventSequence !== event.sequence
    ) {
      throw new AuthoritativeReplayError(`Replay rejected command ${event.commandId}.`);
    }
    expectedSequence += 1;
    expectedVersion += 1;
  }

  const snapshot = executor.exportPrivateSnapshot(initialState.gameId);
  if (!snapshot) throw new AuthoritativeReplayError('Replay snapshot is missing.');
  return snapshot;
}
