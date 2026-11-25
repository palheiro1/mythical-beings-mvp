import creaturesData from '../assets/creatures.json';
import type {
  AuthoritativeInitializedMatch,
  AuthoritativeInitializationParticipant,
  AuthoritativeInitializationSource,
  AuthoritativeMatchInitializationPort,
} from './authoritativePersistence.js';
import {
  computeGameSeedCommitment,
  createGameRandomState,
  generateGameSeedHex,
} from './random.js';
import { initializeGame } from './state.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_CREATURE_IDS = new Set((creaturesData as Array<{ id: string }>).map((creature) => creature.id));

export type AuthoritativeInitializationRejectionCode =
  | 'multiplayer_disabled'
  | 'session_not_ready'
  | 'session_changed'
  | 'internal_error';

export type AuthoritativeInitializationResult =
  | ({ status: 'created' | 'existing' } & AuthoritativeInitializedMatch)
  | {
      status: 'rejected';
      code: AuthoritativeInitializationRejectionCode;
      message: string;
    };

export interface AuthoritativeInitializationServiceOptions {
  enabled?: boolean;
  persistence: AuthoritativeMatchInitializationPort;
  now?: () => Date;
  generateSeedHex?: () => string;
  turnDurationSeconds?: number;
}

const hasValidSelection = (participant: AuthoritativeInitializationParticipant): boolean => (
  participant.selectedCreatureIds.length === 3
  && new Set(participant.selectedCreatureIds).size === 3
  && participant.selectedCreatureIds.every((creatureId) => KNOWN_CREATURE_IDS.has(creatureId))
);

const validateSource = (
  requestedSessionId: string,
  source: AuthoritativeInitializationSource,
): readonly [AuthoritativeInitializationParticipant, AuthoritativeInitializationParticipant] | null => {
  if (
    source.sessionId !== requestedSessionId
    || source.gameId !== 'card_game'
    || source.modeId !== 'casual'
    || source.status !== 'playing'
    || !source.revision
    || source.revision.length > 128
    || source.participants.length !== 2
  ) {
    return null;
  }

  const participants = [...source.participants].sort((left, right) => left.slot - right.slot);
  const [player1, player2] = participants;
  if (
    player1.slot !== 1
    || player2.slot !== 2
    || !UUID_PATTERN.test(player1.playerId)
    || !UUID_PATTERN.test(player2.playerId)
    || player1.playerId === player2.playerId
    || !hasValidSelection(player1)
    || !hasValidSelection(player2)
  ) {
    return null;
  }
  return [player1, player2];
};

export class AuthoritativeInitializationService {
  private readonly enabled: boolean;
  private readonly persistence: AuthoritativeMatchInitializationPort;
  private readonly now: () => Date;
  private readonly generateSeedHex: () => string;
  private readonly turnDurationSeconds: number;

  constructor(options: AuthoritativeInitializationServiceOptions) {
    this.enabled = options.enabled === true;
    this.persistence = options.persistence;
    this.now = options.now ?? (() => new Date());
    this.generateSeedHex = options.generateSeedHex ?? generateGameSeedHex;
    this.turnDurationSeconds = options.turnDurationSeconds ?? 120;
    if (
      !Number.isSafeInteger(this.turnDurationSeconds)
      || this.turnDurationSeconds < 15
      || this.turnDurationSeconds > 600
    ) {
      throw new Error('Turn duration must be an integer between 15 and 600 seconds.');
    }
  }

  async initialize(sessionId: string): Promise<AuthoritativeInitializationResult> {
    if (!this.enabled) {
      return {
        status: 'rejected',
        code: 'multiplayer_disabled',
        message: 'Multiplayer is not available in this release.',
      };
    }
    if (!UUID_PATTERN.test(sessionId)) {
      return {
        status: 'rejected',
        code: 'session_not_ready',
        message: 'The session is not ready for authoritative initialization.',
      };
    }

    try {
      const source = await this.persistence.loadInitializationSource(sessionId);
      if (!source) {
        return {
          status: 'rejected',
          code: 'session_not_ready',
          message: 'The session is not ready for authoritative initialization.',
        };
      }
      const participants = validateSource(sessionId, source);
      if (!participants) {
        return {
          status: 'rejected',
          code: 'session_not_ready',
          message: 'The session is not ready for authoritative initialization.',
        };
      }

      const [player1, player2] = participants;
      const seedHex = this.generateSeedHex();
      const seedCommitment = await computeGameSeedCommitment(seedHex);
      const state = initializeGame({
        gameId: sessionId,
        player1Id: player1.playerId,
        player2Id: player2.playerId,
        player1SelectedIds: [...player1.selectedCreatureIds],
        player2SelectedIds: [...player2.selectedCreatureIds],
      }, createGameRandomState(seedHex));
      const turnDeadline = new Date(
        this.now().getTime() + this.turnDurationSeconds * 1_000,
      ).toISOString();
      const result = await this.persistence.createMatchIfAbsent({
        sourceRevision: source.revision,
        state,
        seedCommitment,
        turnDeadline,
      });

      switch (result.status) {
        case 'source_changed':
          return {
            status: 'rejected',
            code: 'session_changed',
            message: 'The session changed during initialization. Retry from the current session state.',
          };
        case 'source_missing':
          return {
            status: 'rejected',
            code: 'session_not_ready',
            message: 'The session is not ready for authoritative initialization.',
          };
        case 'created':
        case 'existing':
          return { status: result.status, ...result.match };
      }
    } catch {
      return {
        status: 'rejected',
        code: 'internal_error',
        message: 'The match could not be initialized safely.',
      };
    }
  }
}
