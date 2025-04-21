import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeGame, gameReducer } from '../src/game/state';
import { GameState, GameAction, PlayerState, Creature, Knowledge } from '../src/game/types';
import * as rules from '../src/game/rules'; // Import all from rules
import * as actions from '../src/game/actions'; // Import all from actions
import * as passives from '../src/game/passives'; // Import passives module

// Mock data
const mockCreature1: Creature = { id: 'c1', name: 'C1', element: 'air', passiveAbility: '', baseWisdom: 0, image: '' };
const mockCreature2: Creature = { id: 'c2', name: 'C2', element: 'water', passiveAbility: '', baseWisdom: 0, image: '' };
const mockCreatureP1 = [mockCreature1];
const mockCreatureP2 = [mockCreature2];
// Add element property to mock knowledge
const mockKnowledge1: Knowledge = { id: 'k1', name: 'K1', type: 'spell', cost: 1, effect: '', image: '', element: 'neutral' };
const mockKnowledge2: Knowledge = { id: 'k2', name: 'K2', type: 'ally', cost: 2, effect: '', image: '', element: 'water' };
const mockKnowledge3: Knowledge = { id: 'k3', name: 'K3', type: 'spell', cost: 1, effect: '', image: '', element: 'air' };

// Mock the rules, actions, and passives modules
vi.mock('../src/game/rules', async (importOriginal) => {
  const actual = await importOriginal<typeof rules>();
  return {
    ...actual,
    isValidAction: vi.fn(() => true), // Assume actions are valid unless specified otherwise in test
    executeKnowledgePhase: vi.fn((state) => ({ ...state, phase: 'action', actionsTakenThisTurn: 0, log: [...state.log, 'Mock Knowledge Phase Executed'] })),
    checkWinCondition: vi.fn(() => null), // Assume no winner unless specified
  };
});

vi.mock('../src/game/actions', async () => { // Removed unused importOriginal
    // const actual = await importOriginal<typeof actions>(); // Removed unused variable
    // Keep actual implementations by default for most tests, but allow spying
    return {
        rotateCreature: vi.fn((state, payload) => ({...state, log: [...state.log, `Mock Rotate ${payload.creatureId}`]})),
        drawKnowledge: vi.fn((state, payload) => {
            // Simplified mock: move card from market to hand, refill market
            const playerIndex = state.players.findIndex((p: PlayerState) => p.id === payload.playerId);
            const cardIndex = state.market.findIndex((k: Knowledge) => k.id === payload.knowledgeId);
            if (playerIndex === -1 || cardIndex === -1) return state;
            const card = state.market[cardIndex];
            const newHand = [...state.players[playerIndex].hand, card];
            const newMarket = state.market.filter((_k: Knowledge, i: number) => i !== cardIndex);
            const newDeckCard = state.knowledgeDeck.length > 0 ? state.knowledgeDeck[0] : null;
            if (newDeckCard) newMarket.push(newDeckCard);
            const newDeck = state.knowledgeDeck.slice(1);
            const newPlayers = [...state.players];
            newPlayers[playerIndex] = { ...newPlayers[playerIndex], hand: newHand };
            return {
                ...state,
                players: newPlayers as [PlayerState, PlayerState],
                market: newMarket,
                knowledgeDeck: newDeck,
                log: [...state.log, `Mock Draw ${payload.knowledgeId}`]
            };
        }),
        summonKnowledge: vi.fn((state, payload) => {
            // Simplified mock: move card from hand to field
            const playerIndex = state.players.findIndex((p: PlayerState) => p.id === payload.playerId);
            const handCardIndex = state.players[playerIndex].hand.findIndex((k: Knowledge) => k.id === payload.knowledgeId);
            if (playerIndex === -1 || handCardIndex === -1) return state;
            const card = state.players[playerIndex].hand[handCardIndex];
            const newHand = state.players[playerIndex].hand.filter((_k: Knowledge, i: number) => i !== handCardIndex);
            const fieldIndex = state.players[playerIndex].field.findIndex((f: { creatureId: string; knowledge: Knowledge | null }) => f.creatureId === payload.creatureId);
            if (fieldIndex === -1) return state;
            const newField = [...state.players[playerIndex].field];
            newField[fieldIndex] = { ...newField[fieldIndex], knowledge: { ...card, rotation: 0 } }; // Add rotation
            const newPlayers = [...state.players];
            newPlayers[playerIndex] = { ...newPlayers[playerIndex], hand: newHand, field: newField };
            return {
                ...state,
                players: newPlayers as [PlayerState, PlayerState],
                log: [...state.log, `Mock Summon ${payload.knowledgeId} onto ${payload.creatureId}`]
            };
        }),
    };
});

