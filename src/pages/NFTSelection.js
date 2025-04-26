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
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var Card_1 = require("../components/Card");
var supabase_1 = require("../utils/supabase"); // Import supabase client and RealtimeChannel
var usePlayerIdentification_1 = require("../hooks/usePlayerIdentification");
// --- Import the base creature data ---
var creatures_json_1 = require("../assets/creatures.json");
// --- Define ALL_CREATURES constant ---
var ALL_CREATURES = creatures_json_1["default"];
var CARD_ASPECT_RATIO = 2.5 / 3.5;
var CARD_WIDTH_DESKTOP = '160px'; // Adjust as needed
var NFTSelection = function () {
    var _a = (0, react_1.useState)([]), selected = _a[0], setSelected = _a[1];
    var _b = (0, react_1.useState)(60), timer = _b[0], setTimer = _b[1]; // Adjust timer as needed
    var _c = (0, react_1.useState)(false), waiting = _c[0], setWaiting = _c[1]; // Waiting for opponent selection
    var _d = (0, react_1.useState)(false), lost = _d[0], setLost = _d[1]; // Lost due to timeout
    var _e = (0, react_1.useState)(true), isLoadingHand = _e[0], setIsLoadingHand = _e[1];
    var _f = (0, react_1.useState)([]), dealtCreatures = _f[0], setDealtCreatures = _f[1];
    var _g = (0, react_1.useState)(null), error = _g[0], setError = _g[1];
    var _h = (0, react_1.useState)(false), isConfirming = _h[0], setIsConfirming = _h[1]; // Prevent double confirm clicks
    var _j = (0, react_1.useState)(false), realtimeFailed = _j[0], setRealtimeFailed = _j[1]; // Track realtime failure
    var navigate = (0, react_router_dom_1.useNavigate)();
    var gameId = (0, react_router_dom_1.useParams)().gameId;
    var _k = (0, usePlayerIdentification_1.usePlayerIdentification)(), currentPlayerId = _k[0], playerError = _k[2];
    var realtimeChannelRef = (0, react_1.useRef)(null);
    var fetchIntervalRef = (0, react_1.useRef)(null);
    var pollingRef = (0, react_1.useRef)(null); // Fallback polling
    // Timer logic
    (0, react_1.useEffect)(function () {
        if (lost || waiting)
            return;
        if (timer <= 0) {
            setLost(true);
            return;
        }
        var intervalId = setInterval(function () {
            setTimer(function (prev) { return prev - 1; });
        }, 1000);
        return function () { return clearInterval(intervalId); };
    }, [timer, lost, waiting]);
    var toggleSelect = function (id) {
        if (lost || waiting || isConfirming)
            return;
        setSelected(function (currentSelected) {
            if (currentSelected.includes(id)) {
                return currentSelected.filter(function (cardId) { return cardId !== id; });
            }
            else if (currentSelected.length < 3) {
                return __spreadArray(__spreadArray([], currentSelected, true), [id], false);
            }
            else {
                return currentSelected;
            }
        });
    };
    var handleConfirm = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, gameData, _fetchError, isPlayer1, isPlayer2, updatePayload, updateError, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (selected.length !== 3 || lost || waiting || isConfirming || !gameId || !currentPlayerId) {
                        console.warn("[NFTSelection] Confirm button clicked but conditions not met:", {
                            selectedLength: selected.length,
                            lost: lost,
                            waiting: waiting,
                            isConfirming: isConfirming,
                            gameId: gameId,
                            currentPlayerId: currentPlayerId
                        });
                        return [2 /*return*/];
                    }
                    setIsConfirming(true); // Prevent double clicks
                    setError(null); // Clear previous errors
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, 5, 6]);
                    console.log("[NFTSelection] Confirming selection for player ".concat(currentPlayerId, " in game ").concat(gameId));
                    return [4 /*yield*/, supabase_1.supabase
                            .from('games')
                            .select('player1_id, player2_id')
                            .eq('id', gameId)
                            .single()];
                case 2:
                    _a = _b.sent(), gameData = _a.data, _fetchError = _a.error;
                    if (_fetchError)
                        throw _fetchError;
                    if (!gameData)
                        throw new Error("Game not found during confirmation.");
                    isPlayer1 = gameData.player1_id === currentPlayerId;
                    isPlayer2 = gameData.player2_id === currentPlayerId;
                    if (!isPlayer1 && !isPlayer2) {
                        throw new Error("You are not part of this game (confirmation check).");
                    }
                    updatePayload = {};
                    if (isPlayer1) {
                        updatePayload.player1_selected_creatures = selected;
                        updatePayload.player1_selection_complete = true;
                    }
                    else {
                        updatePayload.player2_selected_creatures = selected;
                        updatePayload.player2_selection_complete = true;
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('games')
                            .update(updatePayload)
                            .eq('id', gameId)];
                case 3:
                    updateError = (_b.sent()).error;
                    if (updateError)
                        throw updateError;
                    console.log("[NFTSelection] Selection confirmed successfully in DB.");
                    setWaiting(true);
                    return [3 /*break*/, 6];
                case 4:
                    err_1 = _b.sent();
                    console.error("[NFTSelection] Error confirming selection:", err_1);
                    setError(err_1 instanceof Error ? err_1.message : "An unknown error occurred during confirmation.");
                    return [3 /*break*/, 6];
                case 5:
                    setIsConfirming(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var getCardHeight = function (width) {
        var widthValue = parseFloat(width);
        return "".concat(widthValue / CARD_ASPECT_RATIO, "px");
    };
    var pollForOpponentCompletion = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, gameData, _fetchError, err_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!gameId)
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('games')
                            .select('player1_selection_complete, player2_selection_complete')
                            .eq('id', gameId)
                            .single()];
                case 2:
                    _a = _b.sent(), gameData = _a.data, _fetchError = _a.error;
                    // Use _fetchError here if needed for error handling
                    if (_fetchError)
                        throw _fetchError;
                    if ((gameData === null || gameData === void 0 ? void 0 : gameData.player1_selection_complete) && (gameData === null || gameData === void 0 ? void 0 : gameData.player2_selection_complete)) {
                        navigate("/game/".concat(gameId));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleRetryRealtime = function () {
        setError(null);
        setRealtimeFailed(false);
        setWaiting(true); // Triggers useEffect to resubscribe
    };
    (0, react_1.useEffect)(function () {
        if (realtimeFailed && waiting && gameId) {
            pollingRef.current = setInterval(pollForOpponentCompletion, 3000);
        }
        else if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        return function () {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [realtimeFailed, waiting, gameId]);
    (0, react_1.useEffect)(function () {
        if (!gameId || !currentPlayerId) {
            if (!gameId)
                setError("Game ID missing from URL.");
            if (!currentPlayerId && !playerError)
                setError("Identifying player...");
            if (playerError)
                setError("Error identifying player: ".concat(playerError));
            setIsLoadingHand(false);
            return;
        }
        var attempts = 0;
        var maxAttempts = 5;
        var intervalTime = 2000;
        var fetchHandData = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, gameData, error_1, isPlayer1, isPlayer2, dealtHandIds, selectionComplete, creatures, err_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("[NFTSelection] Attempt ".concat(attempts + 1, ": Fetching game data for ").concat(gameId));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, supabase_1.supabase
                                .from('games')
                                .select('player1_id, player2_id, player1_dealt_hand, player2_dealt_hand, player1_selection_complete, player2_selection_complete, status')
                                .eq('id', gameId)
                                .single()];
                    case 2:
                        _a = _b.sent(), gameData = _a.data, error_1 = _a.error;
                        if (error_1)
                            throw error_1;
                        if (!gameData) {
                            throw new Error("Game not found.");
                        }
                        isPlayer1 = gameData.player1_id === currentPlayerId;
                        isPlayer2 = gameData.player2_id === currentPlayerId;
                        if (!isPlayer1 && !isPlayer2) {
                            throw new Error("You are not part of this game.");
                        }
                        dealtHandIds = isPlayer1 ? gameData.player1_dealt_hand : gameData.player2_dealt_hand;
                        selectionComplete = isPlayer1 ? gameData.player1_selection_complete : gameData.player2_selection_complete;
                        if (!dealtHandIds || dealtHandIds.length === 0) {
                            if (attempts < maxAttempts - 1) {
                                console.log("[NFTSelection] Hands not dealt yet, polling again...");
                                attempts++;
                                fetchIntervalRef.current = setTimeout(fetchHandData, intervalTime);
                            }
                            else {
                                throw new Error("Failed to fetch dealt hand after multiple attempts. The dealing function might have failed.");
                            }
                            return [2 /*return*/];
                        }
                        if (fetchIntervalRef.current) {
                            clearTimeout(fetchIntervalRef.current);
                            fetchIntervalRef.current = null;
                        }
                        creatures = dealtHandIds
                            .map(function (id) { return ALL_CREATURES.find(function (c) { return c.id === id; }); })
                            .filter(function (c) { return !!c; });
                        if (creatures.length !== dealtHandIds.length) {
                            console.warn("[NFTSelection] Warning: Expected ".concat(dealtHandIds.length, " creatures, but found ").concat(creatures.length, " based on dealt IDs."));
                        }
                        if (creatures.length === 0 && dealtHandIds.length > 0) {
                            throw new Error("Dealt hand IDs found, but no matching creature data could be loaded.");
                        }
                        setDealtCreatures(creatures);
                        setError(null);
                        setIsLoadingHand(false);
                        if (selectionComplete) {
                            console.log("[NFTSelection] Player selection already complete, setting waiting state.");
                            setWaiting(true);
                        }
                        console.log("[NFTSelection] Dealt hand fetched successfully:", creatures.map(function (c) { return c.name; }));
                        return [3 /*break*/, 4];
                    case 3:
                        err_3 = _b.sent();
                        console.error("[NFTSelection] Error fetching dealt hand:", err_3);
                        setError(err_3 instanceof Error ? err_3.message : "An unknown error occurred fetching hand data.");
                        setIsLoadingHand(false);
                        if (fetchIntervalRef.current) {
                            clearTimeout(fetchIntervalRef.current);
                            fetchIntervalRef.current = null;
                        }
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        setIsLoadingHand(true);
        setError(null);
        fetchHandData();
        return function () {
            if (fetchIntervalRef.current) {
                console.log("[NFTSelection] Cleaning up polling timeout.");
                clearTimeout(fetchIntervalRef.current);
                fetchIntervalRef.current = null;
            }
        };
    }, [gameId, currentPlayerId, playerError]);
    (0, react_1.useEffect)(function () {
        if (!waiting || !gameId)
            return;
        var cancelled = false;
        var checkImmediateCompletion = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, gameData, _fetchError, err_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, supabase_1.supabase
                                .from('games')
                                .select('player1_selection_complete, player2_selection_complete')
                                .eq('id', gameId)
                                .single()];
                    case 1:
                        _a = _b.sent(), gameData = _a.data, _fetchError = _a.error;
                        // Use _fetchError here if needed for error handling
                        if (_fetchError)
                            console.warn("[NFTSelection] Error during immediate completion check:", _fetchError.message); // Example usage
                        if (!cancelled && (gameData === null || gameData === void 0 ? void 0 : gameData.player1_selection_complete) && (gameData === null || gameData === void 0 ? void 0 : gameData.player2_selection_complete)) {
                            navigate("/game/".concat(gameId));
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        err_4 = _b.sent();
                        // Optionally log error
                        console.warn("[NFTSelection] Exception during immediate completion check:", err_4);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        checkImmediateCompletion();
        return function () { cancelled = true; };
    }, [waiting, gameId, navigate]);
    (0, react_1.useEffect)(function () {
        if (!waiting || !gameId) {
            return;
        }
        console.log("[NFTSelection] Waiting state entered. Subscribing to game ".concat(gameId, " for opponent completion."));
        var handleGameUpdate = function (payload) {
            console.log('[NFTSelection] Realtime game update received:', payload);
            var game = payload["new"];
            if (game.player1_selection_complete && game.player2_selection_complete) {
                console.log('[NFTSelection] Both players confirmed! Navigating to game screen.');
                if (realtimeChannelRef.current) {
                    supabase_1.supabase.removeChannel(realtimeChannelRef.current);
                    realtimeChannelRef.current = null;
                }
                navigate("/game/".concat(gameId));
            }
        };
        realtimeChannelRef.current = supabase_1.supabase
            .channel("game-".concat(gameId, "-selection"))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: "id=eq.".concat(gameId) }, handleGameUpdate)
            .subscribe(function (status, err) {
            if (status === 'SUBSCRIBED') {
                console.log("[NFTSelection] Successfully subscribed to game ".concat(gameId, " updates."));
            }
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error("[NFTSelection] Realtime subscription error for game ".concat(gameId, ":"), status, err);
                setError("Failed to listen for opponent completion (".concat(status, "). Please refresh or retry."));
                setRealtimeFailed(true);
            }
        });
        return function () {
            if (realtimeChannelRef.current) {
                console.log("[NFTSelection] Cleaning up realtime subscription for game ".concat(gameId, "."));
                supabase_1.supabase.removeChannel(realtimeChannelRef.current);
                realtimeChannelRef.current = null;
            }
        };
    }, [waiting, gameId, navigate]);
    if (playerError) {
        return <div className="min-h-screen bg-gray-900 text-red-500 flex items-center justify-center">Error identifying player: {playerError}</div>;
    }
    if (isLoadingHand) {
        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading your hand... (Waiting for cards to be dealt)</div>;
    }
    if (error && !lost) {
        return (<div className="min-h-screen bg-gray-900 text-red-500 flex flex-col items-center justify-center">
        <div>Error: {error}</div>
        {realtimeFailed && (<button className="mt-4 px-6 py-2 bg-yellow-400 text-black rounded font-bold hover:bg-yellow-300" onClick={handleRetryRealtime}>
            Retry Connection
          </button>)}
      </div>);
    }
    if (!lost && dealtCreatures.length === 0) {
        return <div className="min-h-screen bg-gray-900 text-yellow-500 flex items-center justify-center">Could not load your hand. Please try refreshing.</div>;
    }
    return (<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-gray-800 p-8 rounded-lg shadow-xl relative">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-yellow-400">Select Your Team (Choose 3)</h1>
          <p className="text-xs text-gray-500">Game ID: {gameId || 'Loading...'}</p>
          <div className={"text-3xl font-bold px-4 py-1 rounded ".concat(timer <= 10 ? 'text-red-500 animate-pulse' : 'text-white')}>
            {timer}s
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 justify-items-center mb-8">
          {dealtCreatures.map(function (card) { return (<div key={card.id} style={{ width: CARD_WIDTH_DESKTOP, height: getCardHeight(CARD_WIDTH_DESKTOP) }} className={"relative group transform transition-transform duration-300 ease-in-out m-1\n                ".concat(lost || waiting || isConfirming ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-105')} onClick={function () { return toggleSelect(card.id); }}>
              <Card_1["default"] card={card} isSelected={selected.includes(card.id)} isDisabled={lost || waiting || isConfirming}/>
              {selected.includes(card.id) && (<div className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full p-1 leading-none z-10 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>)}
            </div>); })}
        </div>

        {selected.length > 0 && (<div className="mt-8 pt-4 border-t border-gray-700">
            <h2 className="text-xl font-semibold text-center mb-4 text-yellow-300">Your Team ({selected.length}/3)</h2>
            <div className="flex justify-center items-center gap-4 flex-wrap">
              {dealtCreatures
                .filter(function (card) { return selected.includes(card.id); })
                .map(function (card) { return (<div key={"selected-".concat(card.id)} style={{ width: '100px', height: getCardHeight('100px') }} className="relative shadow-md rounded-[10px] overflow-hidden border-2 border-gray-600 cursor-pointer hover:border-red-500 transition-colors" onClick={function () { return toggleSelect(card.id); }}>
                    <Card_1["default"] card={card} isSelected={true} isDisabled={lost || waiting || isConfirming}/>
                  </div>); })}
            </div>
          </div>)}

        <div className="text-center h-16 flex flex-col justify-center items-center mt-12">
          {lost ? (<p className="text-2xl font-bold text-red-500">Time Expired - You Lost!</p>) : waiting ? (<p className="text-xl font-semibold text-green-400 animate-pulse">Waiting for opponent...</p>) : (<button onClick={handleConfirm} disabled={selected.length !== 3 || isConfirming} className={"font-bold py-3 px-10 rounded-md transition duration-200 ease-in-out \n                ".concat(selected.length !== 3 || isConfirming
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105 active:scale-100')}>
              {isConfirming ? 'Confirming...' : "Confirm Selection (".concat(selected.length, "/3)")}
            </button>)}
        </div>
      </div>
    </div>);
};
exports["default"] = NFTSelection;
