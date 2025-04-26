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
exports.useGameStateSync = void 0;
var react_1 = require("react");
var state_1 = require("../game/state");
var supabase_1 = require("../utils/supabase"); // Assuming unsubscribe is exported
/**
 * Hook to fetch the initial game state and subscribe to real-time updates.
 * Assumes the game state should already be initialized in the database.
 *
 * @param gameId The ID of the game to sync with.
 * @param setError Callback to set an error message in the parent component.
 * @returns A tuple: [gameState, dispatch, isLoading]
 */
function useGameStateSync(gameId, setError) {
    var _this = this;
    // Initialize reducer with null state
    var _a = (0, react_1.useReducer)(state_1.gameReducer, null), gameState = _a[0], dispatch = _a[1];
    var _b = (0, react_1.useState)(true), isLoading = _b[0], setIsLoading = _b[1];
    (0, react_1.useEffect)(function () {
        if (!gameId) {
            console.log("[useGameStateSync] No gameId provided, skipping fetch and subscription.");
            setError("No game ID specified.");
            setIsLoading(false);
            // Dispatch null state if gameId becomes null after being set
            if (gameState !== null) {
                dispatch({ type: 'SET_GAME_STATE', payload: null });
            }
            return;
        }
        console.log("[useGameStateSync] Initializing for game ".concat(gameId, ". Fetching initial state..."));
        setIsLoading(true);
        setError(null); // Clear previous errors
        var channel = null;
        var setupSync = function () { return __awaiter(_this, void 0, void 0, function () {
            var initialState, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, 3, 4]);
                        return [4 /*yield*/, (0, supabase_1.getGameState)(gameId)];
                    case 1:
                        initialState = _a.sent();
                        if (initialState) {
                            console.log("[useGameStateSync] Initial state fetched for game ".concat(gameId, ". Phase: ").concat(initialState.phase, ". Dispatching SET_GAME_STATE."));
                            dispatch({ type: 'SET_GAME_STATE', payload: initialState });
                        }
                        else {
                            // This is now considered an error condition, as initialization should happen before GameScreen
                            console.error("[useGameStateSync] Error: Game state is null for game ".concat(gameId, ". Initialization likely failed or hasn't occurred."));
                            setError("Game not found or unable to load initial state (ID: ".concat(gameId, "). Ensure initialization happened after NFT selection."));
                            // Dispatch null state if it wasn't already null
                            if (gameState !== null) {
                                dispatch({ type: 'SET_GAME_STATE', payload: null });
                            }
                        }
                        // 2. Subscribe to updates (regardless of initial fetch success, maybe state gets created later?)
                        // Although, ideally, we shouldn't reach GameScreen without initial state.
                        console.log("[useGameStateSync] Subscribing to real-time updates for game ".concat(gameId, "."));
                        channel = (0, supabase_1.subscribeToGameState)(gameId, function (newState) {
                            console.log("[useGameStateSync] Realtime update received for game ".concat(gameId, ". Phase: ").concat(newState.phase, ". Dispatching SET_GAME_STATE."));
                            dispatch({ type: 'SET_GAME_STATE', payload: newState });
                        });
                        return [3 /*break*/, 4];
                    case 2:
                        err_1 = _a.sent();
                        console.error("[useGameStateSync] Error setting up game sync for ".concat(gameId, ":"), err_1);
                        setError("Failed to load or sync game state: ".concat(err_1.message || 'Unknown error'));
                        if (gameState !== null) {
                            dispatch({ type: 'SET_GAME_STATE', payload: null });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        console.log("[useGameStateSync] Initial setup finished for game ".concat(gameId, ". Setting isLoading to false."));
                        setIsLoading(false);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        setupSync();
        // Cleanup function
        return function () {
            if (channel) {
                console.log("[useGameStateSync] Cleaning up: Unsubscribing from game ".concat(gameId, "."));
                (0, supabase_1.unsubscribeFromGameState)(channel); // Use the unsubscribe function
                channel = null;
            }
        };
        // Re-run effect if gameId changes
    }, [gameId, setError]); // Removed gameState from dependencies to avoid potential loops
    return [gameState, dispatch, isLoading];
}
exports.useGameStateSync = useGameStateSync;
