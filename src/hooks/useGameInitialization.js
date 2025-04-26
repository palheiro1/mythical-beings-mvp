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
exports.useGameInitialization = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
// Remove getGameDetails, add supabase
var supabase_1 = require("../utils/supabase");
var state_1 = require("../game/state");
var uuid_1 = require("uuid");
// Assign a unique instanceId to each knowledge card for React keys
function assignInstanceIds(state) {
    var mapCard = function (c) { return (__assign(__assign({}, c), { instanceId: c.instanceId || (0, uuid_1.v4)() })); };
    return __assign(__assign({}, state), { market: state.market.map(mapCard), knowledgeDeck: state.knowledgeDeck.map(mapCard), discardPile: state.discardPile.map(mapCard), players: state.players.map(function (p) { return (__assign(__assign({}, p), { hand: p.hand.map(mapCard), field: p.field.map(function (slot) { return slot.knowledge
                ? { creatureId: slot.creatureId, knowledge: mapCard(slot.knowledge) }
                : slot; }) })); }) });
}
// Wrapper for the original reducer to handle the null case gracefully
var gameScreenReducer = function (state, action) {
    var _a;
    if (action.type === 'SET_GAME_STATE') {
        // Ensure payload is not null before setting
        return (_a = action.payload) !== null && _a !== void 0 ? _a : null;
    }
    // INITIALIZE_GAME is handled within the hook's effect, not directly by dispatching
    if (state === null) {
        // Don't try to apply game actions to a null state, except for SET_GAME_STATE
        console.error("[Reducer] Attempted action on null state:", action.type);
        return null;
    }
    return (0, state_1.gameReducer)(state, action);
};
/**
 * Hook to initialize the game state, fetch existing state, or create a new game,
 * and manage the Supabase real-time subscription.
 * @param currentPlayerId The ID of the currently logged-in player.
 * @param setError Callback to set error messages in the parent component.
 * @returns The game state, dispatch function, loading status, and the game ID.
 */
