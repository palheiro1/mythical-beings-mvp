import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Lafaic Passive', () => {
  describe('AFTER_PLAYER_SUMMON - Summoning aquatic knowledge onto Lafaic rotates other field knowledges', () => {
    it('should rotate the first other knowledge by 90º when aquatic knowledge is summoned onto Lafaic', () => {
      const p1 = 'player1';
      // P1 has Lafaic (index 0) and Adaro (index 1)
      const initialState = createInitialTestState('game60', ['lafaic', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Manually place an existing knowledge on Adaro slot (index 1)
      const otherCard: Knowledge = { ...createTestKnowledge('terrestrial1'), rotation: 0 };
      const adaroFieldIdx = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroFieldIdx].knowledge = otherCard;
      const beforeRotation = initialState.players[0].field[adaroFieldIdx].knowledge?.rotation; // Should be 0

      // prepare aquatic knowledge for Lafaic summon
      const aquaCard = createTestKnowledge('aquatic1', { cost: 1 });
      initialState.players[0].hand.push(aquaCard);
      initialState.players[0].creatures[0].currentWisdom = 1; // Lafaic wisdom

      // perform summon onto Lafaic (index 0)
      const result = gameReducer(initialState, {
        type: 'SUMMON_KNOWLEDGE',
        payload: { playerId: p1, knowledgeId: aquaCard.id, instanceId: aquaCard.instanceId!, creatureId: 'lafaic' }
      }) as GameState;

      // other field knowledge on Adaro (index 1) should now have rotation = before + 90
      const adaroFieldAfter = result.players[0].field.find(f => f.creatureId === 'adaro');
      expect(adaroFieldAfter?.knowledge?.rotation).toBe((beforeRotation ?? 0) + 90);
      // log should contain Lafaic passive mention
      expect(result.log).toContain(`[Passive Effect] Lafaic (Owner: ${p1}) rotates other knowledges due to aquatic summon.`);
    });

    it('should NOT rotate others when non-aquatic knowledge is summoned onto Lafaic', () => {
      const p1 = 'player1';
      const initialState = createInitialTestState('game61', ['lafaic', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Manually place knowledge on Adaro (index 1)
      const otherCard: Knowledge = { ...createTestKnowledge('terrestrial1'), rotation: 0 };
      const adaroFieldIdx = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroFieldIdx].knowledge = otherCard;
      const beforeRotation = initialState.players[0].field[adaroFieldIdx].knowledge?.rotation; // Should be 0

      // non-aquatic card for Lafaic
      const nonAqua = createTestKnowledge('terrestrial2', { cost: 1 });
      initialState.players[0].hand.push(nonAqua);
      initialState.players[0].creatures[0].currentWisdom = 1; // Lafaic wisdom

      const result = gameReducer(initialState, {
        type: 'SUMMON_KNOWLEDGE',
        payload: { playerId: p1, knowledgeId: nonAqua.id, instanceId: nonAqua.instanceId!, creatureId: 'lafaic' }
      }) as GameState;

      const adaroFieldAfter = result.players[0].field.find(f => f.creatureId === 'adaro');
      expect(adaroFieldAfter?.knowledge?.rotation).toBe(beforeRotation);
      expect(result.log).not.toContain('Lafaic');
    });

    it('should NOT rotate others when aquatic knowledge is summoned onto non-Lafaic slot', () => {
      const p1 = 'player1';
      const initialState = createInitialTestState('game62', ['lafaic', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      // Manually place knowledge on Lafaic (index 0)
      const otherCard: Knowledge = { ...createTestKnowledge('terrestrial1'), rotation: 0 };
      const lafaicFieldIdx = initialState.players[0].field.findIndex(f => f.creatureId === 'lafaic');
      initialState.players[0].field[lafaicFieldIdx].knowledge = otherCard;
      const beforeRotation = initialState.players[0].field[lafaicFieldIdx].knowledge?.rotation; // Should be 0

      // summon aquatic onto Adaro (non-Lafaic, index 1)
      const aqua = createTestKnowledge('aquatic1', { cost: 1 });
      initialState.players[0].hand.push(aqua);
      initialState.players[0].creatures[1].currentWisdom = 1; // Adaro wisdom

      const result = gameReducer(initialState, {
        type: 'SUMMON_KNOWLEDGE',
        payload: { playerId: p1, knowledgeId: aqua.id, instanceId: aqua.instanceId!, creatureId: 'adaro' }
      }) as GameState;

      // Lafaic slot knowledge unchanged
      const lafaicFieldAfter = result.players[0].field.find(f => f.creatureId === 'lafaic');
      expect(lafaicFieldAfter?.knowledge?.rotation).toBe(beforeRotation);
      expect(result.log).not.toContain('Lafaic');
    });
  });
});