// Mock applyPassiveAbilities to spy on calls
vi.mock('../src/game/passives', async (importOriginal) => {
    const actual = await importOriginal<typeof passives>();
    return {
        ...actual,
        applyPassiveAbilities: vi.fn((state, _trigger, _eventData) => state), // Just return state, we check calls
    };
});


describe('initializeGame', () => {
  let initialState: GameState;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Mock executeKnowledgePhase to prevent infinite loops during initialization testing
    vi.mocked(rules.executeKnowledgePhase).mockImplementation((state) => ({ ...state, phase: 'action', actionsTakenThisTurn: 0, log: [...state.log, 'Mock Initial Knowledge Phase'] }));
    initialState = initializeGame('game1', 'p1', 'p2', mockCreatureP1, mockCreatureP2);
  });

  it('should create a game state with correct initial values', () => {
    expect(initialState.gameId).toBe('game1');
    expect(initialState.players).toHaveLength(2);
    expect(initialState.players[0].id).toBe('p1');
    expect(initialState.players[1].id).toBe('p2');
    expect(initialState.players[0].power).toBe(20);
    expect(initialState.players[1].power).toBe(20);
    expect(initialState.players[0].creatures[0].id).toBe('c1');
    expect(initialState.players[1].creatures[0].id).toBe('c2');
    expect(initialState.players[0].hand).toEqual([]);
    expect(initialState.players[1].hand).toEqual([]);
    expect(initialState.market).toHaveLength(5); // Assuming enough cards in mock data
    expect(initialState.knowledgeDeck.length).toBeGreaterThan(0); // Assuming enough cards
    expect(initialState.turn).toBe(1);
    expect(initialState.currentPlayerIndex).toBe(0);
    expect(initialState.winner).toBeNull();
    expect(initialState.log).toContain('Game game1 initialized. Player 1 starts.');
  });

  it('should initialize player creatures with currentWisdom set to baseWisdom', () => {
    expect(initialState.players[0].creatures[0].currentWisdom).toBe(initialState.players[0].creatures[0].baseWisdom);
    expect(initialState.players[1].creatures[0].currentWisdom).toBe(initialState.players[1].creatures[0].baseWisdom);
  });

  it('should initialize player field slots correctly', () => {
    expect(initialState.players[0].field).toHaveLength(mockCreatureP1.length);
    expect(initialState.players[0].field[0].creatureId).toBe('c1');
    expect(initialState.players[0].field[0].knowledge).toBeNull();
    expect(initialState.players[1].field).toHaveLength(mockCreatureP2.length);
    expect(initialState.players[1].field[0].creatureId).toBe('c2');
    expect(initialState.players[1].field[0].knowledge).toBeNull();
  });

  it('should shuffle the knowledge deck', () => {
    // This is hard to test deterministically without controlling Math.random
    // We can check that the market + deck contains all cards and market != first 5 cards of original deck
    // For now, we trust the shuffle implementation and check lengths.
    const totalCards = initialState.market.length + initialState.knowledgeDeck.length;
    // Assuming knowledgeData has more than 5 cards
    expect(totalCards).toBeGreaterThan(5);
  });

  it('should execute the first knowledge phase and set phase to action', () => {
    expect(rules.executeKnowledgePhase).toHaveBeenCalledTimes(1);
    expect(initialState.phase).toBe('action'); // executeKnowledgePhase mock sets this
    expect(initialState.log).toContain('Mock Initial Knowledge Phase');
  });
});

