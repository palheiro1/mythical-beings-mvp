import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Tarasca Passive', () => {
  describe('AFTER_OPPONENT_SUMMON - Opponent summons terrestrial knowledge', () => {
    it('should deal 1 damage to opponent when they summon terrestrial knowledge', () => {
      const p1Id = 'player1'; // Tarasca owner
      const p2Id = 'player2'; // Opponent summoner
      // P1 has Tarasca, P2 has Adaro
      const initialState = createInitialTestState('game36', ['tarasca'], ['adaro'], {
        currentPlayerIndex: 1, // Player 2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });
      // Give opponent a terrestrial knowledge card in hand
      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[1].hand = [earthCard];
      initialState.players[1].creatures[0].currentWisdom = 1;

      const beforePower = initialState.players[1].power;
      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id,
          knowledgeId: earthCard.id,
          instanceId: earthCard.instanceId!,
          creatureId: 'adaro',
        }
      };

      const result = gameReducer(initialState, summonAction) as GameState;
      // Opponent should take 1 damage from Tarasca passive
      expect(result.players[1].power).toBe(beforePower - 1);
      expect(result.log).toContain(
        `[Passive Effect] Tarasca (Owner: ${p1Id}) deals 1 damage to ${p2Id}. Power: ${beforePower} -> ${beforePower - 1}`
      );
    });

    it('should NOT deal damage when opponent summons non-terrestrial knowledge', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game37', ['tarasca'], ['adaro'], {
        currentPlayerIndex: 1,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });
      const airCard = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [airCard];
      initialState.players[1].creatures[0].currentWisdom = 1;

      const beforePower = initialState.players[1].power;
      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id,
          knowledgeId: airCard.id,
          instanceId: airCard.instanceId!,
          creatureId: 'adaro',
        }
      };

      const result = gameReducer(initialState, summonAction) as GameState;
      expect(result.players[1].power).toBe(beforePower);
      expect(result.log).not.toContain('Tarasca');
    });

    it('should NOT deal damage when owner summons terrestrial knowledge', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      const initialState = createInitialTestState('game38', ['tarasca', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });
      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [earthCard];
      initialState.players[0].creatures[1].currentWisdom = 1;

      const beforePower = initialState.players[1].power;
      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: earthCard.id,
          instanceId: earthCard.instanceId!,
          creatureId: 'adaro',
        }
      };

      const result = gameReducer(initialState, summonAction) as GameState;
      expect(result.players[1].power).toBe(beforePower);
      expect(result.log).not.toContain('Tarasca');
    });
  });
});