"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var vitest_1 = require("vitest");
// Mock uuid MUST be the very first statement
vitest_1.vi.mock('uuid', function () { return ({
    v4: vitest_1.vi.fn()
}); });
var vitest_2 = require("vitest");
// Corrected import paths and removed unused imports
var state_1 = require("../game/state");
var creatures_json_1 = require("../assets/creatures.json");
var knowledges_json_1 = require("../assets/knowledges.json");
var uuid_1 = require("uuid"); // Import AFTER the mock
// Helper to find cards
var findCreature = function (id) { return creatures_json_1["default"].find(function (c) { return c.id === id; }); };
var findKnowledge = function (id) { return knowledges_json_1["default"].find(function (k) { return k.id === id; }); };
// Helper to create knowledge with instanceId
var createTestKnowledge = function (id, overrides) {
    if (overrides === void 0) { overrides = {}; }
    var baseKnowledge = findKnowledge(id);
    if (!baseKnowledge)
        throw new Error("Knowledge ".concat(id, " not found for test setup"));
    var instanceId = uuid_1.v4();
    return __assign(__assign(__assign({}, baseKnowledge), { instanceId: instanceId || "fallback-uuid-".concat(id, "-").concat(Math.random()), rotation: 0 }), overrides);
};
// Helper to create a basic test state
var createInitialTestState = function (gameId, p1CreatureIds, p2CreatureIds, modifications) {
    if (gameId === void 0) { gameId = 'test-game'; }
    if (p1CreatureIds === void 0) { p1CreatureIds = ['dudugera', 'adaro']; }
    if (p2CreatureIds === void 0) { p2CreatureIds = ['pele', 'kappa']; }
    if (modifications === void 0) { modifications = {}; }
    var state = (0, state_1.initializeGame)({
        gameId: gameId,
        player1Id: 'player1',
        player2Id: 'player2',
        player1SelectedIds: p1CreatureIds,
        player2SelectedIds: p2CreatureIds
    });
    state = __assign(__assign({}, state), modifications);
    // Apply modifications and cast players back to tuple type
    if (modifications.players) {
        state.players = modifications.players.map(function (p) { return (__assign(__assign({}, p), { field: p.creatures.map(function (c) { return ({ creatureId: c.id, knowledge: null }); }) })); }); // Cast to tuple
    }
    else {
        state.players = state.players.map(function (p) { return (__assign(__assign({}, p), { field: p.creatures.map(function (c) { return ({ creatureId: c.id, knowledge: null }); }) })); }); // Cast to tuple
    }
    return state;
};
// Use real IDs from your data
var player1Id = 'player1';
var player2Id = 'player2';
var dudugeraData = findCreature('dudugera');
var adaroData = findCreature('adaro');
var terrestrial1Data = findKnowledge('terrestrial1');
var aquatic2Data = findKnowledge('aquatic2');
if (!dudugeraData || !adaroData || !terrestrial1Data || !aquatic2Data) {
    throw new Error('Required test data not found in creatures.json or knowledges.json');
}
// Mock console methods before each test
(0, vitest_2.beforeEach)(function () {
    vitest_1.vi.spyOn(console, 'log').mockImplementation(function () { });
    vitest_1.vi.spyOn(console, 'warn').mockImplementation(function () { });
    vitest_1.vi.spyOn(console, 'error').mockImplementation(function () { });
});
// Restore console methods after each test
(0, vitest_2.afterEach)(function () {
    vitest_1.vi.restoreAllMocks();
});
(0, vitest_2.describe)('initializeGame', function () {
    var initialState;
    var mockCounter;
    (0, vitest_2.beforeEach)(function () {
        mockCounter = 0;
        uuid_1.v4.mockImplementation(function () { return "init-game-uuid-".concat(mockCounter++); });
        initialState = (0, state_1.initializeGame)({
            gameId: 'game1',
            player1Id: player1Id,
            player2Id: player2Id,
            player1SelectedIds: [dudugeraData.id, adaroData.id],
            player2SelectedIds: [adaroData.id, dudugeraData.id]
        });
    });
    (0, vitest_2.it)('should create a game state with correct initial values', function () {
        (0, vitest_2.expect)(initialState.gameId).toBe('game1');
        (0, vitest_2.expect)(initialState.players).toHaveLength(2);
        (0, vitest_2.expect)(initialState.players[0].id).toBe(player1Id);
        (0, vitest_2.expect)(initialState.players[1].id).toBe(player2Id);
        (0, vitest_2.expect)(initialState.players[0].creatures[0].id).toBe(dudugeraData.id);
        (0, vitest_2.expect)(initialState.players[1].creatures[0].id).toBe(adaroData.id);
        (0, vitest_2.expect)(initialState.market.length).toBeGreaterThan(0);
        (0, vitest_2.expect)(initialState.knowledgeDeck.length).toBeGreaterThan(0);
        (0, vitest_2.expect)(initialState.turn).toBe(1);
        (0, vitest_2.expect)(['knowledge', 'action']).toContain(initialState.phase);
        (0, vitest_2.expect)(initialState.winner).toBeNull();
    });
    (0, vitest_2.it)('should assign unique instanceIds to all knowledge cards in market and deck', function () {
        var allInstanceIds = new Set();
        var totalCards = 0;
        var missingId = false;
        var checkCard = function (card) {
            if (card) {
                totalCards++;
                if (!card.instanceId || typeof card.instanceId !== 'string') {
                    missingId = true;
                    console.error("Card missing instanceId:", card);
                }
                else {
                    if (allInstanceIds.has(card.instanceId)) {
                        console.error("Duplicate instanceId found:", card.instanceId, card);
                        missingId = true;
                    }
                    allInstanceIds.add(card.instanceId);
                }
            }
        };
        initialState.market.forEach(checkCard);
        initialState.knowledgeDeck.forEach(checkCard);
        initialState.players.forEach(function (p) { return p.hand.forEach(checkCard); });
        (0, vitest_2.expect)(missingId).toBe(false);
        (0, vitest_2.expect)(allInstanceIds.size).toBe(totalCards);
        (0, vitest_2.expect)(totalCards).toBe(initialState.market.length + initialState.knowledgeDeck.length);
        (0, vitest_2.expect)(totalCards).toBeGreaterThan(5);
    });
});
(0, vitest_2.describe)('gameReducer basic actions', function () {
    var state;
    var mockCounter;
    (0, vitest_2.beforeEach)(function () {
        mockCounter = 0;
        uuid_1.v4.mockImplementation(function () { return "basic-action-uuid-".concat(mockCounter++); });
        state = createInitialTestState('game2', [dudugeraData.id, adaroData.id], [adaroData.id, dudugeraData.id]);
        state.phase = 'action';
        state.currentPlayerIndex = 0;
        state.actionsTakenThisTurn = 0;
    });
    (0, vitest_2.it)('should allow Dudugera to summon knowledge without spending an action', function () {
        var _a, _b;
        var knowledgeToSummon = createTestKnowledge(terrestrial1Data.id);
        if (!knowledgeToSummon.instanceId)
            throw new Error("Test setup failed: knowledge instanceId is undefined");
        state.players[0].hand = [knowledgeToSummon];
        var dudugeraCreature = state.players[0].creatures.find(function (c) { return c.id === dudugeraData.id; });
        var dudugeraFieldIndex = state.players[0].field.findIndex(function (f) { return f.creatureId === dudugeraData.id; });
        (0, vitest_2.expect)(dudugeraCreature).toBeDefined();
        (0, vitest_2.expect)(dudugeraFieldIndex).not.toBe(-1);
        if (!dudugeraCreature || dudugeraFieldIndex === -1)
            return;
        dudugeraCreature.currentWisdom = knowledgeToSummon.cost;
        state.players[0].field[dudugeraFieldIndex].knowledge = null;
        var summonAction = {
            type: "SUMMON_KNOWLEDGE",
            payload: {
                playerId: player1Id,
                knowledgeId: knowledgeToSummon.id,
                creatureId: dudugeraData.id,
                instanceId: knowledgeToSummon.instanceId
            }
        };
        var stateAfterSummon = (0, state_1.gameReducer)(state, summonAction);
        (0, vitest_2.expect)(stateAfterSummon).not.toBeNull();
        if (!stateAfterSummon)
            return;
        (0, vitest_2.expect)(stateAfterSummon.actionsTakenThisTurn).toBe(0);
        var dudugeraFieldSlot = stateAfterSummon.players[0].field[dudugeraFieldIndex];
        (0, vitest_2.expect)((_a = dudugeraFieldSlot === null || dudugeraFieldSlot === void 0 ? void 0 : dudugeraFieldSlot.knowledge) === null || _a === void 0 ? void 0 : _a.id).toBe(knowledgeToSummon.id);
        (0, vitest_2.expect)((_b = dudugeraFieldSlot === null || dudugeraFieldSlot === void 0 ? void 0 : dudugeraFieldSlot.knowledge) === null || _b === void 0 ? void 0 : _b.instanceId).toBe(knowledgeToSummon.instanceId);
    });
});
(0, vitest_2.describe)('gameReducer - Market and Deck Logic', function () {
    var state;
    var marketCard;
    var deckCard;
    var mockCounter;
    (0, vitest_2.beforeEach)(function () {
        mockCounter = 0;
        uuid_1.v4.mockImplementation(function () { return "market-deck-uuid-".concat(mockCounter++); });
        marketCard = createTestKnowledge('aerial1');
        var marketCard2 = createTestKnowledge('aerial2');
        deckCard = createTestKnowledge('terrestrial1');
        var deckCard2 = createTestKnowledge('aquatic1');
        state = createInitialTestState('market-deck-test', ['dudugera'], ['pele']);
        state.currentPlayerIndex = 0;
        state.phase = 'action';
        state.actionsTakenThisTurn = 0;
        state.market = [marketCard, marketCard2];
        state.knowledgeDeck = [deckCard, deckCard2];
        state.players[0].hand = [];
        state.players[1].hand = [];
    });
    (0, vitest_2.it)('should refill market from deck after DRAW_KNOWLEDGE if deck is not empty', function () {
        var initialMarketSize = state.market.length;
        var initialDeckSize = state.knowledgeDeck.length;
        if (!marketCard.instanceId)
            throw new Error("Test setup failed: marketCard instanceId is undefined");
        var drawAction = {
            type: 'DRAW_KNOWLEDGE',
            payload: {
                playerId: 'player1',
                knowledgeId: marketCard.instanceId,
                instanceId: marketCard.instanceId
            }
        };
        var nextState = (0, state_1.gameReducer)(state, drawAction);
        (0, vitest_2.expect)(nextState).not.toBeNull();
        if (!nextState)
            return;
        (0, vitest_2.expect)(nextState.players[0].hand).toHaveLength(1);
        (0, vitest_2.expect)(nextState.players[0].hand[0].instanceId).toBe(marketCard.instanceId);
        (0, vitest_2.expect)(nextState.market).toHaveLength(initialMarketSize);
        (0, vitest_2.expect)(nextState.market.some(function (k) { return k.instanceId === marketCard.instanceId; })).toBe(false);
        (0, vitest_2.expect)(nextState.market.some(function (k) { return k.instanceId === deckCard.instanceId; })).toBe(true);
        (0, vitest_2.expect)(nextState.knowledgeDeck).toHaveLength(initialDeckSize - 1);
    });
    (0, vitest_2.it)('should NOT refill market after DRAW_KNOWLEDGE if deck is empty', function () {
        state.knowledgeDeck = [];
        var initialMarketSize = state.market.length;
        if (!marketCard.instanceId)
            throw new Error("Test setup failed: marketCard instanceId is undefined");
        var drawAction = {
            type: 'DRAW_KNOWLEDGE',
            payload: {
                playerId: 'player1',
                knowledgeId: marketCard.instanceId,
                instanceId: marketCard.instanceId
            }
        };
        var nextState = (0, state_1.gameReducer)(state, drawAction);
        (0, vitest_2.expect)(nextState).not.toBeNull();
        if (!nextState)
            return;
        (0, vitest_2.expect)(nextState.players[0].hand).toHaveLength(1);
        (0, vitest_2.expect)(nextState.players[0].hand[0].instanceId).toBe(marketCard.instanceId);
        (0, vitest_2.expect)(nextState.market).toHaveLength(initialMarketSize - 1);
        (0, vitest_2.expect)(nextState.market.some(function (k) { return k.instanceId === marketCard.instanceId; })).toBe(false);
        (0, vitest_2.expect)(nextState.knowledgeDeck).toHaveLength(0);
    });
});
(0, vitest_2.describe)('gameReducer - Passive Abilities', function () {
    var state;
    var mockCounter;
    (0, vitest_2.beforeEach)(function () {
        mockCounter = 0;
        uuid_1.v4.mockImplementation(function () { return "passive-test-uuid-".concat(mockCounter++); });
    });
    (0, vitest_2.it)('Japinunus: should grant +1 power when owner summons air knowledge', function () {
        var japinunusId = 'japinunus';
        var airKnowledgeId = 'aerial1';
        state = createInitialTestState('japinunus-passive-test', [japinunusId, 'adaro'], ['kappa', 'dudugera']);
        state.currentPlayerIndex = 0;
        state.phase = 'action';
        var airKnowledge = createTestKnowledge(airKnowledgeId);
        if (!airKnowledge.instanceId)
            throw new Error("Test setup failed: airKnowledge instanceId is undefined");
        state.players[0].hand = [airKnowledge];
        var japinunusCreature = state.players[0].creatures.find(function (c) { return c.id === japinunusId; });
        var japinunusFieldIndex = state.players[0].field.findIndex(function (f) { return f.creatureId === japinunusId; });
        (0, vitest_2.expect)(japinunusCreature).toBeDefined();
        (0, vitest_2.expect)(japinunusFieldIndex).not.toBe(-1);
        if (!japinunusCreature || japinunusFieldIndex === -1)
            throw new Error("Japinunus setup failed");
        japinunusCreature.currentWisdom = airKnowledge.cost;
        var summonAction = {
            type: 'SUMMON_KNOWLEDGE',
            payload: {
                playerId: 'player1',
                knowledgeId: airKnowledge.id,
                creatureId: japinunusId,
                instanceId: airKnowledge.instanceId
            }
        };
        var newState = (0, state_1.gameReducer)(state, summonAction);
        (0, vitest_2.expect)(newState).not.toBeNull();
        if (!newState)
            throw new Error("Reducer returned null");
        (0, vitest_2.expect)(newState.log.some(function (l) { return l.includes("[Passive Effect] Japinunus (Owner: ".concat(player1Id, ") grants +1 Power due to summoning ").concat(airKnowledge.name)); })).toBe(true);
        (0, vitest_2.expect)(newState.players[0].power).toBe(state.players[0].power + 1);
    });
});
