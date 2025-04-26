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
exports.checkWinCondition = exports.executeKnowledgePhase = exports.isValidAction = exports.ACTIONS_PER_TURN = void 0;
var effects_1 = require("./effects");
var passives_1 = require("./passives");
// Constants
var MAX_HAND_SIZE = 5;
exports.ACTIONS_PER_TURN = 2;
/**
 * Checks if a given action is valid based on the current game state and rules.
 * @param state The current game state.
 * @param action The action to validate.
 * @returns An object indicating if the action is valid and an optional reason if not.
 */
function isValidAction(state, action) {
    var _a;
    // Allow SET_GAME_STATE and INITIALIZE_GAME without player/turn checks
    if (action.type === 'SET_GAME_STATE' || action.type === 'INITIALIZE_GAME') {
        return { isValid: true }; // Always allow system actions
    }
    // Handle END_TURN before payload check
    if (action.type === 'END_TURN') {
        // Basic checks for END_TURN (can be done here or in reducer)
        if (state.phase !== 'action') {
            var reason = "Cannot end turn outside action phase (Current: ".concat(state.phase, ")");
            return { isValid: false, reason: reason };
        }
        // No need to check actionsTakenThisTurn for END_TURN
        return { isValid: true };
    }
    // All other actions require payload and player/turn checks
    if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
        var reason = "Invalid payload structure for player action ".concat(action.type);
        console.log("[isValidAction] Failed: ".concat(reason));
        return { isValid: false, reason: reason };
    }
    // Cast to access playerId after validation
    var payload = action.payload;
    var playerId = payload.playerId;
    var playerIndex = state.players.findIndex(function (p) { return p.id === playerId; });
    if (playerIndex === -1) {
        var reason = "Player ".concat(playerId, " not found");
        return { isValid: false, reason: reason }; // Player not found
    }
    // Basic checks: Correct player, correct phase, actions available
    if (state.currentPlayerIndex !== playerIndex) {
        var reason = "Not player ".concat(playerIndex, "'s turn (Current: ").concat(state.currentPlayerIndex, ")");
        return { isValid: false, reason: reason }; // Not player's turn
    }
    if (state.phase !== 'action') {
        var reason = "Not action phase (Current: ".concat(state.phase, ")");
        return { isValid: false, reason: reason }; // Not action phase
    }
    var currentActionsPerTurn = (_a = state.actionsPerTurn) !== null && _a !== void 0 ? _a : exports.ACTIONS_PER_TURN;
    if (state.actionsTakenThisTurn >= currentActionsPerTurn) {
        var reason = "No actions left (Taken: ".concat(state.actionsTakenThisTurn, "/").concat(currentActionsPerTurn, ")");
        console.log("[isValidAction] Failed: ".concat(reason));
        return { isValid: false, reason: reason }; // No actions left
    }
    // Action-specific validation
    switch (action.type) {
        case 'ROTATE_CREATURE': {
            var creatureId_1 = action.payload.creatureId;
            var player = state.players[playerIndex];
            var creature = player.creatures.find(function (c) { return c.id === creatureId_1; });
            if (!creature) {
                return { isValid: false, reason: "Creature ".concat(creatureId_1, " not found") };
            }
            var fieldSlot = player.field.find(function (f) { return f.creatureId === creatureId_1; });
            if (!fieldSlot) {
                return { isValid: false, reason: "Creature ".concat(creatureId_1, " not on field") };
            }
            return { isValid: true };
        }
        case 'DRAW_KNOWLEDGE': {
            var instanceId_1 = action.payload.instanceId;
            var player = state.players[playerIndex];
            // Check 1: Market not empty
            if (state.market.length === 0) {
                return { isValid: false, reason: "Market is empty" };
            }
            // Check 2: Card exists in market (using instanceId for precision)
            if (!state.market.some(function (k) { return k.instanceId === instanceId_1; })) {
                return { isValid: false, reason: "Knowledge instance ".concat(instanceId_1, " not in market") };
            }
            // Check 3: Hand not full
            if (player.hand.length >= MAX_HAND_SIZE) {
                return { isValid: false, reason: "Hand full" };
            }
            return { isValid: true };
        }
        case 'SUMMON_KNOWLEDGE': {
            var _b = action.payload, knowledgeId = _b.knowledgeId, creatureId_2 = _b.creatureId, instanceId_2 = _b.instanceId;
            var player_1 = state.players[playerIndex];
            // Find knowledge in hand using instanceId for precision
            var knowledgeCard = player_1.hand.find(function (k) { return k.instanceId === instanceId_2; });
            if (!knowledgeCard) {
                return { isValid: false, reason: "Knowledge instance ".concat(instanceId_2, " not in hand") };
            }
            // Ensure knowledgeId matches (consistency check)
            if (knowledgeCard.id !== knowledgeId) {
                return { isValid: false, reason: "Knowledge instance ".concat(instanceId_2, " ID mismatch (found ").concat(knowledgeCard.id, ", expected ").concat(knowledgeId, ")") };
            }
            var creatureSlotIndex = player_1.field.findIndex(function (f) { return f.creatureId === creatureId_2; });
            if (creatureSlotIndex === -1) {
                return { isValid: false, reason: "Creature ".concat(creatureId_2, " not on field") };
            }
            var creatureSlot = player_1.field[creatureSlotIndex];
            if (creatureSlot.knowledge) {
                return { isValid: false, reason: "Creature ".concat(creatureId_2, " already has knowledge") };
            }
            var creature = player_1.creatures.find(function (c) { return c.id === creatureId_2; });
            if (!creature) {
                return { isValid: false, reason: "Base creature ".concat(creatureId_2, " not found") };
            }
            var creatureWisdom = creature.currentWisdom;
            if (typeof creatureWisdom !== 'number') {
                return { isValid: false, reason: "Creature ".concat(creatureId_2, " has invalid wisdom") };
            }
            var effectiveCost = knowledgeCard.cost;
            // Apply cost reductions (consider moving to a helper function)
            if (knowledgeCard.element === 'water' && player_1.creatures.some(function (c) { return c.id === 'kappa' && player_1.field.some(function (f) { return f.creatureId === 'kappa'; }); })) {
                effectiveCost = Math.max(1, effectiveCost - 1);
            }
            if (knowledgeCard.element === 'earth' && player_1.creatures.some(function (c) { return c.id === 'dudugera' && player_1.field.some(function (f) { return f.creatureId === 'dudugera'; }); })) {
                effectiveCost = Math.max(1, effectiveCost - 1);
            }
            // Check if the *target slot* for *this player* is blocked by an *opponent's* aquatic3
            var opponentIndex = playerIndex === 0 ? 1 : 0;
            var blockedSlots = state.blockedSlots;
            if (blockedSlots && blockedSlots[opponentIndex] && blockedSlots[opponentIndex].includes(creatureSlotIndex)) {
                return { isValid: false, reason: "This slot (".concat(creatureSlotIndex, ") is currently blocked by an opponent's aquatic3 effect.") };
            }
            if (creatureWisdom < effectiveCost) {
                return { isValid: false, reason: "Insufficient wisdom (".concat(creatureWisdom, " < ").concat(effectiveCost, ")") };
            }
            return { isValid: true };
        }
        default:
            var unknownAction = action; // This will cause a compile error if any GameAction type is missed
            var reason = "Unhandled action type: ".concat(unknownAction.type);
            console.log("[isValidAction] Failed: ".concat(reason), action);
            return { isValid: false, reason: reason };
    }
}
exports.isValidAction = isValidAction;
/**
 * Executes the knowledge phase: rotates knowledge, applies effects, handles combat.
 * @param state The current game state.
 * @returns The updated game state after the knowledge phase.
 */
