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
exports.summonKnowledge = exports.drawKnowledge = exports.rotateCreature = void 0;
var utils_1 = require("./utils");
var uuid_1 = require("uuid");
/**
 * Rotates a creature, increasing its wisdom.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, creatureId).
 * @returns The updated game state.
 */
function rotateCreature(state, payload) {
    var _a;
    var playerId = payload.playerId, creatureId = payload.creatureId;
    var playerIndex = state.players.findIndex(function (p) { return p.id === playerId; });
    if (playerIndex === -1)
        return state;
    var updatedPlayers = __spreadArray([], state.players, true);
    var player = __assign({}, updatedPlayers[playerIndex]);
    var creatureIndex = player.creatures.findIndex(function (c) { return c.id === creatureId; });
    if (creatureIndex === -1)
        return state;
    var creature = __assign({}, player.creatures[creatureIndex]);
    var currentRotation = (_a = creature.rotation) !== null && _a !== void 0 ? _a : 0;
    if (currentRotation >= 270) {
        console.warn("[Action] Attempted to rotate ".concat(creature.name, " beyond max rotation."));
        return state;
    }
    // Rotate creature
    var newRotation = currentRotation + 90;
    creature.rotation = newRotation;
    // Set wisdom according to wisdomCycle and rotation
    creature.currentWisdom = (0, utils_1.getCreatureWisdom)(__assign(__assign({}, creature), { rotation: newRotation }));
    player.creatures = __spreadArray(__spreadArray(__spreadArray([], player.creatures.slice(0, creatureIndex), true), [
        creature
    ], false), player.creatures.slice(creatureIndex + 1), true);
    updatedPlayers[playerIndex] = player;
    return __assign(__assign({}, state), { players: updatedPlayers, log: __spreadArray(__spreadArray([], state.log, true), ["Player ".concat(playerId, " rotated ").concat(creature.name, ".")], false) });
}
exports.rotateCreature = rotateCreature;
/**
 * Draws a knowledge card from the market to the player's hand.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, knowledgeId, instanceId).
 * @returns The updated game state.
 */
function drawKnowledge(state, payload) {
    var playerId = payload.playerId, instanceId = payload.instanceId;
    var playerIndex = state.players.findIndex(function (p) { return p.id === playerId; });
    if (playerIndex === -1)
        return state;
    var cardToDraw = state.market.find(function (k) { return k.instanceId === instanceId; });
    if (!cardToDraw) {
        console.warn("[Action] Card with instanceId ".concat(instanceId, " not found in market for DRAW_KNOWLEDGE."));
        return state;
    }
    var updatedPlayers = __spreadArray([], state.players, true);
    var player = __assign({}, updatedPlayers[playerIndex]);
    player.hand = __spreadArray(__spreadArray([], player.hand, true), [cardToDraw], false);
    updatedPlayers[playerIndex] = player;
    var updatedMarket = state.market.filter(function (k) { return k.instanceId !== instanceId; });
    var updatedDeck = __spreadArray([], state.knowledgeDeck, true);
    if (updatedDeck.length > 0) {
        var nextCard = updatedDeck.shift();
        if (nextCard) {
            updatedMarket.push(__assign(__assign({}, nextCard), { instanceId: nextCard.instanceId || (0, uuid_1.v4)() }));
        }
    }
    return __assign(__assign({}, state), { players: updatedPlayers, market: updatedMarket, knowledgeDeck: updatedDeck, log: __spreadArray(__spreadArray([], state.log, true), ["Player ".concat(playerId, " drew ").concat(cardToDraw.name, " from the market.")], false) });
}
exports.drawKnowledge = drawKnowledge;
/**
 * Summons a knowledge card from the player's hand onto a creature.
 * Assumes the action is valid.
 * @param state The current game state.
 * @param payload Data for the action (playerId, knowledgeId, instanceId, creatureId).
 * @returns The updated game state.
 */
function summonKnowledge(state, payload) {
    var playerId = payload.playerId, instanceId = payload.instanceId, creatureId = payload.creatureId;
    var playerIndex = state.players.findIndex(function (p) { return p.id === playerId; });
    if (playerIndex === -1)
        return state;
    var updatedPlayers = __spreadArray([], state.players, true);
    var player = __assign({}, updatedPlayers[playerIndex]);
    var knowledgeCardIndex = player.hand.findIndex(function (k) { return k.instanceId === instanceId; });
    if (knowledgeCardIndex === -1) {
        console.warn("[Action] Card with instanceId ".concat(instanceId, " not found in hand for SUMMON_KNOWLEDGE."));
        return state;
    }
    var knowledgeCard = player.hand[knowledgeCardIndex];
    var creatureIndex = player.creatures.findIndex(function (c) { return c.id === creatureId; });
    if (creatureIndex === -1)
        return state;
    var creature = __assign({}, player.creatures[creatureIndex]);
    player.hand = player.hand.filter(function (k) { return k.instanceId !== instanceId; });
    var fieldSlotIndex = player.field.findIndex(function (f) { return f.creatureId === creatureId; });
    if (fieldSlotIndex === -1) {
        console.warn("[Action] Field slot not found for creatureId ".concat(creatureId, " during SUMMON_KNOWLEDGE."));
        return state; // Return state if slot not found
    }
    // Ensure the knowledge card has rotation set to 0 when summoned
    var knowledgeToPlace = __assign(__assign({}, knowledgeCard), { rotation: 0 });
    player.field = __spreadArray(__spreadArray(__spreadArray([], player.field.slice(0, fieldSlotIndex), true), [
        { creatureId: creatureId, knowledge: knowledgeToPlace }
    ], false), player.field.slice(fieldSlotIndex + 1), true);
    updatedPlayers[playerIndex] = player;
    return __assign(__assign({}, state), { players: updatedPlayers, log: __spreadArray(__spreadArray([], state.log, true), ["Player ".concat(playerId, " summoned ").concat(knowledgeCard.name, " onto ").concat(creature.name, ".")], false) });
}
exports.summonKnowledge = summonKnowledge;
