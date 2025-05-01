import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Passive Interactions', () => {

  describe('Scenario 1: Multiple TURN_START Passives', () => {
    it('should trigger Caapora and Zhar-Ptitsa at turn start, followed by knowledge phase draw', () => {
      const p1Id = 'player1';
      const p2Id = 'player2';
      // P1 has Caapora and Zhar-Ptitsa
      const initialState = createInitialTestState('interaction1', ['caapora', 'zhar-ptitsa'], ['pele'], {
        currentPlayerIndex: 1, // P2's turn
        phase: 'action',
        actionsTakenThisTurn: 2, // P2 finished actions
      });
      // P2 (opponent) has more cards than P1
      initialState.players[1].hand = [createTestKnowledge('terrestrial1'), createTestKnowledge('aerial1')];
      initialState.players[0].hand = [createTestKnowledge('aquatic1')];

      const p2PowerBefore = initialState.players[1].power;
      const p1HandBefore = initialState.players[0].hand.length; // 1
      const marketBefore = initialState.market.length;
      const deckBefore = initialState.knowledgeDeck.length;
      const marketCardToDraw = initialState.market[0];

      // Trigger turn start for P1
      const result = gameReducer(initialState, { type: 'END_TURN', payload: { playerId: p2Id } }) as GameState;

      // Check Caapora effect
      expect(result.players[1].power).toBe(p2PowerBefore - 1);
      expect(result.log).toContain(`[Passive Effect] Caapora (Owner: ${p1Id}) deals 1 damage to ${p2Id}.`);

      // Check Zhar-Ptitsa effect + Knowledge Phase Draw
      // Expect hand size to increase by 2 (1 passive + 1 knowledge phase)
      expect(result.players[0].hand.length).toBe(p1HandBefore + 2);
      // Check that the card drawn by Zhar-Ptitsa is present
      expect(result.players[0].hand).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: marketCardToDraw.instanceId })
      ]));
      // Market refilled once by Zhar-Ptitsa, once by knowledge phase draw
      expect(result.market.length).toBe(marketBefore);
      expect(result.knowledgeDeck.length).toBe(deckBefore - 2); // 2 cards drawn total
      expect(result.log).toContain(`[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id}) triggers free draw.`);
      expect(result.log).toContain(`[Passive Effect] Zhar-Ptitsa (Owner: ${p1Id}) draws ${marketCardToDraw.name}.`);
      // Check for knowledge phase draw log (assuming it exists)
      // Note: The exact log message for knowledge phase draw might differ. Adjust if needed.
      expect(result.log).toContain(`[Game] ${p1Id} drew`); // General check for the second draw
    });
  });

  describe('Scenario 2: AFTER_PLAYER_SUMMON (Owner) vs AFTER_OPPONENT_SUMMON (Opponent)', () => {
    it('should trigger Kyzy (P1) and Tarasca (P2) when P2 summons earth', () => {
      const p1Id = 'player1'; // Kyzy owner
      const p2Id = 'player2'; // Tarasca owner and summoner
      const initialState = createInitialTestState('interaction2', ['kyzy'], ['tarasca', 'adaro'], {
        currentPlayerIndex: 1, // P2's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const earthCard = createTestKnowledge('terrestrial1', { cost: 1 });
      const otherCardP2 = createTestKnowledge('aerial1', { cost: 1 }); // Card for P2 to discard
      initialState.players[1].hand = [earthCard, otherCardP2];
      initialState.players[0].hand = []; // P1 starts with empty hand
      initialState.players[1].creatures.find(c => c.id === 'adaro')!.currentWisdom = 1;

      const p1HandBefore = initialState.players[0].hand.length; // 0
      const p2HandBefore = initialState.players[1].hand.length; // 2
      const p2PowerBefore = initialState.players[1].power;
      const discardBefore = initialState.discardPile.length;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: { playerId: p2Id, knowledgeId: earthCard.id, instanceId: earthCard.instanceId!, creatureId: 'adaro' }
      };
      const result = gameReducer(initialState, summonAction) as GameState;

      // Check Kyzy effect (forces P2 - opponent of Kyzy owner - to discard)
      expect(result.players[0].hand.length).toBe(p1HandBefore); // P1 hand unchanged
      expect(result.players[1].hand.length).toBe(p2HandBefore - 2); // P2 summoned 1, discarded 1
      expect(result.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: otherCardP2.instanceId }) // P2 discarded otherCardP2
      ]));
      expect(result.log).toContain(`[Passive Effect] Kyzy (Owner: ${p1Id}) forces discard from opponent ${p2Id}.`);
      expect(result.log).toContain(`[Passive Effect] ${p2Id} discarded ${otherCardP2.name} due to Kyzy passive.`);

      // Check Tarasca effect (damages P2 - summoner)
      expect(result.players[1].power).toBe(p2PowerBefore - 1);
      expect(result.log).toContain(`[Passive Effect] Tarasca (Owner: ${p2Id}) deals 1 damage to ${p2Id}.`);

      // Check discard pile size (only P2 discarded)
      expect(result.discardPile.length).toBe(discardBefore + 1);
    });
  });

  describe('Scenario 3: AFTER_PLAYER_SUMMON (Owner) vs AFTER_SUMMON (Any)', () => {
    it('should trigger Pele (P1) and Kyzy (P2) when P1 summons earth', () => {
      const p1Id = 'player1'; // Pele owner and summoner
      const p2Id = 'player2'; // Kyzy owner
      const initialState = createInitialTestState('interaction3', ['pele', 'adaro'], ['kyzy', 'lisovik'], {
        currentPlayerIndex: 0, // P1's turn
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const earthCard = createTestKnowledge('terrestrial2', { cost: 2 });
      initialState.players[0].hand = [earthCard];
      initialState.players[0].creatures.find(c => c.id === 'adaro')!.currentWisdom = 2;

      const lowerCostKnowledgeP2 = createTestKnowledge('aerial1', { cost: 1 }); // To be discarded by Pele
      const otherCardP1 = createTestKnowledge('aquatic1', { cost: 1 }); // Card for P1 to discard due to Kyzy
      const lisovikFieldIdxP2 = initialState.players[1].field.findIndex(f => f.creatureId === 'lisovik');
      initialState.players[1].field[lisovikFieldIdxP2].knowledge = lowerCostKnowledgeP2;
      initialState.players[1].hand = []; // P2 starts with empty hand for this check
      initialState.players[0].hand.push(otherCardP1); // P1 has earthCard and otherCardP1

      const p1HandBefore = initialState.players[0].hand.length; // 2
      const p2HandBefore = initialState.players[1].hand.length; // 0
      const discardBefore = initialState.discardPile.length;
      const lisovikCreatureId = initialState.players[1].field[lisovikFieldIdxP2].creatureId;

      const summonAction = {
        type: 'SUMMON_KNOWLEDGE',
        payload: { playerId: p1Id, knowledgeId: earthCard.id, instanceId: earthCard.instanceId!, creatureId: 'adaro' }
      };
      const result = gameReducer(initialState, summonAction) as GameState;

      // Check Pele effect (discards P2's lower cost knowledge)
      expect(result.players[1].field[lisovikFieldIdxP2].knowledge).toBeNull();
      expect(result.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: lowerCostKnowledgeP2.instanceId })
      ]));
      expect(result.log).toContain(`[Passive Effect] Pele (Owner: ${p1Id}) discards ${lowerCostKnowledgeP2.name} (Cost: ${lowerCostKnowledgeP2.cost}) from opponent ${p2Id}'s ${lisovikCreatureId}.`);

      // Check Kyzy effect (forces P1 - opponent of Kyzy owner - to discard from hand)
      expect(result.players[1].hand.length).toBe(p2HandBefore); // P2 hand unchanged
      expect(result.players[0].hand.length).toBe(p1HandBefore - 2); // P1 summoned 1, discarded 1
      expect(result.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: otherCardP1.instanceId }) // P1 discarded otherCardP1
      ]));
      expect(result.log).toContain(`[Passive Effect] Kyzy (Owner: ${p2Id}) forces discard from opponent ${p1Id}.`);
      expect(result.log).toContain(`[Passive Effect] ${p1Id} discarded ${otherCardP1.name} due to Kyzy passive.`);

      // Check P1 hand size (already checked)
      // Check discard pile size (Pele + Kyzy)
      expect(result.discardPile.length).toBe(discardBefore + 2);
    });
  });

  describe('Scenario 4: Multiple KNOWLEDGE_LEAVE Passives', () => {
    it('should trigger Lisovik but not Tsenehale when earth knowledge leaves', () => {
      const p1Id = 'player1'; // Owner of Lisovik and Tsenehale
      const p2Id = 'player2';
      const initialState = createInitialTestState('interaction4a', ['lisovik', 'tsenehale'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const earthKnowledge: Knowledge = { ...createTestKnowledge('terrestrial1'), rotation: 270 }; // Ready to leave
      const lisovikFieldIdx = initialState.players[0].field.findIndex(f => f.creatureId === 'lisovik');
      initialState.players[0].field[lisovikFieldIdx].knowledge = earthKnowledge;

      const p1PowerBefore = initialState.players[0].power;
      const p2PowerBefore = initialState.players[1].power;
      const discardBefore = initialState.discardPile.length;

      // Trigger knowledge leave via rotation
      const result = gameReducer(initialState, { type: 'ROTATE_KNOWLEDGE', payload: { playerId: p1Id, creatureId: 'lisovik' } }) as GameState;

      // Check Lisovik effect (damages P2)
      expect(result.players[1].power).toBe(p2PowerBefore - 1);
      expect(result.log).toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage to ${p2Id}`);

      // Check Tsenehale effect (no power gain for P1)
      expect(result.players[0].power).toBe(p1PowerBefore);
      expect(result.log).not.toContain(`[Passive Effect] Tsenehale`);

      // Check knowledge left field and went to discard
      expect(result.players[0].field[lisovikFieldIdx].knowledge).toBeNull();
      expect(result.discardPile.length).toBe(discardBefore + 1);
      expect(result.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: earthKnowledge.instanceId })
      ]));
    });

    it('should trigger Tsenehale but not Lisovik when air knowledge leaves', () => {
      const p1Id = 'player1'; // Owner of Lisovik and Tsenehale
      const p2Id = 'player2';
      const initialState = createInitialTestState('interaction4b', ['lisovik', 'tsenehale'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'action',
        actionsTakenThisTurn: 0,
      });

      const airKnowledge: Knowledge = { ...createTestKnowledge('aerial1'), rotation: 270 }; // Ready to leave
      const tsenehaleFieldIdx = initialState.players[0].field.findIndex(f => f.creatureId === 'tsenehale');
      initialState.players[0].field[tsenehaleFieldIdx].knowledge = airKnowledge;

      const p1PowerBefore = initialState.players[0].power;
      const p2PowerBefore = initialState.players[1].power;
      const discardBefore = initialState.discardPile.length;

      // Trigger knowledge leave via rotation
      const result = gameReducer(initialState, { type: 'ROTATE_KNOWLEDGE', payload: { playerId: p1Id, creatureId: 'tsenehale' } }) as GameState;

      // Check Lisovik effect (no damage to P2)
      expect(result.players[1].power).toBe(p2PowerBefore);
      expect(result.log).not.toContain(`[Passive Effect] Lisovik`);

      // Check Tsenehale effect (P1 gains power)
      expect(result.players[0].power).toBe(p1PowerBefore + 1);
      expect(result.log).toContain(`[Passive Effect] Tsenehale (Owner: ${p1Id}) grants +1 Power to owner`);

      // Check knowledge left field and went to discard
      expect(result.players[0].field[tsenehaleFieldIdx].knowledge).toBeNull();
      expect(result.discardPile.length).toBe(discardBefore + 1);
      expect(result.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: airKnowledge.instanceId })
      ]));
    });
  });

});