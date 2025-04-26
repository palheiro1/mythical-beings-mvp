"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.useGameActions = void 0;
var react_1 = require("react");
var state_1 = require("../game/state");
var supabase_1 = require("../utils/supabase");
var rules_1 = require("../game/rules");
function useGameActions(currentGameState, gameId, dispatch, currentPlayerId, selectedKnowledgeId) {
    var _this = this;
    var isProcessing = (0, react_1.useRef)(false);
    var handleAction = (0, react_1.useCallback)(function (action) { return __awaiter(_this, void 0, void 0, function () {
        var validationResult, nextState, updateSuccessful, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (action.type !== 'SET_GAME_STATE' && (!currentGameState || !currentPlayerId || !gameId)) {
                        console.error("[handleAction] Cannot process action: Missing game state, player ID, or game ID.", { currentGameState: currentGameState, currentPlayerId: currentPlayerId, gameId: gameId, actionType: action.type });
                        return [2 /*return*/];
                    }
                    if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
                        if (!action.payload || !('playerId' in action.payload)) {
                            console.error("[handleAction] Action is missing player payload:", action);
                            return [2 /*return*/];
                        }
                    }
                    // Allow END_TURN even if processing, otherwise block concurrent actions
                    if (isProcessing.current && action.type !== 'SET_GAME_STATE' && action.type !== 'END_TURN') {
                        console.warn("[handleAction] Action ".concat(action.type, " blocked, another action is already processing."));
                        return [2 /*return*/];
                    }
                    console.log("[handleAction] Received action: ".concat(action.type), action.payload);
                    if (action.type !== 'SET_GAME_STATE') {
                        isProcessing.current = true;
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
                        if (!currentGameState) {
                            throw new Error("Cannot validate action without current game state.");
                        }
                        console.log("[handleAction] Validating action ".concat(action.type, "..."));
                        validationResult = (0, rules_1.isValidAction)(currentGameState, action);
                        if (!validationResult.isValid) {
                            console.warn("[handleAction] Action ".concat(action.type, " is invalid: ").concat(validationResult.reason || 'No reason provided'));
                            isProcessing.current = false; // Reset processing state if action is invalid
                            return [2 /*return*/];
                        }
                        console.log("[handleAction] Action ".concat(action.type, " is valid."));
                    }
                    if (!(action.type !== 'SET_GAME_STATE')) return [3 /*break*/, 3];
                    if (!currentGameState)
                        throw new Error("Cannot reduce action without current game state.");
                    console.log("[handleAction] Calculating next state locally for action ".concat(action.type, "..."));
                    nextState = (0, state_1.gameReducer)(currentGameState, action);
                    if (!nextState) {
                        throw new Error("Reducer returned null state unexpectedly.");
                    }
                    console.log("[handleAction] Local reducer finished. Next phase: ".concat(nextState.phase, ", Player: ").concat(nextState.currentPlayerIndex, ", Actions: ").concat(nextState.actionsTakenThisTurn));
                    console.log("[handleAction] Persisting updated state to Supabase for action ".concat(action.type, "."));
                    return [4 /*yield*/, (0, supabase_1.updateGameState)(gameId, nextState)];
                case 2:
                    updateSuccessful = _a.sent();
                    if (!updateSuccessful) {
                        console.error("[handleAction] Failed to persist state update to Supabase for action ".concat(action.type, ". Local state might be ahead."));
                    }
                    else {
                        console.log("[handleAction] State successfully persisted for action ".concat(action.type, "."));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    console.log("[handleAction] Dispatching received SET_GAME_STATE.");
                    dispatch(action);
                    _a.label = 4;
                case 4: return [3 /*break*/, 7];
                case 5:
                    error_1 = _a.sent();
                    console.error("[handleAction] Error processing action ".concat(action.type, ":"), error_1);
                    return [3 /*break*/, 7];
                case 6:
                    if (action.type !== 'SET_GAME_STATE') {
                        isProcessing.current = false;
                        console.log("[handleAction] Finished processing action ".concat(action.type, ". isProcessing reset."));
                    }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); }, [currentGameState, dispatch, currentPlayerId, gameId]);
    var handleRotateCreature = (0, react_1.useCallback)(function (creatureId) {
        if (!currentPlayerId)
            return;
        var action = { type: 'ROTATE_CREATURE', payload: { playerId: currentPlayerId, creatureId: creatureId } };
        handleAction(action);
    }, [handleAction, currentPlayerId]);
    var handleDrawKnowledge = (0, react_1.useCallback)(function (knowledgeId) {
        if (!currentPlayerId)
            return;
        if (!currentGameState)
            return;
        var knowledgeCard = currentGameState.market.find(function (k) { return k.id === knowledgeId; });
        if (!knowledgeCard || !knowledgeCard.instanceId)
            return;
        var action = {
            type: 'DRAW_KNOWLEDGE',
            payload: {
                playerId: currentPlayerId,
                knowledgeId: knowledgeId,
                instanceId: knowledgeCard.instanceId
            }
        };
        handleAction(action);
    }, [handleAction, currentPlayerId]);
    var handleHandCardClick = (0, react_1.useCallback)(function (knowledgeId) {
        console.log("[Action] Hand knowledge clicked (handled by GameScreen): ".concat(knowledgeId));
    }, []);
    var handleCreatureClickForSummon = (0, react_1.useCallback)(function (targetCreatureId) {
        if (!currentPlayerId || !selectedKnowledgeId) {
            console.warn("[Action] Cannot summon: Missing player ID or selected knowledge card.");
            return;
        }
        var action = {
            type: 'SUMMON_KNOWLEDGE',
            payload: {
                playerId: currentPlayerId,
                knowledgeId: selectedKnowledgeId,
                creatureId: targetCreatureId,
                instanceId: selectedKnowledgeId // Assuming selectedKnowledgeId is the instanceId
            }
        };
        handleAction(action);
    }, [handleAction, currentPlayerId, selectedKnowledgeId]);
    var handleEndTurn = (0, react_1.useCallback)(function () {
        if (!currentPlayerId)
            return;
        console.log("[handleEndTurn] Triggered (could be manual or timer)");
        var action = { type: 'END_TURN', payload: { playerId: currentPlayerId } };
        handleAction(action);
    }, [handleAction, currentPlayerId]);
    return {
        handleRotateCreature: handleRotateCreature,
        handleDrawKnowledge: handleDrawKnowledge,
        handleHandCardClick: handleHandCardClick,
        handleCreatureClickForSummon: handleCreatureClickForSummon,
        handleEndTurn: handleEndTurn
    };
}
exports.useGameActions = useGameActions;
