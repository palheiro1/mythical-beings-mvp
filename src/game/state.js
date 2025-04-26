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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.gameReducer = exports.initializeGame = exports.injectInstanceIds = void 0;
var rules_1 = require("./rules");
var actions_1 = require("./actions");
var passives_1 = require("./passives");
var knowledges_json_1 = require("../assets/knowledges.json");
var creatures_json_1 = require("../assets/creatures.json");
var utils_1 = require("./utils");
var uuid_1 = require("uuid");
// Constants
var INITIAL_POWER = 20;
var MARKET_SIZE = 5;
var ACTIONS_PER_TURN = 2;
var ALL_CREATURES = creatures_json_1["default"];
// Helper functions
function shuffleArray(array) {
    var _a;
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        _a = [array[j], array[i]], array[i] = _a[0], array[j] = _a[1];
    }
    return array;
}
// Export for testing purposes
function injectInstanceIds(state) {
    var ensureInstanceId = function (card) { return (__assign(__assign({}, card), { instanceId: card.instanceId || (0, uuid_1.v4)() })); };
    return __assign(__assign({}, state), { market: state.market.map(ensureInstanceId), knowledgeDeck: state.knowledgeDeck.map(ensureInstanceId), discardPile: state.discardPile.map(ensureInstanceId), players: state.players.map(function (p) { return (__assign(__assign({}, p), { hand: p.hand.map(ensureInstanceId), field: p.field.map(function (slot) {
                return slot.knowledge
                    ? { creatureId: slot.creatureId, knowledge: ensureInstanceId(slot.knowledge) }
                    : slot;
            }) })); }) });
}
exports.injectInstanceIds = injectInstanceIds;
var lookupCreatures = function (ids, allCreatures) {
    var foundCreatures = ids.map(function (id) { return allCreatures.find(function (c) { return c.id === id; }); }).filter(function (c) { return !!c; });
    if (foundCreatures.length !== ids.length) {
        console.error("Could not find all selected creatures! IDs:", ids, "Found:", foundCreatures);
        throw new Error("Failed to initialize game: Could not find all selected creatures for IDs: ".concat(ids.join(', ')));
    }
    // Re-add deep clone to ensure creature data is independent
    return JSON.parse(JSON.stringify(foundCreatures));
};
var initialPlayerState = function (id, creatures) { return ({
    id: id,
    power: INITIAL_POWER,
    creatures: creatures.map(function (c) { return (__assign(__assign({}, c), { currentWisdom: c.baseWisdom, rotation: 0 })); }),
    hand: [],
    field: creatures.map(function (c) { return ({ creatureId: c.id, knowledge: null }); }),
    selectedCreatures: creatures
}); };
function initializeGame(payload) {
    var gameId = payload.gameId, player1Id = payload.player1Id, player2Id = payload.player2Id, player1SelectedIds = payload.player1SelectedIds, player2SelectedIds = payload.player2SelectedIds;
    var selectedCreaturesP1 = lookupCreatures(player1SelectedIds, ALL_CREATURES);
    var selectedCreaturesP2 = lookupCreatures(player2SelectedIds, ALL_CREATURES);
    var fullDeck = [];
    knowledges_json_1["default"].forEach(function (card) {
        var copies = 0;
        switch (card.cost) {
            case 1:
            case 2:
                copies = 4;
                break;
            case 3:
                copies = 3;
                break;
            case 4:
            case 5:
                copies = 2;
                break;
            default:
                copies = 1;
                break;
        }
        for (var i = 0; i < copies; i++) {
            fullDeck.push(__assign(__assign({}, card), { instanceId: (0, uuid_1.v4)() }));
        }
    });
    var shuffledDeck = shuffleArray(fullDeck);
    var initialMarket = shuffledDeck.slice(0, MARKET_SIZE);
    var remainingDeck = shuffledDeck.slice(MARKET_SIZE);
    var initialState = {
        gameId: gameId,
        players: [
            initialPlayerState(player1Id, selectedCreaturesP1),
            initialPlayerState(player2Id, selectedCreaturesP2),
        ],
        knowledgeDeck: remainingDeck,
        market: initialMarket,
        discardPile: [],
        currentPlayerIndex: 0,
        turn: 1,
        phase: 'knowledge',
        actionsTakenThisTurn: 0,
        actionsPerTurn: ACTIONS_PER_TURN,
        winner: null,
        log: ["Game ".concat(gameId, " initialized. Player 1 starts.")],
        blockedSlots: { 0: [], 1: [] }
    };
    initialState = (0, passives_1.applyPassiveAbilities)(initialState, 'TURN_START', { playerId: initialState.players[0].id });
    initialState = (0, rules_1.executeKnowledgePhase)(initialState);
    var winner = (0, rules_1.checkWinCondition)(initialState);
    if (winner) {
        initialState = __assign(__assign({}, initialState), { winner: winner, phase: 'end', log: __spreadArray(__spreadArray([], initialState.log, true), ["Player ".concat(winner, " wins!")], false) });
    }
    var finalState = injectInstanceIds(initialState);
    console.log("[Reducer] INITIALIZE_GAME completed. Initial state:", finalState);
    return finalState;
}
exports.initializeGame = initializeGame;
function endTurnSequence(state) {
    console.log("[Reducer] Starting endTurnSequence for Player ".concat(state.players[state.currentPlayerIndex].id));
    var newState = JSON.parse(JSON.stringify(state));
    var winner = (0, rules_1.checkWinCondition)(newState);
    if (winner) {
        console.log("[Reducer] Win condition met at start of endTurnSequence. Winner: ".concat(winner));
        return __assign(__assign({}, newState), { winner: winner, phase: 'end', log: __spreadArray(__spreadArray([], newState.log, true), ["Player ".concat(winner, " wins!")], false) });
    }
    var nextPlayerIndex = ((newState.currentPlayerIndex + 1) % 2);
    var nextTurn = newState.currentPlayerIndex === 1 ? newState.turn + 1 : newState.turn;
    var nextPlayerId = newState.players[nextPlayerIndex].id;
    newState = __assign(__assign({}, newState), { currentPlayerIndex: nextPlayerIndex, turn: nextTurn, phase: 'knowledge', actionsTakenThisTurn: 0, log: __spreadArray(__spreadArray([], newState.log, true), ["--- Turn ".concat(nextTurn, " (Player ").concat(nextPlayerId, ") ---")], false) });
    console.log("[Reducer] Transitioning to Turn ".concat(nextTurn, ", Player ").concat(nextPlayerId, ". Phase: knowledge"));
    console.log("[Reducer] Applying TURN_START passives for Player ".concat(nextPlayerId));
    newState = (0, passives_1.applyPassiveAbilities)(newState, 'TURN_START', { playerId: nextPlayerId });
    console.log("[Reducer] Executing knowledge phase for Player ".concat(nextPlayerId));
    newState = (0, rules_1.executeKnowledgePhase)(newState);
    winner = (0, rules_1.checkWinCondition)(newState);
    if (winner) {
        console.log("[Reducer] Win condition met after knowledge phase for Player ".concat(nextPlayerId, ". Winner: ").concat(winner));
        return __assign(__assign({}, newState), { winner: winner, phase: 'end', log: __spreadArray(__spreadArray([], newState.log, true), ["Player ".concat(winner, " wins!")], false) });
    }
    newState.phase = 'action';
    newState.actionsTakenThisTurn = 0;
    newState.log = __spreadArray(__spreadArray([], newState.log, true), ["Turn ".concat(newState.turn, ": Action Phase started.")], false);
    console.log("[Reducer] endTurnSequence complete. New phase: ".concat(newState.phase));
    return newState;
}
function gameReducer(state, action) {
    var _a, _b, _c, _d, _e;
    if (!state) {
        if (action.type === 'SET_GAME_STATE' && action.payload) {
            console.log("[Reducer] Received SET_GAME_STATE on null state.");
            var newState = action.payload;
            return __assign(__assign({}, newState), { actionsTakenThisTurn: (_a = newState.actionsTakenThisTurn) !== null && _a !== void 0 ? _a : 0, actionsPerTurn: (_b = newState.actionsPerTurn) !== null && _b !== void 0 ? _b : ACTIONS_PER_TURN, log: (_c = newState.log) !== null && _c !== void 0 ? _c : [] });
        }
        else {
            console.error("[Reducer] Received action on null state (expected SET_GAME_STATE with payload):", action.type);
            return null;
        }
    }
    console.log("[Reducer] Action: ".concat(action.type), action.payload);
    if (action.type === 'SET_GAME_STATE') {
        console.log('[Reducer] SET_GAME_STATE received payload:', action.payload);
        if (!action.payload) {
            console.warn('[Reducer] SET_GAME_STATE received null payload. Resetting state might require re-initialization.');
            return null;
        }
        var newState = action.payload;
        var actionsTaken = typeof newState.actionsTakenThisTurn === 'number' && !isNaN(newState.actionsTakenThisTurn) ? newState.actionsTakenThisTurn : 0;
        var actionsPer = typeof newState.actionsPerTurn === 'number' && !isNaN(newState.actionsPerTurn) ? newState.actionsPerTurn : ACTIONS_PER_TURN;
        console.log("[Reducer] SET_GAME_STATE - Processed actionsTaken: ".concat(actionsTaken, ", actionsPerTurn: ").concat(actionsPer));
        return __assign(__assign({}, newState), { actionsTakenThisTurn: actionsTaken, actionsPerTurn: actionsPer, log: (_d = newState.log) !== null && _d !== void 0 ? _d : [] });
    }
    var nextState = state;
    var actionConsumed = false;
    if (action.type === 'END_TURN') {
        var validation_1 = (0, rules_1.isValidAction)(state, action);
        if (!validation_1.isValid) {
            console.warn("[Reducer] Invalid action: ".concat(action.type, " - ").concat(validation_1.reason));
            return state;
        }
        console.log("[Reducer] Handling END_TURN action.");
        return endTurnSequence(state);
    }
    if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
        console.error("[Reducer] Action requires a payload with playerId:", action);
        return state;
    }
    var validation = (0, rules_1.isValidAction)(state, action);
    if (!validation.isValid) {
        console.warn("[Reducer] Invalid action: ".concat(action.type, " - ").concat(validation.reason));
        return state;
    }
    nextState = __assign({}, state);
    switch (action.type) {
        case 'ROTATE_CREATURE':
            nextState = (0, actions_1.rotateCreature)(nextState, action.payload);
            actionConsumed = true;
            break;
        case 'DRAW_KNOWLEDGE': {
            if (!('instanceId' in action.payload) || !action.payload.instanceId) {
                console.error("[Reducer] DRAW_KNOWLEDGE requires instanceId in payload:", action);
                return state;
            }
            var cardToDraw = state.market.find(function (k) { return k.instanceId === action.payload.instanceId; });
            nextState = (0, actions_1.drawKnowledge)(nextState, action.payload);
            var eventDataDraw = {
                playerId: action.payload.playerId,
                knowledgeId: action.payload.knowledgeId,
                instanceId: action.payload.instanceId,
                knowledgeCard: cardToDraw
            };
            var drawTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
                ? 'AFTER_PLAYER_DRAW'
                : 'AFTER_OPPONENT_DRAW';
            console.log("[Reducer] Applying ".concat(drawTrigger, " passives."));
            nextState = (0, passives_1.applyPassiveAbilities)(nextState, drawTrigger, eventDataDraw);
            actionConsumed = true;
            break;
        }
        case 'SUMMON_KNOWLEDGE': {
            if (!('instanceId' in action.payload) || !action.payload.instanceId || !('creatureId' in action.payload)) {
                console.error("[Reducer] SUMMON_KNOWLEDGE requires instanceId and creatureId in payload:", action);
                return state;
            }
            var playerSummoning = (0, utils_1.getPlayerState)(state, action.payload.playerId);
            var knowledgeToSummon = playerSummoning === null || playerSummoning === void 0 ? void 0 : playerSummoning.hand.find(function (k) { return k.instanceId === action.payload.instanceId; });
            var targetCreature = playerSummoning === null || playerSummoning === void 0 ? void 0 : playerSummoning.creatures.find(function (c) { return c.id === action.payload.creatureId; });
            nextState = (0, actions_1.summonKnowledge)(nextState, action.payload);
            var isFreeSummon = false;
            var playerAfterSummon = (0, utils_1.getPlayerState)(nextState, action.payload.playerId);
            if ((targetCreature === null || targetCreature === void 0 ? void 0 : targetCreature.id) === 'dudugera' && (playerAfterSummon === null || playerAfterSummon === void 0 ? void 0 : playerAfterSummon.creatures.some(function (c) { return c.id === 'dudugera'; }))) {
                isFreeSummon = true;
                nextState.log = __spreadArray(__spreadArray([], nextState.log, true), ["[Passive Effect] Dudugera allows summoning ".concat((knowledgeToSummon === null || knowledgeToSummon === void 0 ? void 0 : knowledgeToSummon.name) || 'Knowledge', " onto itself without spending an action.")], false);
                console.log("[Reducer] Dudugera passive active: SUMMON_KNOWLEDGE does not consume action.");
            }
            else if ((knowledgeToSummon === null || knowledgeToSummon === void 0 ? void 0 : knowledgeToSummon.element) === 'water' && (playerAfterSummon === null || playerAfterSummon === void 0 ? void 0 : playerAfterSummon.creatures.some(function (c) { return c.id === 'kappa'; }))) {
                isFreeSummon = true;
                nextState.log = __spreadArray(__spreadArray([], nextState.log, true), ["[Passive Effect] Kappa allows summoning aquatic knowledge ".concat((knowledgeToSummon === null || knowledgeToSummon === void 0 ? void 0 : knowledgeToSummon.name) || 'Knowledge', " without spending an action.")], false);
                console.log("[Reducer] Kappa passive active: SUMMON_KNOWLEDGE does not consume action.");
            }
            actionConsumed = !isFreeSummon;
            var eventDataSummon = {
                playerId: action.payload.playerId,
                creatureId: action.payload.creatureId,
                knowledgeId: action.payload.knowledgeId,
                instanceId: action.payload.instanceId,
                knowledgeCard: knowledgeToSummon
            };
            var summonTrigger = action.payload.playerId === state.players[state.currentPlayerIndex].id
                ? 'AFTER_PLAYER_SUMMON'
                : 'AFTER_OPPONENT_SUMMON';
            console.log("[Reducer] Applying ".concat(summonTrigger, " passives."));
            nextState = (0, passives_1.applyPassiveAbilities)(nextState, summonTrigger, eventDataSummon);
            break;
        }
        default:
            console.error("[Reducer] Unhandled valid action type in switch:", action);
            return state;
    }
    var currentActionsPerTurn = (_e = nextState.actionsPerTurn) !== null && _e !== void 0 ? _e : ACTIONS_PER_TURN;
    var newActionsTaken = nextState.actionsTakenThisTurn;
    if (actionConsumed) {
        newActionsTaken++;
        nextState = __assign(__assign({}, nextState), { actionsTakenThisTurn: newActionsTaken, log: __spreadArray(__spreadArray([], nextState.log, true), ["Action ".concat(action.type, " completed. Actions: ").concat(newActionsTaken, "/").concat(currentActionsPerTurn)], false) });
        console.log("[Reducer] Action ".concat(action.type, " processed. Actions taken: ").concat(newActionsTaken, "/").concat(currentActionsPerTurn));
    }
    else {
        console.log("[Reducer] Action ".concat(action.type, " processed (Free). Actions taken: ").concat(newActionsTaken, "/").concat(currentActionsPerTurn));
        nextState = __assign({}, nextState);
        nextState.log = __spreadArray(__spreadArray([], nextState.log, true), ["Action ".concat(action.type, " completed (Free). Actions: ").concat(newActionsTaken, "/").concat(currentActionsPerTurn)], false);
    }
    var winner = (0, rules_1.checkWinCondition)(nextState);
    if (winner) {
        console.log("[Reducer] Win condition met after action ".concat(action.type, ". Winner: ").concat(winner));
        return __assign(__assign({}, nextState), { winner: winner, phase: 'end', log: __spreadArray(__spreadArray([], nextState.log, true), ["Player ".concat(winner, " wins!")], false) });
    }
    if (newActionsTaken >= currentActionsPerTurn) {
        console.log("[Reducer] Action limit reached (".concat(newActionsTaken, "/").concat(currentActionsPerTurn, "). Ending turn."));
        var stateBeforeEnd = __assign(__assign({}, nextState), { log: __spreadArray(__spreadArray([], nextState.log, true), ["Action limit reached (".concat(newActionsTaken, "/").concat(currentActionsPerTurn, "). Ending turn.")], false) });
        return endTurnSequence(stateBeforeEnd);
    }
    return nextState;
}
exports.gameReducer = gameReducer;