function useGameInitialization(currentPlayerId, setError) {
    var _this = this;
    var gameId = (0, react_router_dom_1.useParams)().gameId;
    var _a = (0, react_1.useReducer)(gameScreenReducer, null), state = _a[0], dispatch = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var isInitializing = (0, react_1.useRef)(false); // Ref to prevent concurrent initializations
    var currentInitializedGameId = (0, react_1.useRef)(null); // Ref to track the gameId being initialized/initialized
    (0, react_1.useEffect)(function () {
        // Clear state and reset if gameId or currentPlayerId changes/becomes invalid
        if (!gameId || !currentPlayerId) {
            console.log('[useGameInit] Resetting: Missing gameId or currentPlayerId.');
            setLoading(true);
            if (state !== null) {
                dispatch({ type: 'SET_GAME_STATE', payload: null });
            }
            currentInitializedGameId.current = null; // Reset tracking
            isInitializing.current = false;
            return;
        }
        // Prevent re-initialization if already initializing or if state for this gameId exists and is not loading
        if (isInitializing.current || ((state === null || state === void 0 ? void 0 : state.gameId) === gameId && !loading)) {
            console.log("[useGameInit] Skipping setup: isInitializing=".concat(isInitializing.current, ", state?.gameId=").concat(state === null || state === void 0 ? void 0 : state.gameId, ", loading=").concat(loading));
            // If state exists but loading is true, ensure it gets set to false eventually (e.g., after HMR)
            if ((state === null || state === void 0 ? void 0 : state.gameId) === gameId && loading) {
                console.log("[useGameInit] State for ".concat(gameId, " exists, ensuring loading is false."));
                setLoading(false);
            }
            return;
        }
        console.log("[useGameInit] Starting Effect run for gameId: ".concat(gameId, ", currentPlayerId: ").concat(currentPlayerId));
        isInitializing.current = true; // Mark as initializing
        currentInitializedGameId.current = gameId; // Track the game being initialized
        setLoading(true); // Explicitly set loading true at the start
        setError(null);
        var subscription = null; // Use RealtimeChannel type
        var isMounted = true;
        var handleRealtimeUpdate = function (newState) {
            // Check mount status and if the update is for the gameId currently being managed by this effect instance
            if (!isMounted || currentInitializedGameId.current !== gameId) {
                console.log("[Realtime] Ignoring update: isMounted=".concat(isMounted, ", gameId mismatch (current: ").concat(currentInitializedGameId.current, ", update: ").concat(gameId, ")"));
                return;
            }
            if (!newState) {
                console.warn("[Realtime] Received null state update for game ".concat(gameId, "."));
                // Optionally handle this - maybe show an error or revert to loading?
                // For now, we'll just ignore it and keep the current state.
                return;
            }
            console.log("[Realtime] Received state update for game ".concat(gameId, ". Phase: ").concat(newState === null || newState === void 0 ? void 0 : newState.phase));
            // Optional: Add validation if needed
            // if (newState.players[0]?.id?.startsWith('p') || newState.players[1]?.id?.startsWith('p')) { ... }
            dispatch({ type: 'SET_GAME_STATE', payload: assignInstanceIds(newState) });
            // Ensure loading is false if we receive an update (might happen if initial load failed but subscription worked)
            if (loading) {
                console.log("[Realtime] Setting loading to false after receiving update.");
                setLoading(false);
            }
        };
        var setupGame = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, gameDetails, detailsError, player1Id, player2Id, player1SelectedIds, player2SelectedIds, gameState, isNewGameInitialization, initializedState, stateWithIds, updateResult, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("[setupGame] Starting setup logic for game: ".concat(gameId, ", player: ").concat(currentPlayerId));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, 10, 11]);
                        return [4 /*yield*/, supabase_1.supabase
                                .from('games')
                                .select('player1_id, player2_id, player1_selected_creatures, player2_selected_creatures') // Fetch selected creatures
                                .eq('id', gameId)
                                .single()];
                    case 2:
                        _a = _b.sent(), gameDetails = _a.data, detailsError = _a.error;
                        if (detailsError)
                            throw detailsError;
                        // Check mount status and if the gameId hasn't changed since the effect started
                        if (!isMounted || currentInitializedGameId.current !== gameId) {
                            console.log("[setupGame] Aborting fetch details: isMounted=".concat(isMounted, ", gameId mismatch."));
                            isInitializing.current = false; // Allow re-initialization if needed later
                            return [2 /*return*/];
                        }
                        if (!gameDetails) {
                            // If details are missing, the game likely doesn't exist or isn't ready.
                            throw new Error("Game details not found for game ID: ".concat(gameId, ". It might not exist or hasn't been fully created."));
                        }
                        player1Id = gameDetails.player1_id;
                        player2Id = gameDetails.player2_id;
                        player1SelectedIds = gameDetails.player1_selected_creatures;
                        player2SelectedIds = gameDetails.player2_selected_creatures;
                        // --- End get selected creature IDs ---
                        if (!player2Id) {
                            // If second player hasn't joined yet, retry after a delay
                            console.log("[setupGame] Player 2 not joined yet for game ".concat(gameId, ". Retrying in 2s..."));
                            setTimeout(function () {
                                if (isMounted && currentInitializedGameId.current === gameId) {
                                    setupGame();
                                }
                            }, 2000);
                            // keep loading and wait
                            return [2 /*return*/];
                        }
                        console.log("[setupGame] Fetched game details. P1: ".concat(player1Id, ", P2: ").concat(player2Id));
                        return [4 /*yield*/, (0, supabase_1.getGameState)(gameId)];
                    case 3:
                        gameState = _b.sent();
                        if (!isMounted || currentInitializedGameId.current !== gameId) {
                            console.log("[setupGame] Aborting fetch state: isMounted=".concat(isMounted, ", gameId mismatch."));
                            isInitializing.current = false;
                            return [2 /*return*/];
                        }
                        isNewGameInitialization = false;
                        initializedState = null;
                        if (!!gameState) return [3 /*break*/, 7];
                        if (!(currentPlayerId === player1Id)) return [3 /*break*/, 5];
                        console.log("[setupGame] Game state for ".concat(gameId, " not found. Initializing as Player 1..."));
                        isNewGameInitialization = true;
                        // --- Use selected creature IDs for initialization ---
                        if (!player1SelectedIds || !player2SelectedIds || player1SelectedIds.length !== 3 || player2SelectedIds.length !== 3) {
                            throw new Error("Selected creature data is missing or incomplete in the database.");
                        }
                        initializedState = (0, state_1.initializeGame)({
                            gameId: gameId,
                            player1Id: player1Id,
                            player2Id: player2Id,
                            player1SelectedIds: player1SelectedIds,
                            player2SelectedIds: player2SelectedIds
                        });
                        // --- End use selected creature IDs ---
                        console.log("[setupGame] Game ".concat(gameId, " initialized locally by Player 1. Phase: ").concat(initializedState.phase));
                        // 4. Update DB immediately if P1 just initialized
                        console.log("[setupGame] Updating initial game state in Supabase for ".concat(gameId, " as Player 1..."));
                        stateWithIds = assignInstanceIds(initializedState);
                        return [4 /*yield*/, (0, supabase_1.updateGameState)(gameId, stateWithIds)];
                    case 4:
                        updateResult = _b.sent();
                        // Check mount status and gameId *again* before proceeding
                        if (!isMounted || currentInitializedGameId.current !== gameId) {
                            console.log("[setupGame] Aborting post-update: isMounted=".concat(isMounted, ", gameId mismatch."));
                            isInitializing.current = false;
                            return [2 /*return*/];
                        }
                        if (!updateResult) {
                            console.error("[setupGame] Failed to update initial game state in Supabase for ".concat(gameId, "."));
                            // Check mount status before setting error
                            if (isMounted && currentInitializedGameId.current === gameId) {
                                setError("Failed to save initial game state."); // Inform user
                            }
                            // Don't proceed to dispatch if DB update failed
                            initializedState = null; // Prevent dispatching the failed state
                        }
                        else {
                            console.log("[setupGame] Successfully updated initial game state in Supabase.");
                            // Proceed to dispatch this initializedState below
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        // Player 2: State is null, but wait for Player 1 to initialize it.
                        console.log("[setupGame] Game state for ".concat(gameId, " not found. Waiting for Player 1 to initialize..."));
                        _b.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        // Game state WAS found initially
                        console.log("[setupGame] Game ".concat(gameId, " state found. Phase: ").concat(gameState.phase));
                        if (gameState.players[0].id !== player1Id || gameState.players[1].id !== player2Id) {
                            console.warn("[setupGame] Mismatch between game_states player IDs and games table IDs.");
                            // Potentially throw an error or try to recover
                        }
                        // Use the fetched state
                        initializedState = gameState;
                        _b.label = 8;
                    case 8:
                        // 5. Set local state and loading status (only if state is available)
                        // Check mount status and gameId *again* before dispatching
                        if (isMounted && currentInitializedGameId.current === gameId) {
                            if (initializedState) {
                                dispatch({ type: 'SET_GAME_STATE', payload: initializedState });
                                console.log("[setupGame] Dispatched ".concat(isNewGameInitialization ? 'new' : 'existing', " SET_GAME_STATE. Setting loading to false."));
                                setLoading(false); // Set loading false *after* dispatching state
                            }
                            else if (currentPlayerId !== player1Id && !gameState) {
                                // Player 2 is still waiting, do nothing here, loading remains true
                                console.log("[setupGame] Player 2 still waiting for initial state, keeping loading=true.");
                            }
                            else {
                                // State is unexpectedly null (e.g., P1 init failed DB save)
                                console.error("[setupGame] State is null after initialization/fetch attempt for ".concat(gameId, "."));
                                setError("Error: Game not found or unable to load initial state. Ensure initialization happened after NFT selection.");
                                setLoading(false);
                            }
                        }
                        else {
                            console.log("[setupGame] Aborting dispatch: isMounted=".concat(isMounted, ", gameId mismatch."));
                            isInitializing.current = false; // Reset flag if we abort
                            return [2 /*return*/];
                        }
                        // 6. Subscribe to real-time updates (Both players do this, even if P2 is still waiting for initial state)
                        // Check mount status and gameId *again* before subscribing
                        if (isMounted && currentInitializedGameId.current === gameId) {
                            // Avoid subscribing if already subscribed (e.g., due to HMR without full unmount)
                            if (!subscription) {
                                console.log("[setupGame] Setting up real-time subscription for ".concat(gameId, "."));
                                subscription = (0, supabase_1.subscribeToGameState)(gameId, handleRealtimeUpdate);
                                console.log("[setupGame] Subscribed to realtime updates for ".concat(gameId, "."));
                            }
                            else {
                                console.log("[setupGame] Subscription already exists for ".concat(gameId, ". Skipping subscribe call."));
                            }
                        }
                        else {
                            console.log("[setupGame] Aborting subscription: isMounted=".concat(isMounted, ", gameId mismatch."));
                        }
                        return [3 /*break*/, 11];
                    case 9:
                        err_1 = _b.sent();
                        console.error('[setupGame] Error:', err_1);
                        // Check mount status and gameId *again* before setting error/loading
                        if (isMounted && currentInitializedGameId.current === gameId) {
                            setError("Failed to setup game: ".concat(err_1 instanceof Error ? err_1.message : String(err_1)));
                            setLoading(false); // Ensure loading is false on error
                        }
                        else {
                            console.log("[setupGame] Error occurred, but component unmounted or gameId changed. Ignoring error.");
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        // Only mark as not initializing if this effect instance was for the current gameId
                        if (currentInitializedGameId.current === gameId) {
                            isInitializing.current = false;
                            console.log("[setupGame] Finished setup attempt for game: ".concat(gameId, ". isInitializing set to false."));
                        }
                        else {
                            console.log("[setupGame] Finished setup for a different gameId (".concat(currentInitializedGameId.current, "). Not changing isInitializing."));
                        }
                        return [7 /*endfinally*/];
                    case 11: return [2 /*return*/];
                }
            });
        }); };
        setupGame();
        // Cleanup function
        return function () {
            console.log("[useGameInit] Cleanup running for effect associated with gameId: ".concat(gameId, "."));
            isMounted = false;
            // Unsubscribe only if this cleanup corresponds to the gameId we initialized *and* subscribed for
            if (subscription && currentInitializedGameId.current === gameId) {
                (0, supabase_1.unsubscribeFromGameState)(subscription);
                console.log("[useGameInit] Unsubscribed from realtime updates for ".concat(gameId, "."));
                subscription = null; // Clear subscription variable
            }
            else {
                console.log("[useGameInit] No unsubscription needed (no subscription object or gameId mismatch).");
            }
            // Reset initialization flag *only if* this cleanup is for the gameId that was being initialized
            if (isInitializing.current && currentInitializedGameId.current === gameId) {
                console.log("[useGameInit] Resetting isInitializing flag during cleanup for ".concat(gameId, "."));
                isInitializing.current = false;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId, currentPlayerId, setError]); // state and loading are managed internally by the hook
    return [state, dispatch, loading, gameId];
}
exports.useGameInitialization = useGameInitialization;
