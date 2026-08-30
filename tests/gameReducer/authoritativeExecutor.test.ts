import { describe, expect, it } from 'vitest';
import { InMemoryAuthoritativeGameExecutor } from '../../src/game/authoritativeExecutor.js';
import { GAME_COMMAND_PROTOCOL_VERSION, type GameCommandEnvelope } from '../../src/game/protocol.js';
import { computeGameSeedCommitment, createGameRandomState } from '../../src/game/random.js';
import { replayAuthoritativeEvents } from '../../src/game/replay.js';
import { initializeGame } from '../../src/game/state.js';

const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';

function createState() {
  return initializeGame({
    gameId: MATCH_ID,
    player1Id: 'player-1',
    player2Id: 'player-2',
    player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
    player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
  }, createGameRandomState('44'.repeat(32)));
}

function commandId(index: number): string {
  return `018f2f9a-4e1c-7b8a-8f2c-${index.toString(16).padStart(12, '0')}`;
}

function envelope(
  index: number,
  expectedVersion: number,
  command: GameCommandEnvelope['command'] = { type: 'rotate_creature', creatureId: 'lafaic' },
): GameCommandEnvelope {
  return {
    protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
    matchId: MATCH_ID,
    commandId: commandId(index),
    expectedVersion,
    command,
  };
}

function enabledExecutor() {
  return new InMemoryAuthoritativeGameExecutor({
    enabled: true,
    now: () => new Date('2026-08-28T12:00:00.000Z'),
  });
}