function executeKnowledgePhase(state) {
    // Restore deep clone to prevent mutation issues
    var newState = JSON.parse(JSON.stringify(state));
    newState.log.push("Turn ".concat(newState.turn, ": Knowledge Phase started."));
    // Initialize extraActionsNextTurn for the current turn if it doesn't exist
    if (!newState.extraActionsNextTurn) {
        newState.extraActionsNextTurn = { 0: 0, 1: 0 };
    }
    // Ensure pendingEffects is initialized if missing (due to clone)
    if (!newState.pendingEffects) {
        newState.pendingEffects = [];
    }
    // Ensure blockedSlots is initialized if missing (due to clone)
    if (!newState.blockedSlots) {
        newState.blockedSlots = { 0: [], 1: [] };
    }
    // 1. Rotate Knowledge Cards and Apply Effects
    var knowledgeToDiscard = [];
    var _loop_1 = function (playerIndex) {
        var player = newState.players[playerIndex];
        player.field.forEach(function (slot, slotIndex) {
            var _a;
            if (slot.knowledge) {
                var currentRotation = (_a = slot.knowledge.rotation) !== null && _a !== void 0 ? _a : 0;
                var maxRotationDegrees = (slot.knowledge.maxRotations || 4) * 90; // Default to 4 if undefined
                var willBeDiscarded = currentRotation + 90 >= maxRotationDegrees; // Check if it will be discarded this turn
                var nextRotation = currentRotation + 90;
                slot.knowledge.rotation = nextRotation;
                newState.log.push("Knowledge ".concat(slot.knowledge.name, " (Player ").concat(playerIndex + 1, ", Slot ").concat(slotIndex, ") rotated to ").concat(nextRotation, "\u00BA."));
                var effectFn = effects_1.knowledgeEffects[slot.knowledge.id];
                if (effectFn) {
                    newState = effectFn({
                        state: newState,
                        playerIndex: playerIndex,
                        fieldSlotIndex: slotIndex,
                        knowledge: slot.knowledge,
                        rotation: nextRotation,
                        isFinalRotation: willBeDiscarded // Pass whether it will be discarded
                    });
                }
                if (willBeDiscarded) {
                    knowledgeToDiscard.push({ playerIndex: playerIndex, slotIndex: slotIndex, card: __assign({}, slot.knowledge) });
                }
            }
        });
    };
    for (var playerIndex = 0; playerIndex < newState.players.length; playerIndex++) {
        _loop_1(playerIndex);
    }
    knowledgeToDiscard.forEach(function (_a) {
        var _b;
        var playerIndex = _a.playerIndex, slotIndex = _a.slotIndex, card = _a.card;
        var player = newState.players[playerIndex];
        var creatureName = ((_b = player.creatures.find(function (c) { return c.id === player.field[slotIndex].creatureId; })) === null || _b === void 0 ? void 0 : _b.name) || "Creature ".concat(player.field[slotIndex].creatureId);
        var maxRotationDegrees = (card.maxRotations || 4) * 90;
        newState.discardPile.push(card);
        newState.log.push("".concat(card.name, " on ").concat(creatureName, " (Player ").concat(playerIndex + 1, ") reached ").concat(card.rotation, "\u00BA/").concat(maxRotationDegrees, "\u00BA and was discarded."));
        if (card.id === 'aquatic3') {
            var opponentIndex = playerIndex === 0 ? 1 : 0;
            var opposingSlotIndex_1 = slotIndex;
            if (newState.blockedSlots && newState.blockedSlots[opponentIndex]) {
                var initialLength = newState.blockedSlots[opponentIndex].length;
                newState.blockedSlots[opponentIndex] = newState.blockedSlots[opponentIndex].filter(function (idx) { return idx !== opposingSlotIndex_1; });
                if (newState.blockedSlots[opponentIndex].length < initialLength) {
                    newState.log.push("Block on opponent's slot ".concat(opposingSlotIndex_1, " removed"));
                }
            }
        }
        newState = (0, passives_1.applyPassiveAbilities)(newState, 'KNOWLEDGE_LEAVE', {
            playerId: player.id,
            creatureId: player.field[slotIndex].creatureId,
            knowledgeCard: card
        });
        var targetPlayer = newState.players[playerIndex]; // Use newState here
        if (targetPlayer && targetPlayer.field[slotIndex]) {
            targetPlayer.field[slotIndex].knowledge = null;
            console.log("[executeKnowledgePhase] Set knowledge to null for Player ".concat(playerIndex + 1, ", Slot ").concat(slotIndex));
        }
        else {
            console.error("[executeKnowledgePhase] Error: Could not find player/slot to nullify knowledge for discard. PlayerIndex: ".concat(playerIndex, ", SlotIndex: ").concat(slotIndex));
        }
    });
    // --- Damage/Defense Resolution ---
    var player1Damage = 0;
    var player1Defense = 0;
    var player2Damage = 0;
    var player2Defense = 0;
    // Aggregate effects for player 1
    newState.pendingEffects.forEach(function (effect) {
        if (effect.type === 'damage')
            player1Damage += effect.amount;
        if (effect.type === 'defense')
            player1Defense += effect.amount;
    });
    // Aggregate effects for player 2
    newState.pendingEffects.forEach(function (effect) {
        if (effect.type === 'damage')
            player2Damage += effect.amount;
        if (effect.type === 'defense')
            player2Defense += effect.amount;
    });
    // Apply net damage
    var netDamageToP2 = Math.max(0, player1Damage - player2Defense);
    var netDamageToP1 = Math.max(0, player2Damage - player1Defense);
    if (netDamageToP2 > 0) {
        newState.players[1].power -= netDamageToP2; // Apply P1 damage to P2
        newState.log.push("[Damage] ".concat(newState.players[0].id, " dealt ").concat(netDamageToP2, " net damage to ").concat(newState.players[1].id, "."));
    }
    if (netDamageToP1 > 0) {
        newState.players[0].power -= netDamageToP1; // Apply P2 damage to P1
        newState.log.push("[Damage] ".concat(newState.players[1].id, " dealt ").concat(netDamageToP1, " net damage to ").concat(newState.players[0].id, "."));
    }
    // Clear pending effects for the next phase/turn
    newState.pendingEffects = [];
    newState.phase = 'action';
    newState.actionsTakenThisTurn = 0;
    newState.log.push("Turn ".concat(newState.turn, ": Action Phase started."));
    return newState;
}
exports.executeKnowledgePhase = executeKnowledgePhase;
/**
 * Checks if the game has reached a win condition.
 * @param state The current game state.
 * @returns The ID of the winning player, or null if no winner yet.
 */
function checkWinCondition(state) {
    var player1 = state.players[0];
    var player2 = state.players[1];
    if (player2.power <= 0) {
        return player1.id;
    }
    if (player1.power <= 0) {
        return player2.id;
    }
    return null;
}
exports.checkWinCondition = checkWinCondition;