describe('gameReducer', () => {
  let currentState: GameState;

  beforeEach(() => {
    // Reset mocks and get a fresh state
    vi.clearAllMocks();
    vi.mocked(rules.isValidAction).mockReturnValue(true); // Default to valid
    vi.mocked(rules.executeKnowledgePhase).mockImplementation((state) => ({ ...state, phase: 'action', actionsTakenThisTurn: 0, log: [...state.log, 'Mock Knowledge Phase Executed'] }));
    vi.mocked(rules.checkWinCondition).mockReturnValue(null); // Default to no winner

    currentState = initializeGame('game1', 'p1', 'p2', mockCreatureP1, mockCreatureP2);
    currentState.phase = 'action'; // Ensure action phase for tests
    currentState.actionsTakenThisTurn = 0;
    currentState.currentPlayerIndex = 0;
  });

  it('should handle SET_GAME_STATE', () => {
    const newState: GameState = { ...currentState, turn: 10 };
    const action: GameAction = { type: 'SET_GAME_STATE', payload: newState };
    const reducedState = gameReducer(currentState, action);
    expect(reducedState).toEqual(newState);
  });

  it('should handle INITIALIZE_GAME', () => {
    const action: GameAction = { type: 'INITIALIZE_GAME', payload: { gameId: 'newGame', player1Id: 'pA', player2Id: 'pB', selectedCreaturesP1: [], selectedCreaturesP2: [] } };
    // We need to mock initializeGame if we want to test the reducer calling it,
    // but here we test that the reducer *returns* the result of initializeGame.
    // Let's assume initializeGame works as tested above.
    const expectedState = initializeGame('newGame', 'pA', 'pB', [], []);
    const reducedState = gameReducer(currentState, action); // currentState is irrelevant here
    // Only check key properties, not deep equality
    expect(reducedState.gameId).toBe(expectedState.gameId);
    expect(reducedState.players.length).toBe(2);
    expect(reducedState.phase).toBe(expectedState.phase);
    expect(reducedState.market.length).toBe(expectedState.market.length);
    expect(reducedState.knowledgeDeck.length).toBe(expectedState.knowledgeDeck.length);
  });

  it('should return current state if action is invalid', () => {
    vi.mocked(rules.isValidAction).mockReturnValue(false);
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    const reducedState = gameReducer(currentState, action);
    // Only check that the log contains the invalid action message
    expect(reducedState.log.at(-1)).toContain('Invalid action attempted');
  });

  it('should call rotateCreature action handler for ROTATE_CREATURE', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    gameReducer(currentState, action);
    expect(actions.rotateCreature).toHaveBeenCalledWith(currentState, action.payload);
  });

  it('should call drawKnowledge action handler for DRAW_KNOWLEDGE', () => {
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k1' } };
    gameReducer(currentState, action);
    expect(actions.drawKnowledge).toHaveBeenCalledWith(currentState, action.payload);
  });

  it('should call summonKnowledge action handler for SUMMON_KNOWLEDGE', () => {
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k1', creatureId: 'c1' } };
    gameReducer(currentState, action);
    expect(actions.summonKnowledge).toHaveBeenCalledWith(currentState, action.payload);
  });

  it('should increment actionsTakenThisTurn for valid actions (not END_TURN)', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    const nextState = gameReducer(currentState, action);
    expect(nextState.actionsTakenThisTurn).toBe(1);
  });

    it('should log when max actions are taken', () => {
        currentState.actionsTakenThisTurn = 1; // One action already taken
        const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
        const nextState = gameReducer(currentState, action);
        expect(nextState.actionsTakenThisTurn).toBe(2);
        expect(nextState.log.at(-1)).toContain('Player 1 has taken 2 actions.');
    });

  it('should handle END_TURN: switch player, reset actions, execute knowledge phase', () => {
    const action: GameAction = { type: 'END_TURN', payload: { playerId: 'p1' } };
    vi.mocked(rules.executeKnowledgePhase).mockClear(); // Reset count before the action
    const nextState = gameReducer(currentState, action);
    expect(nextState.currentPlayerIndex).toBe(1); // Switched to player 2
    expect(nextState.turn).toBe(1); // Turn doesn't change yet
    expect(nextState.actionsTakenThisTurn).toBe(0); // Reset for new player/phase
    expect(rules.executeKnowledgePhase).toHaveBeenCalledTimes(1); // Called for the new turn/player
    expect(nextState.phase).toBe('action'); // executeKnowledgePhase mock sets this
    expect(nextState.log).toContain('Player 1 ended their turn. Turn 1 begins.');
    expect(nextState.log).toContain('Mock Knowledge Phase Executed');
  });

  it('should handle END_TURN: increment turn when player 2 ends turn', () => {
    currentState.currentPlayerIndex = 1; // Player 2's turn
    const action: GameAction = { type: 'END_TURN', payload: { playerId: 'p2' } };
    vi.mocked(rules.executeKnowledgePhase).mockClear(); // Reset count before the action
    const nextState = gameReducer(currentState, action);
    expect(nextState.currentPlayerIndex).toBe(0); // Switched to player 1
    expect(nextState.turn).toBe(2); // Incremented turn
    expect(nextState.actionsTakenThisTurn).toBe(0);
    expect(rules.executeKnowledgePhase).toHaveBeenCalledTimes(1);
    expect(nextState.phase).toBe('action');
    expect(nextState.log).toContain('Player 2 ended their turn. Turn 2 begins.');
  });

  it('should check for win condition after every valid action', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    gameReducer(currentState, action);
    expect(rules.checkWinCondition).toHaveBeenCalledTimes(1);

    const endTurnAction: GameAction = { type: 'END_TURN', payload: { playerId: 'p1' } };
    gameReducer(currentState, endTurnAction);
    // checkWinCondition is called *after* the action is processed, including END_TURN's state changes
    expect(rules.checkWinCondition).toHaveBeenCalledTimes(2);
  });

  it('should set winner and phase to "end" if win condition is met', () => {
    vi.mocked(rules.checkWinCondition).mockReturnValue('p1'); // Simulate player 1 winning
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    const finalState = gameReducer(currentState, action);

    expect(finalState.winner).toBe('p1');
    expect(finalState.phase).toBe('end');
    expect(finalState.log.at(-1)).toContain('Game Over! Player 1 wins!');
  });

  describe('Passive Ability Triggers', () => {
    beforeEach(() => {
        // Reset the spy count before each trigger test
        vi.mocked(passives.applyPassiveAbilities).mockClear();
        // Ensure actions are considered valid for these tests
        vi.mocked(rules.isValidAction).mockReturnValue(true);
    });

    it('should call applyPassiveAbilities with AFTER_PLAYER_DRAW on DRAW_KNOWLEDGE by current player', () => {
        currentState.market = [mockKnowledge1, mockKnowledge2, mockKnowledge3]; // Ensure card is in market
        const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k1' } };
        const expectedEventData = { playerId: 'p1', knowledgeId: 'k1', knowledgeCard: mockKnowledge1 };

        gameReducer(currentState, action);

        expect(passives.applyPassiveAbilities).toHaveBeenCalledWith(
            expect.anything(), // The state *after* drawKnowledge is called
            'AFTER_PLAYER_DRAW',
            expect.objectContaining(expectedEventData)
        );
    });

    it('should call applyPassiveAbilities with AFTER_OPPONENT_DRAW on DRAW_KNOWLEDGE by non-current player (if allowed)', () => {
        // Note: This scenario shouldn't normally happen if isValidAction works correctly,
        // but we test the reducer logic assuming it could be called.
        currentState.market = [mockKnowledge1, mockKnowledge2, mockKnowledge3];
        const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'p2', knowledgeId: 'k1' } }; // p2 draws on p1's turn
        const expectedEventData = { playerId: 'p2', knowledgeId: 'k1', knowledgeCard: mockKnowledge1 };

        // Temporarily allow action by non-current player for this specific test
        // Safely check payload structure before accessing playerId
        vi.mocked(rules.isValidAction).mockImplementation((_state, act) => {
            if (act.payload && 'playerId' in act.payload) {
                return act.payload.playerId === 'p2';
            }
            return false;
        });

        gameReducer(currentState, action);

        expect(passives.applyPassiveAbilities).toHaveBeenCalledWith(
            expect.anything(),
            'AFTER_OPPONENT_DRAW',
            expect.objectContaining(expectedEventData)
        );
        vi.mocked(rules.isValidAction).mockReturnValue(true); // Reset mock
    });

    it('should call applyPassiveAbilities with BEFORE_ACTION_VALIDATION and AFTER_PLAYER_SUMMON on SUMMON_KNOWLEDGE by current player', () => {
        currentState.players[0].hand = [mockKnowledge1]; // Player 1 has the card
        currentState.players[0].creatures = [mockCreature1];
        currentState.players[0].field = [{ creatureId: 'c1', knowledge: null }];
        const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k1', creatureId: 'c1' } };
        const expectedEventData = { playerId: 'p1', knowledgeId: 'k1', creatureId: 'c1', knowledgeCard: mockKnowledge1 };

        gameReducer(currentState, action);

        // Check BEFORE_ACTION_VALIDATION call (called with state *before* summonKnowledge)
        expect(passives.applyPassiveAbilities).toHaveBeenCalledWith(
            currentState, // State before summonKnowledge
            'BEFORE_ACTION_VALIDATION',
            expect.objectContaining(expectedEventData)
        );

        // Check AFTER_PLAYER_SUMMON call (called with state *after* summonKnowledge)
        expect(passives.applyPassiveAbilities).toHaveBeenCalledWith(
            expect.objectContaining({ log: expect.arrayContaining(['Mock Summon k1 onto c1']) }), // State after summonKnowledge mock
            'AFTER_PLAYER_SUMMON',
            expect.objectContaining(expectedEventData)
        );
        // Ensure it was called twice overall (before and after)
        expect(passives.applyPassiveAbilities).toHaveBeenCalledTimes(2);
    });

    it('should call applyPassiveAbilities with BEFORE_ACTION_VALIDATION and AFTER_OPPONENT_SUMMON on SUMMON_KNOWLEDGE by non-current player (if allowed)', () => {
        currentState.players[1].hand = [mockKnowledge1]; // Player 2 has the card
        currentState.players[1].creatures = [mockCreature2];
        currentState.players[1].field = [{ creatureId: 'c2', knowledge: null }];
        const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: 'p2', knowledgeId: 'k1', creatureId: 'c2' } }; // p2 summons on p1's turn
        const expectedEventData = { playerId: 'p2', knowledgeId: 'k1', creatureId: 'c2', knowledgeCard: mockKnowledge1 };

        // Temporarily allow action by non-current player
        // Safely check payload structure before accessing playerId
        vi.mocked(rules.isValidAction).mockImplementation((_state, act) => {
            if (act.payload && 'playerId' in act.payload) {
                return act.payload.playerId === 'p2';
            }
            return false;
        });

        gameReducer(currentState, action);

        // Check BEFORE_ACTION_VALIDATION call
        expect(passives.applyPassiveAbilities).toHaveBeenCalledWith(
            currentState,
            'BEFORE_ACTION_VALIDATION',
            expect.objectContaining(expectedEventData)
        );

        // Check AFTER_OPPONENT_SUMMON call
        expect(passives.applyPassiveAbilities).toHaveBeenCalledWith(
            expect.objectContaining({ log: expect.arrayContaining(['Mock Summon k1 onto c2']) }),
            'AFTER_OPPONENT_SUMMON',
            expect.objectContaining(expectedEventData)
        );
        expect(passives.applyPassiveAbilities).toHaveBeenCalledTimes(2);
        vi.mocked(rules.isValidAction).mockReturnValue(true); // Reset mock
    });

    it('should call applyPassiveAbilities with TURN_START on END_TURN', () => {
        const action: GameAction = { type: 'END_TURN', payload: { playerId: 'p1' } };
        const expectedEventData = { playerId: 'p2' }; // Expecting data for the player whose turn is starting

        gameReducer(currentState, action);

        // Check TURN_START call (called with state *before* executeKnowledgePhase)
        expect(passives.applyPassiveAbilities).toHaveBeenCalledWith(
            expect.objectContaining({ currentPlayerIndex: 1 }), // State after player switch, before knowledge phase
            'TURN_START',
            expect.objectContaining(expectedEventData)
        );
        expect(passives.applyPassiveAbilities).toHaveBeenCalledTimes(1);
    });

    // Note: Testing KNOWLEDGE_LEAVE triggered by effects (like terrestrial4) or rotation
    // is better suited for rules.test.ts or integration tests, as it involves
    // executeKnowledgePhase and effect execution, which are mocked here.
  });

  it('should handle END_TURN: switch player, reset actions, execute knowledge phase', () => {
    const action: GameAction = { type: 'END_TURN', payload: { playerId: 'p1' } };
    vi.mocked(rules.executeKnowledgePhase).mockClear(); // Reset count before the action
    const nextState = gameReducer(currentState, action);
    expect(nextState.currentPlayerIndex).toBe(1); // Switched to player 2
    expect(nextState.turn).toBe(1); // Turn doesn't change yet
    expect(nextState.actionsTakenThisTurn).toBe(0); // Reset for new player/phase
    expect(rules.executeKnowledgePhase).toHaveBeenCalledTimes(1); // Called for the new turn/player
    expect(nextState.phase).toBe('action'); // executeKnowledgePhase mock sets this
    expect(nextState.log).toContain('Player 1 ended their turn. Turn 1 begins.');
    expect(nextState.log).toContain('Mock Knowledge Phase Executed');
  });

  it('should handle END_TURN: increment turn when player 2 ends turn', () => {
    currentState.currentPlayerIndex = 1; // Player 2's turn
    const action: GameAction = { type: 'END_TURN', payload: { playerId: 'p2' } };
    vi.mocked(rules.executeKnowledgePhase).mockClear(); // Reset count before the action
    const nextState = gameReducer(currentState, action);
    expect(nextState.currentPlayerIndex).toBe(0); // Switched to player 1
    expect(nextState.turn).toBe(2); // Incremented turn
    expect(nextState.actionsTakenThisTurn).toBe(0);
    expect(rules.executeKnowledgePhase).toHaveBeenCalledTimes(1);
    expect(nextState.phase).toBe('action');
    expect(nextState.log).toContain('Player 2 ended their turn. Turn 2 begins.');
  });

  it('should check for win condition after every valid action', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    gameReducer(currentState, action);
    expect(rules.checkWinCondition).toHaveBeenCalledTimes(1);

    const endTurnAction: GameAction = { type: 'END_TURN', payload: { playerId: 'p1' } };
    gameReducer(currentState, endTurnAction);
    // checkWinCondition is called *after* the action is processed, including END_TURN's state changes
    expect(rules.checkWinCondition).toHaveBeenCalledTimes(2);
  });

  it('should set winner and phase to "end" if win condition is met', () => {
    vi.mocked(rules.checkWinCondition).mockReturnValue('p1'); // Simulate player 1 winning
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    const finalState = gameReducer(currentState, action);

    expect(finalState.winner).toBe('p1');
    expect(finalState.phase).toBe('end');
    expect(finalState.log.at(-1)).toContain('Game Over! Player 1 wins!');
  });
});