describe('in-memory authoritative command executor', () => {
  it('is disabled by default before authentication or match access', () => {
    const executor = new InMemoryAuthoritativeGameExecutor();
    expect(executor.execute(null, { forged: true })).toEqual({
      status: 'rejected',
      code: 'multiplayer_disabled',
      message: 'Multiplayer is not available in this release.',
    });
  });

  it('derives the actor, commits once and returns an idempotent duplicate', () => {
    const executor = enabledExecutor();
    executor.registerMatch(createState());
    const rotate = envelope(1, 0);

    const accepted = executor.execute('player-1', rotate);
    const duplicate = executor.execute('player-1', rotate);
    const snapshot = executor.exportPrivateSnapshot(MATCH_ID)!;

    expect(accepted).toMatchObject({ status: 'accepted', stateVersion: 1, eventSequence: 1 });
    expect(duplicate).toMatchObject({ status: 'duplicate', stateVersion: 1, eventSequence: 1 });
    expect(snapshot.state.players[0].creatures.find((creature) => creature.id === 'lafaic')?.rotation).toBe(90);
    expect(snapshot.stateVersion).toBe(1);
    expect(executor.exportEventsForReplay(MATCH_ID)).toHaveLength(1);
  });

  it('rejects reuse of an accepted command id with a different payload', () => {
    const executor = enabledExecutor();
    executor.registerMatch(createState());
    const first = envelope(1, 0);
    expect(executor.execute('player-1', first)).toMatchObject({ status: 'accepted' });

    const collision = { ...first, command: { type: 'end_turn' as const } };
    expect(executor.execute('player-1', collision)).toMatchObject({
      status: 'rejected',
      code: 'invalid_command',
    });
    expect(executor.exportEventsForReplay(MATCH_ID)).toHaveLength(1);
  });

  it('accepts only one of two commands that race on the same version', () => {
    const executor = enabledExecutor();
    executor.registerMatch(createState());

    const first = executor.execute('player-1', envelope(1, 0));
    const stale = executor.execute('player-1', envelope(2, 0, {
      type: 'rotate_creature',
      creatureId: 'adaro',
    }));

    expect(first).toMatchObject({ status: 'accepted', stateVersion: 1 });
    expect(stale).toMatchObject({
      status: 'rejected',
      code: 'version_conflict',
      currentVersion: 1,
    });
    expect(executor.exportPrivateSnapshot(MATCH_ID)).toMatchObject({ stateVersion: 1, eventSequence: 1 });
  });

  it('rejects unauthenticated, non-participant and out-of-turn actors without a write', () => {
    const executor = enabledExecutor();
    executor.registerMatch(createState());

    expect(executor.execute(null, envelope(1, 0))).toMatchObject({ status: 'rejected', code: 'unauthorized' });
    expect(executor.execute('intruder', envelope(2, 0))).toMatchObject({ status: 'rejected', code: 'not_participant' });
    expect(executor.execute('player-2', envelope(3, 0))).toMatchObject({ status: 'rejected', code: 'rule_violation' });
    expect(executor.exportPrivateSnapshot(MATCH_ID)).toMatchObject({ stateVersion: 0, eventSequence: 0 });
    expect(executor.exportEventsForReplay(MATCH_ID)).toEqual([]);
  });

  it('rejects identity injection and attempts to play a card from the opponent hand', () => {
    const state = createState();
    state.players[0].hand.push(state.knowledgeDeck.shift()!);
    state.players[1].hand.push(state.knowledgeDeck.shift()!);
    const opponentCard = state.players[1].hand[0];
    const executor = enabledExecutor();
    executor.registerMatch(state);

    expect(executor.execute('player-1', {
      ...envelope(1, 0),
      command: { type: 'end_turn', playerId: 'player-2' },
    })).toMatchObject({ status: 'rejected', code: 'invalid_command' });

    expect(executor.execute('player-1', envelope(2, 0, {
      type: 'summon_knowledge',
      handInstanceId: opponentCard.instanceId!,
      creatureId: 'lafaic',
    }))).toMatchObject({ status: 'rejected', code: 'rule_violation' });
    expect(executor.exportPrivateSnapshot(MATCH_ID)).toMatchObject({ stateVersion: 0, eventSequence: 0 });
  });

  it('resolves an opaque hidden-hand choice to the server-held card', () => {
    const state = createState();
    const hiddenCard = state.knowledgeDeck.shift()!;
    state.players[1].hand.push(hiddenCard);
    state.pendingEffect = {
      id: 'server-effect-1',
      type: 'chooseOpponentHandDiscard',
      playerId: 'player-1',
      sourcePlayerId: 'player-1',
      prompt: 'Choose one hidden card.',
      choices: [{
        kind: 'hand',
        playerIndex: 1,
        instanceId: hiddenCard.instanceId!,
        label: hiddenCard.name,
        image: hiddenCard.image,
      }],
    };
    const executor = enabledExecutor();
    executor.registerMatch(state);

    const result = executor.execute('player-1', envelope(1, 0, {
      type: 'resolve_pending_effect',
      effectId: 'server-effect-1',
      choiceKey: 'choice-1',
    }));
    const snapshot = executor.exportPrivateSnapshot(MATCH_ID)!;

    expect(result).toMatchObject({ status: 'accepted', stateVersion: 1 });
    expect(snapshot.state.players[1].hand).toEqual([]);
    expect(snapshot.state.discardPile.map((card) => card.instanceId)).toContain(hiddenCard.instanceId);
  });

  it('enforces the server deadline without committing a command', () => {
    const executor = enabledExecutor();
    executor.registerMatch(createState(), { turnDeadline: '2026-08-28T11:59:59.000Z' });

    expect(executor.execute('player-1', envelope(1, 0))).toMatchObject({
      status: 'rejected',
      code: 'deadline_expired',
      currentVersion: 0,
    });
    expect(executor.exportEventsForReplay(MATCH_ID)).toEqual([]);
  });

  it('keeps spectator access disabled unless explicitly enabled', () => {
    const state = createState();
    const privateExecutor = enabledExecutor();
    privateExecutor.registerMatch(state);
    expect(privateExecutor.getProjection(MATCH_ID, { kind: 'spectator' })).toBeNull();

    const spectatorExecutor = new InMemoryAuthoritativeGameExecutor({ enabled: true, spectatorsEnabled: true });
    spectatorExecutor.registerMatch(state);
    expect(spectatorExecutor.getProjection(MATCH_ID, { kind: 'spectator' })).toMatchObject({
      matchId: MATCH_ID,
      pendingEffect: null,
    });
  });

  it('reveals and verifies the committed seed only after the match finishes', async () => {
    const state = createState();
    const seedHex = state.privateRandom!.seedHex;
    const seedCommitment = await computeGameSeedCommitment(seedHex);
    const executor = enabledExecutor();
    executor.registerMatch(state, { seedCommitment });
    await expect(executor.revealFinishedMatchSeed(MATCH_ID)).resolves.toBeNull();

    const finished = structuredClone(state);
    finished.phase = 'gameOver';
    finished.winner = 'player-1';
    const finishedExecutor = enabledExecutor();
    finishedExecutor.registerMatch(finished, { seedCommitment });
    await expect(finishedExecutor.revealFinishedMatchSeed(MATCH_ID)).resolves.toEqual({ seedHex, seedCommitment });
  });

  it('replays the accepted event stream to the exact same private state', () => {
    const initialState = createState();
    const executor = enabledExecutor();
    executor.registerMatch(initialState);

    expect(executor.execute('player-1', envelope(1, 0))).toMatchObject({ status: 'accepted' });
    expect(executor.execute('player-1', envelope(2, 1, { type: 'end_turn' }))).toMatchObject({ status: 'accepted' });

    const original = executor.exportPrivateSnapshot(MATCH_ID)!;
    const replayed = replayAuthoritativeEvents(initialState, executor.exportEventsForReplay(MATCH_ID));
    expect(replayed).toEqual(original);
  });

  it('rejects tampered replay metadata', () => {
    const initialState = createState();
    const executor = enabledExecutor();
    executor.registerMatch(initialState);
    executor.execute('player-1', envelope(1, 0));
    const events = executor.exportEventsForReplay(MATCH_ID);
    events[0].sequence = 9;

    expect(() => replayAuthoritativeEvents(initialState, events)).toThrow('Replay event metadata is inconsistent.');
  });
});
