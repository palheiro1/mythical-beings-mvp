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
exports.knowledgeEffects = void 0;
var passives_1 = require("./passives"); // Import applyPassiveAbilities
// Effect function map
exports.knowledgeEffects = {
    // Terrestrial 1: Damage based on rotation, +1 if opponent's creature has no knowledge
    terrestrial1: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, fieldSlotIndex = _a.fieldSlotIndex, knowledge = _a.knowledge, rotation = _a.rotation;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var damage = 0;
        var logMsg = "[Terrestrial1] Rotation: ".concat(rotation, "\u00BA. ");
        if (rotation === 0)
            damage = 1;
        else if (rotation === 90)
            damage = 0;
        else if (rotation === 180)
            damage = 2;
        logMsg += "Base damage: ".concat(damage, ". ");
        // Check if opponent's creature (same slot) has no knowledge
        var opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex] || { knowledge: null };
        if (!opponentFieldSlot.knowledge) {
            damage += 1;
            logMsg += "Opponent's creature has no knowledge: +1 damage. ";
        }
        logMsg += "Total damage: ".concat(damage, ".");
        if (damage > 0) {
            return __assign(__assign({}, state), { log: __spreadArray(__spreadArray([], state.log, true), ["".concat(knowledge.name, " deals ").concat(damage, " damage to Player ").concat(opponentIndex + 1, ". ").concat(logMsg)], false) });
        }
        return __assign(__assign({}, state), { log: __spreadArray(__spreadArray([], state.log, true), ["".concat(knowledge.name, " causes no damage. ").concat(logMsg)], false) });
    },
    // Terrestrial 2: Look at opponent's hand and discard 1 card
    terrestrial2: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, knowledge = _a.knowledge;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var opponentHand = state.players[opponentIndex].hand;
        var logMsg = "[Terrestrial2] Opponent hand size: ".concat(opponentHand.length, ". ");
        if (opponentHand.length === 0) {
            logMsg += 'No cards to discard.';
            return __assign(__assign({}, state), { log: __spreadArray(__spreadArray([], state.log, true), ["".concat(knowledge.name, ": Opponent has no cards to discard. ").concat(logMsg)], false) });
        }
        var discarded = opponentHand[0], rest = opponentHand.slice(1);
        logMsg += "Discarded: ".concat(discarded.name, ".");
        var newPlayers = __spreadArray([], state.players, true);
        newPlayers[opponentIndex] = __assign(__assign({}, newPlayers[opponentIndex]), { hand: rest });
        var newDiscardPile = __spreadArray(__spreadArray([], state.discardPile, true), [discarded], false);
        return __assign(__assign({}, state), { players: newPlayers, discardPile: newDiscardPile, log: __spreadArray(__spreadArray([], state.log, true), ["".concat(knowledge.name, ": Discarded ").concat(discarded.name, " from opponent's hand. ").concat(logMsg)], false) });
    },
    // Terrestrial 3: Damage equal to summoning creature's wisdom
    terrestrial3: function (_a) {
        var _b, _c;
        var state = _a.state, playerIndex = _a.playerIndex, fieldSlotIndex = _a.fieldSlotIndex, knowledge = _a.knowledge;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var creatureId = state.players[playerIndex].field[fieldSlotIndex].creatureId;
        var creature = state.players[playerIndex].creatures.find(function (c) { return c.id === creatureId; });
        var wisdom = (_c = (_b = creature === null || creature === void 0 ? void 0 : creature.currentWisdom) !== null && _b !== void 0 ? _b : creature === null || creature === void 0 ? void 0 : creature.baseWisdom) !== null && _c !== void 0 ? _c : 0;
        if (wisdom > 0) {
            state.log.push("".concat(knowledge.name, " deals ").concat(wisdom, " damage to Player ").concat(opponentIndex + 1, "."));
        }
        return state;
    },
    // Terrestrial 4: Eliminate opponent's knowledge cards
    terrestrial4: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, knowledge = _a.knowledge;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var opponentId = state.players[opponentIndex].id;
        var newState = JSON.parse(JSON.stringify(state));
        var eliminatedNames = [];
        var updatedField = newState.players[opponentIndex].field.map(function (slot) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if (slot.knowledge && slot.knowledge.cost <= 2) {
                var leavingKnowledge = __assign(__assign({}, slot.knowledge), { type: (_a = slot.knowledge.type) !== null && _a !== void 0 ? _a : 'spell', element: (_b = slot.knowledge.element) !== null && _b !== void 0 ? _b : 'neutral', cost: (_c = slot.knowledge.cost) !== null && _c !== void 0 ? _c : 0, effect: (_d = slot.knowledge.effect) !== null && _d !== void 0 ? _d : '', maxRotations: (_e = slot.knowledge.maxRotations) !== null && _e !== void 0 ? _e : 4, id: (_f = slot.knowledge.id) !== null && _f !== void 0 ? _f : 'unknown', name: (_g = slot.knowledge.name) !== null && _g !== void 0 ? _g : 'Unknown Knowledge', instanceId: (_h = slot.knowledge.instanceId) !== null && _h !== void 0 ? _h : 'unknown-instance', rotation: (_j = slot.knowledge.rotation) !== null && _j !== void 0 ? _j : 0 });
                eliminatedNames.push(leavingKnowledge.name);
                newState = (0, passives_1.applyPassiveAbilities)(newState, 'KNOWLEDGE_LEAVE', {
                    playerId: opponentId,
                    knowledgeCard: leavingKnowledge,
                    creatureId: slot.creatureId
                });
                return __assign(__assign({}, slot), { knowledge: null });
            }
            return slot;
        });
        var logMsg = "[Terrestrial4] Eliminated: ".concat(eliminatedNames.join(', ') || 'none', ".");
        var finalPlayers = __spreadArray([], newState.players, true);
        finalPlayers[opponentIndex] = __assign(__assign({}, finalPlayers[opponentIndex]), { field: updatedField });
        return __assign(__assign({}, newState), { players: finalPlayers, log: __spreadArray(__spreadArray([], newState.log, true), ["".concat(knowledge.name, " eliminates opponent's knowledge cards: ").concat(eliminatedNames.join(', ') || 'none', ". ").concat(logMsg)], false) });
    },
    // Terrestrial 5: Discard one opponent knowledge (MVP: auto-pick first, log TODO)
    terrestrial5: function (_a) {
        var _b, _c, _d, _e, _f, _g, _h, _j, _k;
        var state = _a.state, playerIndex = _a.playerIndex, knowledge = _a.knowledge;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var newState = JSON.parse(JSON.stringify(state));
        var opponentField = newState.players[opponentIndex].field;
        var knowledgesOnField = opponentField
            .map(function (slot, idx) { return ({ slot: slot, idx: idx }); })
            .filter(function (_a) {
            var slot = _a.slot;
            return slot.knowledge;
        });
        if (knowledgesOnField.length === 0) {
            newState.log.push("".concat(knowledge.name, ": Opponent has no knowledge cards to discard."));
            return newState;
        }
        else {
            var _l = knowledgesOnField[0], slot = _l.slot, idx = _l.idx;
            var discardedKnowledge = __assign(__assign({}, slot.knowledge), { type: (_b = slot.knowledge.type) !== null && _b !== void 0 ? _b : 'spell', element: (_c = slot.knowledge.element) !== null && _c !== void 0 ? _c : 'neutral', cost: (_d = slot.knowledge.cost) !== null && _d !== void 0 ? _d : 0, effect: (_e = slot.knowledge.effect) !== null && _e !== void 0 ? _e : '', maxRotations: (_f = slot.knowledge.maxRotations) !== null && _f !== void 0 ? _f : 4, id: (_g = slot.knowledge.id) !== null && _g !== void 0 ? _g : 'unknown', name: (_h = slot.knowledge.name) !== null && _h !== void 0 ? _h : 'Unknown Knowledge', instanceId: (_j = slot.knowledge.instanceId) !== null && _j !== void 0 ? _j : 'unknown-instance', rotation: (_k = slot.knowledge.rotation) !== null && _k !== void 0 ? _k : 0 });
            opponentField[idx].knowledge = null;
            newState.discardPile.push(discardedKnowledge);
            var logSuffix = knowledgesOnField.length > 1 ? ". [TODO: Let user choose which knowledge to discard if multiple are valid]" : ".";
            newState.log.push("".concat(knowledge.name, ": Discarded opponent's knowledge ").concat(discardedKnowledge.name).concat(logSuffix));
            newState = (0, passives_1.applyPassiveAbilities)(newState, 'KNOWLEDGE_LEAVE', {
                playerId: newState.players[opponentIndex].id,
                creatureId: opponentField[idx].creatureId,
                knowledgeCard: discardedKnowledge
            });
            return newState;
        }
    },
    // Aquatic 1: Rotates one of your Knowledge cards immediately (MVP: auto-pick first, log TODO)
    aquatic1: function (_a) {
        var _b;
        var state = _a.state, playerIndex = _a.playerIndex, fieldSlotIndex = _a.fieldSlotIndex, knowledge = _a.knowledge;
        var modifiedState = state;
        var playerField = modifiedState.players[playerIndex].field;
        var rotatable = playerField
            .map(function (slot, idx) { return ({ slot: slot, idx: idx }); })
            .filter(function (_a) {
            var _b;
            var slot = _a.slot, idx = _a.idx;
            if (!slot.knowledge || idx === fieldSlotIndex)
                return false;
            var maxRotationDegrees = (slot.knowledge.maxRotations || 4) * 90;
            return ((_b = slot.knowledge.rotation) !== null && _b !== void 0 ? _b : 0) < maxRotationDegrees;
        });
        if (rotatable.length === 0) {
            modifiedState.log.push("".concat(knowledge.name, ": No other knowledge cards to rotate."));
            return modifiedState;
        }
        var _c = rotatable[0], slot = _c.slot, idx = _c.idx;
        var k = slot.knowledge;
        var currentRotation = (_b = k.rotation) !== null && _b !== void 0 ? _b : 0;
        var newRotation = currentRotation + 90;
        k.rotation = newRotation;
        var maxRotationDegreesTarget = (k.maxRotations || 4) * 90;
        modifiedState.log.push("".concat(knowledge.name, ": Rotated ").concat(k.name, " to ").concat(newRotation, "\u00BA and triggered its effect immediately. [TODO: Let user choose which knowledge to rotate if multiple are available]"));
        var effectFn = exports.knowledgeEffects[k.id];
        if (effectFn) {
            modifiedState = effectFn({
                state: modifiedState,
                playerIndex: playerIndex,
                fieldSlotIndex: idx,
                knowledge: k,
                rotation: newRotation,
                isFinalRotation: newRotation >= maxRotationDegreesTarget
            });
        }
        return modifiedState;
    },
    // Aquatic 2: Gain +1 defense when defending if the opposing Creature has no Knowledge cards
    aquatic2: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, fieldSlotIndex = _a.fieldSlotIndex;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex];
        if (opponentFieldSlot && opponentFieldSlot.knowledge) {
            state.log.push("Aquatic2: No defense granted (opposing creature has knowledge).");
        }
        else {
            state.log.push("Aquatic2: Provides +1 defense to Player ".concat(playerIndex + 1, " (opposing creature has no knowledge)."));
        }
        return state;
    },
    // Aquatic 3: Prevent opponent from summoning knowledge onto the opposing creature (persistent block)
    aquatic3: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, fieldSlotIndex = _a.fieldSlotIndex, isFinalRotation = _a.isFinalRotation;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var newState = __assign({}, state);
        if (!newState.blockedSlots)
            newState.blockedSlots = { 0: [], 1: [] };
        if (!isFinalRotation) {
            if (!newState.blockedSlots[opponentIndex].includes(fieldSlotIndex)) {
                newState.blockedSlots[opponentIndex] = __spreadArray(__spreadArray([], newState.blockedSlots[opponentIndex], true), [fieldSlotIndex], false);
                newState.log.push("Aquatic3: Opponent cannot summon knowledge onto the opposing creature (slot ".concat(fieldSlotIndex, ") while this card is in play."));
            }
        }
        else {
            newState.blockedSlots[opponentIndex] = newState.blockedSlots[opponentIndex].filter(function (idx) { return idx !== fieldSlotIndex; });
            newState.log.push("Aquatic3: Block on opponent's slot ".concat(fieldSlotIndex, " removed (aquatic3 left play)."));
        }
        return newState;
    },
    // Aquatic 4: Apparition - Draw 1 card from the Market with no cost (MVP: auto-pick first, log TODO)
    aquatic4: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, knowledge = _a.knowledge;
        var newState = JSON.parse(JSON.stringify(state));
        if (newState.market.length === 0) {
            newState.log.push("".concat(knowledge.name, ": Market is empty, no card drawn."));
            return newState;
        }
        var drawnCard = newState.market.shift();
        if (drawnCard) {
            newState.players[playerIndex].hand.push(drawnCard);
            newState.log.push("".concat(knowledge.name, ": Drew ").concat(drawnCard.name, " from the market. [TODO: Let user choose which card to draw if multiple are available]"));
            if (newState.knowledgeDeck.length > 0) {
                var refillCard = newState.knowledgeDeck.shift();
                if (refillCard)
                    newState.market.push(refillCard);
            }
        }
        return newState;
    },
    // Aquatic 5: Final - Win 1 extra Action
    aquatic5: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, isFinalRotation = _a.isFinalRotation;
        var newState = __assign({}, state);
        if (isFinalRotation) {
            if (!('extraActionsNextTurn' in newState)) {
                newState.extraActionsNextTurn = { 0: 0, 1: 0 };
            }
            var currentExtra = newState.extraActionsNextTurn[playerIndex] || 0;
            newState.extraActionsNextTurn[playerIndex] = currentExtra + 1;
            newState.log.push("Aquatic5: Grants 1 extra action for next turn.");
        }
        return newState;
    },
    // Aerial 1: Apparition - Gain +1 Power (on summon only) + Deals 1 damage
    aerial1: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var damage = 1;
        state.log.push("Aerial1 deals ".concat(damage, " damage to Player ").concat(opponentIndex + 1, "."));
        return state;
    },
    // Aerial 2: +1 Power (1st rotation), +2 Power (2nd), +3 Power (3rd), no 4th rotation
    aerial2: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, rotation = _a.rotation;
        var powerGain = 0;
        if (rotation === 0)
            powerGain = 1;
        else if (rotation === 90)
            powerGain = 2;
        else if (rotation === 180)
            powerGain = 3;
        if (powerGain > 0) {
            state.players[playerIndex].power += powerGain;
            state.log.push("Aerial2: Rotation ".concat(rotation, "\u00BA - Player ").concat(playerIndex + 1, " gains +").concat(powerGain, " Power."));
        }
        return state;
    },
    // Aerial 3: While in play, adds +1 to the Wisdom of all your Creatures
    aerial3: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, isFinalRotation = _a.isFinalRotation;
        if (!isFinalRotation) {
            var player = state.players[playerIndex];
            player.creatures = player.creatures.map(function (creature) { return (__assign(__assign({}, creature), { currentWisdom: (typeof creature.currentWisdom === 'number' ? creature.currentWisdom : creature.baseWisdom) + 1 })); });
            state.log.push("Aerial3: While in play, all your creatures gain +1 Wisdom.");
        }
        return state;
    },
    // Aerial 4: Rotational damage & self-power
    aerial4: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex, rotation = _a.rotation;
        var dmg = (rotation === 0 ? 1 : (rotation === 90 || rotation === 180 ? 2 : 0));
        state.players[playerIndex].power += dmg;
        state.log.push("Aerial4: Deals ".concat(dmg, " damage & grants ").concat(dmg, " power."));
        return state;
    },
    // Aerial 5: All opponent creatures rotate 90º clockwise (lose wisdom)
    aerial5: function (_a) {
        var state = _a.state, playerIndex = _a.playerIndex;
        var opponentIndex = playerIndex === 0 ? 1 : 0;
        var opponent = state.players[opponentIndex];
        var rotatedCount = 0;
        opponent.creatures = opponent.creatures.map(function (creature) {
            var _a;
            var currentRotation = (_a = creature.rotation) !== null && _a !== void 0 ? _a : 0;
            if (currentRotation < 270) {
                rotatedCount++;
                var newRotation = currentRotation + 90;
                return __assign(__assign({}, creature), { rotation: newRotation });
            }
            return creature;
        });
        state.log.push("Aerial5: Rotated ".concat(rotatedCount, " of opponent's creatures 90\u00BA clockwise (they lose wisdom)."));
        return state;
    }
};
