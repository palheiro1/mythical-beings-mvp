import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Trempulcahue Passive', () => {
  describe('AFTER_PLAYER_SUMMON - Summoned knowledges gain +1 defense', () => {
    it('should grant +1 defense to any knowledge summoned by owner, regardless of element', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      // P1 has Trempulcahue and Adaro
      const initialState = createInitialTestState('game40', ['trempulcahue', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });
      // Prepare a non-air, non-water knowledge (earth)
      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      initialState.players[0].hand = [earthCard];
      // Ensure Adaro has wisdom to summon onto
      initialState.players[0].creatures[1].currentWisdom = 1;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p1Id,
          knowledgeId: earthCard.id,
          instanceId: earthCard.instanceId!,
          creatureId: 'adaro',
        }
      };
      const stateAfter = gameReducer(initialState, summonAction) as GameState;

      // Passive log should appear indicating defense buff
      expect(stateAfter.log).toContain(
        `[Passive Effect] Trempulcahue (Owner: ${p1Id}) grants +1 defense to summoned knowledge ${earthCard.name}.`
      );
    });

    it('should NOT grant defense when opponent summons a knowledge', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      // P1 has Trempulcahue, P2 summons
      const initialState = createInitialTestState('game41', ['trempulcahue'], ['adaro', 'pele'], {
        currentPlayerIndex: 1,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });
      const airCard = createTestKnowledge('aerial1', { cost: 1 });
      initialState.players[1].hand = [airCard];
      initialState.players[1].creatures[0].currentWisdom = 1;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: {
          playerId: p2Id,
          knowledgeId: airCard.id,
          instanceId: airCard.instanceId!,
          creatureId: 'adaro',
        }
      };
      const stateAfter = gameReducer(initialState, summonAction) as GameState;

      // No passive log for defense from Trempulcahue
      expect(stateAfter.log).not.toContain('Trempulcahue');
    });
  });
});