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
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var AuthContext_1 = require("../context/AuthContext");
var usePlayerIdentification_1 = require("../hooks/usePlayerIdentification");
var useGameInitialization_1 = require("../hooks/useGameInitialization");
var useGameActions_1 = require("../hooks/useGameActions");
var useTurnTimer_1 = require("../hooks/useTurnTimer"); // Import the timer hook
var TopBar_1 = require("../components/game/TopBar");
var ActionBar_1 = require("../components/game/ActionBar");
var TableArea_1 = require("../components/game/TableArea");
var HandsColumn_1 = require("../components/game/HandsColumn");
var MarketColumn_1 = require("../components/game/MarketColumn");
var Logs_1 = require("../components/game/Logs"); // Import the Logs component
var supabase_1 = require("../utils/supabase");
var GameScreen = function () {
    var _a, _b, _c, _d, _e;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var authLoading = (0, AuthContext_1.useAuth)().loading;
    var _f = (0, usePlayerIdentification_1.usePlayerIdentification)(), currentPlayerId = _f[0], idLoading = _f[4];
    var _g = (0, react_1.useState)(null), error = _g[0], setError = _g[1];
    var _h = (0, useGameInitialization_1.useGameInitialization)(currentPlayerId, setError), gameState = _h[0], dispatch = _h[1], gameLoading = _h[2], gameId = _h[3];
    var _j = (0, react_1.useState)(false), isMyTurn = _j[0], setIsMyTurn = _j[1];
    var _k = (0, react_1.useState)({}), playerProfiles = _k[0], setPlayerProfiles = _k[1];
    var _l = (0, react_1.useState)(true), profilesLoading = _l[0], setProfilesLoading = _l[1];
    var _m = (0, react_1.useState)(null), selectedKnowledgeId = _m[0], setSelectedKnowledgeId = _m[1];
    var _o = (0, useGameActions_1.useGameActions)(gameState, gameId || null, dispatch, currentPlayerId || null, selectedKnowledgeId), handleRotateCreature = _o.handleRotateCreature, handleDrawKnowledge = _o.handleDrawKnowledge, handleHandCardClick = _o.handleHandCardClick, handleCreatureClickForSummon = _o.handleCreatureClickForSummon, handleEndTurn = _o.handleEndTurn;
    // --- Turn Timer --- 
    var TURN_DURATION_SECONDS = 30;
    var remainingTime = (0, useTurnTimer_1.useTurnTimer)({
        isMyTurn: isMyTurn,
        phase: (_a = gameState === null || gameState === void 0 ? void 0 : gameState.phase) !== null && _a !== void 0 ? _a : null,
        turnDurationSeconds: TURN_DURATION_SECONDS,
        onTimerEnd: handleEndTurn,
        gameTurn: (_b = gameState === null || gameState === void 0 ? void 0 : gameState.turn) !== null && _b !== void 0 ? _b : 0,
        currentPlayerIndex: (_c = gameState === null || gameState === void 0 ? void 0 : gameState.currentPlayerIndex) !== null && _c !== void 0 ? _c : null
    });
    // --- End Turn Timer ---
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d;
        var fetchProfiles = function (playerIds) { return __awaiter(void 0, void 0, void 0, function () {
            var fetchedProfiles, profileError_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[GameScreen] Starting profile fetch for:', playerIds);
                        setProfilesLoading(true);
                        fetchedProfiles = {};
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, Promise.all(playerIds.map(function (playerId) { return __awaiter(void 0, void 0, void 0, function () {
                                var profile;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!playerId)
                                                return [2 /*return*/];
                                            return [4 /*yield*/, (0, supabase_1.getProfile)(playerId)];
                                        case 1:
                                            profile = _a.sent();
                                            fetchedProfiles[playerId] = {
                                                username: (profile === null || profile === void 0 ? void 0 : profile.username) || "Player (".concat(playerId.substring(0, 6), ")"),
                                                avatar_url: (profile === null || profile === void 0 ? void 0 : profile.avatar_url) || null
                                            };
                                            return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a.sent();
                        setPlayerProfiles(fetchedProfiles);
                        console.log('[GameScreen] Fetched player profiles:', fetchedProfiles);
                        return [3 /*break*/, 5];
                    case 3:
                        profileError_1 = _a.sent();
                        console.error("Error fetching player profiles:", profileError_1);
                        playerIds.forEach(function (playerId) {
                            if (playerId && !fetchedProfiles[playerId]) {
                                fetchedProfiles[playerId] = { username: "Player (".concat(playerId.substring(0, 6), ")"), avatar_url: null };
                            }
                        });
                        setPlayerProfiles(fetchedProfiles);
                        return [3 /*break*/, 5];
                    case 4:
                        setProfilesLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        var p1Id = (_b = (_a = gameState === null || gameState === void 0 ? void 0 : gameState.players) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id;
        var p2Id = (_d = (_c = gameState === null || gameState === void 0 ? void 0 : gameState.players) === null || _c === void 0 ? void 0 : _c[1]) === null || _d === void 0 ? void 0 : _d.id;
        var arePlayersValid = p1Id && p2Id;
        if (!gameLoading && gameState && arePlayersValid) {
            if (!playerProfiles[p1Id] || !playerProfiles[p2Id]) {
                console.log('[GameScreen] Game loaded and players valid, initiating profile fetch.');
                fetchProfiles([p1Id, p2Id]);
            }
            else {
                if (profilesLoading) {
                    console.log('[GameScreen] Profiles already fetched, ensuring profilesLoading is false.');
                    setProfilesLoading(false);
                }
            }
        }
        else if (!gameLoading && gameState && !arePlayersValid) {
            console.warn('[GameScreen] Game loaded but player IDs in state are invalid.');
            setProfilesLoading(false);
        }
        else if (!gameLoading && !gameState) {
            console.warn('[GameScreen] Game sync finished, but gameState is null.');
            setProfilesLoading(false);
        }
        else if (gameLoading && !profilesLoading) {
            setProfilesLoading(true);
        }
    }, [gameLoading, gameState, playerProfiles]);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d;
        console.log('[GameScreen] State/PlayerID update check:', { phase: gameState === null || gameState === void 0 ? void 0 : gameState.phase, currentPlayerIndex: gameState === null || gameState === void 0 ? void 0 : gameState.currentPlayerIndex, currentPlayerId: currentPlayerId, p1: (_b = (_a = gameState === null || gameState === void 0 ? void 0 : gameState.players) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id, p2: (_d = (_c = gameState === null || gameState === void 0 ? void 0 : gameState.players) === null || _c === void 0 ? void 0 : _c[1]) === null || _d === void 0 ? void 0 : _d.id });
        if (!currentPlayerId || !gameState || gameState.players.length < 2) {
            setIsMyTurn(false);
            console.log('[GameScreen] Setting as spectator/waiting (no user ID or game not fully initialized/loaded)');
            return;
        }
        var playerIndex = gameState.players[0].id === currentPlayerId ? 0 : (gameState.players[1].id === currentPlayerId ? 1 : -1);
        if (playerIndex === -1) {
            setIsMyTurn(false);
            console.log('[GameScreen] Setting as spectator (user ID not in game)');
        }
        else {
            var turnCheck = gameState.currentPlayerIndex === playerIndex && gameState.winner === null;
            setIsMyTurn(turnCheck);
            console.log("[GameScreen] Setting as Player ".concat(playerIndex + 1, ". Is my turn: ").concat(turnCheck));
        }
    }, [gameState === null || gameState === void 0 ? void 0 : gameState.currentPlayerIndex, gameState === null || gameState === void 0 ? void 0 : gameState.phase, gameState === null || gameState === void 0 ? void 0 : gameState.winner, gameState === null || gameState === void 0 ? void 0 : gameState.actionsTakenThisTurn, gameState === null || gameState === void 0 ? void 0 : gameState.actionsPerTurn, currentPlayerId, gameState === null || gameState === void 0 ? void 0 : gameState.players, isMyTurn]);
    if (authLoading || idLoading || gameLoading || profilesLoading) {
        console.log("[Render] Showing Loading Game... (auth: ".concat(authLoading, ", id: ").concat(idLoading, ", game: ").concat(gameLoading, ", profiles: ").concat(profilesLoading, ")"));
        return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading Game...</div>;
    }
    if (error) {
        return <div className="flex justify-center items-center h-screen bg-gray-900 text-red-500">Error: {error} <button onClick={function () { return navigate('/lobby'); }} className="ml-2 underline">Back to Lobby</button></div>;
    }
    if (!gameState) {
        console.warn('[Render] Loading flags false, but game state is null. Error should be displayed.');
        return <div className="flex justify-center items-center h-screen bg-gray-900 text-red-500">Error: Failed to load game state. <button onClick={function () { return navigate('/lobby'); }} className="ml-2 underline">Back to Lobby</button></div>;
    }
    if (gameState.players.length < 2) {
        console.warn('[Render] Game state loaded, but players array is invalid.', gameState);
        return <div className="flex justify-center items-center h-screen bg-gray-900 text-gray-400">Error: Invalid game data received. <button onClick={function () { return navigate('/lobby'); }} className="ml-2 underline">Back to Lobby</button></div>;
    }
    var playerIndex = gameState.players[0].id === currentPlayerId ? 0 : (gameState.players[1].id === currentPlayerId ? 1 : -1);
    var opponentIndex = playerIndex === 0 ? 1 : 0;
    var player = playerIndex !== -1 ? gameState.players[playerIndex] : undefined;
    var opponent = gameState.players[opponentIndex];
    var playerProfileId = (player === null || player === void 0 ? void 0 : player.id) || '';
    var opponentProfileId = (opponent === null || opponent === void 0 ? void 0 : opponent.id) || '';
    var playerProfile = playerProfiles[playerProfileId] || { username: "Player ".concat(playerIndex !== -1 ? playerIndex + 1 : '?'), avatar_url: null };
    var opponentProfile = playerProfiles[opponentProfileId] || { username: "Player ".concat(opponentIndex + 1), avatar_url: null };
    var handleMarketClick = function (knowledgeId) {
        if (handleDrawKnowledge) {
            handleDrawKnowledge(knowledgeId);
        }
        else {
            console.error("handleDrawKnowledge function not available from useGameActions");
        }
        setSelectedKnowledgeId(null);
    };
    var handleHandClick = function (knowledgeId) {
        if (handleHandCardClick) {
            handleHandCardClick(knowledgeId);
            setSelectedKnowledgeId(function (prev) { return prev === knowledgeId ? null : knowledgeId; });
        }
        else {
            setSelectedKnowledgeId(function (prev) { return prev === knowledgeId ? null : knowledgeId; });
            console.log("[Action] Selected/Deselected hand knowledge (local): ".concat(knowledgeId));
        }
    };
    var handleCreatureClick = function (creatureId) {
        if (selectedKnowledgeId && handleCreatureClickForSummon) {
            handleCreatureClickForSummon(creatureId);
            setSelectedKnowledgeId(null);
        }
        else if (!selectedKnowledgeId && handleRotateCreature) {
            handleRotateCreature(creatureId);
        }
        else {
            console.log("[Action] Cannot perform creature action (conditions not met or handlers missing)");
        }
    };
    console.log('[Render] Rendering main game screen.');
    return (<div className="flex flex-col h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white overflow-hidden">
      <TopBar_1["default"] player1Profile={playerIndex === 0 ? playerProfile : opponentProfile} player2Profile={playerIndex === 1 ? playerProfile : opponentProfile} player1Mana={((_d = gameState.players[0]) === null || _d === void 0 ? void 0 : _d.power) || 0} player2Mana={((_e = gameState.players[1]) === null || _e === void 0 ? void 0 : _e.power) || 0} turn={gameState.turn} phase={gameState.phase} onLobbyReturn={function () { return navigate('/lobby'); }}/>

      {/* Main Content Area - Now 4 columns */}
      <div className="flex-grow flex flex-row overflow-hidden p-2 gap-2">
        {/* Hands Column - Adjusted width */}
        <div className="w-1/6 h-full">
          {player && opponent ? (<HandsColumn_1["default"] currentPlayerHand={player.hand} opponentPlayerHand={opponent.hand} isMyTurn={isMyTurn} phase={gameState.phase} selectedKnowledgeId={selectedKnowledgeId} onHandCardClick={handleHandClick}/>) : (<div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>)}
        </div>

        {/* Table Area - Adjusted width */}
        <div className="w-3/6 h-full"> {/* Adjusted from 3/5 */}
          {player && opponent ? (<TableArea_1["default"] currentPlayer={player} opponentPlayer={opponent} isMyTurn={isMyTurn} phase={gameState.phase} selectedKnowledgeId={selectedKnowledgeId} onCreatureClickForSummon={handleCreatureClick} onRotateCreature={handleCreatureClick}/>) : (<div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center text-gray-500">Waiting for player data...</div>)}
        </div>

        {/* Market Column - Adjusted width */}
        <div className="w-1/6 h-full"> {/* Adjusted from 1/5 */}
          <MarketColumn_1["default"] marketCards={gameState.market} deckCount={gameState.knowledgeDeck.length} isMyTurn={isMyTurn} phase={gameState.phase} onDrawKnowledge={handleMarketClick}/>
        </div>

        {/* Logs Column - New dedicated column */}
        <div className="w-1/6 h-full"> {/* New column for logs */}
           <Logs_1["default"] logs={gameState.log}/>
        </div>
      </div>

      {/* Action Bar */}
      <ActionBar_1["default"] isMyTurn={isMyTurn} phase={gameState.phase} winner={gameState.winner} actionsTaken={gameState.actionsTakenThisTurn} turnTimer={remainingTime} // Pass remainingTime to ActionBar
     actionsPerTurn={gameState.actionsPerTurn} isSpectator={playerIndex === -1} onEndTurnClick={handleEndTurn} // Pass handleEndTurn for the button
    />
    </div>);
};
exports["default"] = GameScreen;
