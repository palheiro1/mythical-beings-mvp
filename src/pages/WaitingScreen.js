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
// Create file: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/src/pages/WaitingScreen.tsx
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var supabase_1 = require("../utils/supabase");
var AuthContext_1 = require("../context/AuthContext");
var WaitingScreen = function () {
    var gameId = (0, react_router_dom_1.useParams)().gameId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, AuthContext_1.useAuth)(), user = _a.user, authLoading = _a.loading; // Use auth loading state
    var _b = (0, react_1.useState)(null), error = _b[0], setError = _b[1];
    var _c = (0, react_1.useState)(null), status = _c[0], setStatus = _c[1];
    var _d = (0, react_1.useState)(true), loading = _d[0], setLoading = _d[1];
    (0, react_1.useEffect)(function () {
        // Don't proceed until auth is loaded and gameId is present
        if (authLoading || !gameId) {
            console.log("[WaitingScreen] Waiting for auth (".concat(authLoading, ") or gameId (").concat(gameId, ")"));
            return;
        }
        var channel = null;
        var isMounted = true;
        var setupWaitingScreen = function () { return __awaiter(void 0, void 0, void 0, function () {
            var details, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setLoading(true);
                        setError(null);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        console.log("[WaitingScreen] Setting up for game: ".concat(gameId));
                        return [4 /*yield*/, (0, supabase_1.getGameDetails)(gameId)];
                    case 2:
                        details = _a.sent();
                        if (!isMounted)
                            return [2 /*return*/];
                        if (!details) {
                            throw new Error("Game not found or you don't have access.");
                        }
                        // Basic check: Is the current user part of this game?
                        // More robust checks might be needed depending on requirements
                        if (details.player1_id !== (user === null || user === void 0 ? void 0 : user.id) && details.player2_id !== (user === null || user === void 0 ? void 0 : user.id)) {
                            console.warn("[WaitingScreen] User ".concat(user === null || user === void 0 ? void 0 : user.id, " is not part of game ").concat(gameId, ". Redirecting to lobby."));
                            navigate('/lobby', { replace: true, state: { message: 'You are not part of that game.' } });
                            return [2 /*return*/];
                        }
                        setStatus(details.status);
                        console.log("[WaitingScreen] Initial status for ".concat(gameId, ": ").concat(details.status));
                        // Navigate immediately if status is already selecting or active
                        if (details.status === 'selecting') {
                            console.log("[WaitingScreen] Status is 'selecting'. Navigating to NFT selection.");
                            navigate("/nft-selection/".concat(gameId), { replace: true });
                            return [2 /*return*/];
                        }
                        if (details.status === 'active') {
                            console.log("[WaitingScreen] Status is 'active'. Navigating to game screen.");
                            navigate("/game/".concat(gameId), { replace: true });
                            return [2 /*return*/];
                        }
                        if (details.status !== 'waiting') {
                            console.log("[WaitingScreen] Game status is not 'waiting' (".concat(details.status, "). Navigating to lobby."));
                            navigate('/lobby', { replace: true, state: { message: "Game status is ".concat(details.status, ".") } });
                            return [2 /*return*/];
                        }
                        // If status is 'waiting', subscribe to changes
                        console.log("[WaitingScreen] Status is 'waiting'. Subscribing to updates for ".concat(gameId, "."));
                        channel = supabase_1.supabase
                            .channel("game-status-".concat(gameId))
                            .on('postgres_changes', {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'games',
                            filter: "id=eq.".concat(gameId)
                        }, function (payload) {
                            var _a;
                            if (!isMounted)
                                return;
                            console.log('[WaitingScreen] Realtime update received:', payload);
                            var newStatus = (_a = payload["new"]) === null || _a === void 0 ? void 0 : _a.status;
                            if (newStatus) {
                                setStatus(newStatus); // Update local status
                                console.log("[WaitingScreen] Game status changed to: ".concat(newStatus));
                                if (newStatus === 'selecting') {
                                    console.log("[WaitingScreen] Opponent joined! Navigating to NFT selection.");
                                    // Unsubscribe before navigating
                                    if (channel) {
                                        supabase_1.supabase.removeChannel(channel).then(function () {
                                            console.log('[WaitingScreen] Unsubscribed before navigation.');
                                            if (isMounted)
                                                navigate("/nft-selection/".concat(gameId), { replace: true });
                                        });
                                        channel = null; // Prevent double removal in cleanup
                                    }
                                    else if (isMounted) {
                                        navigate("/nft-selection/".concat(gameId), { replace: true });
                                    }
                                }
                                else if (newStatus !== 'waiting') {
                                    // Handle other status changes if needed (e.g., cancelled remotely)
                                    console.log("[WaitingScreen] Game status changed to ".concat(newStatus, ". Navigating to lobby."));
                                    if (channel) {
                                        supabase_1.supabase.removeChannel(channel).then(function () {
                                            console.log('[WaitingScreen] Unsubscribed before navigation (non-selecting status).');
                                            if (isMounted)
                                                navigate('/lobby', { replace: true, state: { message: "Game status changed to ".concat(newStatus, ".") } });
                                        });
                                        channel = null;
                                    }
                                    else if (isMounted) {
                                        navigate('/lobby', { replace: true, state: { message: "Game status changed to ".concat(newStatus, ".") } });
                                    }
                                }
                            }
                        })
                            .subscribe(function (subStatus, err) {
                            if (!isMounted)
                                return;
                            if (subStatus === 'SUBSCRIBED') {
                                console.log("[WaitingScreen] Subscribed successfully to status updates for ".concat(gameId));
                                setLoading(false); // Stop loading once subscribed
                            }
                            else if (err) {
                                console.error("[WaitingScreen] Subscription error for ".concat(gameId, ":"), err);
                                setError('Failed to listen for game updates. Please try again.');
                                setLoading(false);
                            }
                            else {
                                console.log("[WaitingScreen] Subscription status: ".concat(subStatus));
                            }
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        if (!isMounted)
                            return [2 /*return*/];
                        console.error("[WaitingScreen] Error checking status or subscribing:", err_1);
                        setError(err_1.message || "Failed to load game details.");
                        setLoading(false);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        setupWaitingScreen();
        // Cleanup function
        return function () {
            isMounted = false;
            if (channel) {
                console.log("[WaitingScreen] Cleaning up subscription for ".concat(gameId));
                supabase_1.supabase.removeChannel(channel);
                channel = null;
            }
        };
    }, [gameId, navigate, user === null || user === void 0 ? void 0 : user.id, authLoading]); // Depend on authLoading
    var handleBackToLobby = function () {
        navigate('/lobby');
    };
    // Display loading state while checking auth or initial game status
    if (authLoading || loading) {
        return (<div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-400">
                <p>Loading game information...</p>
                <div className="animate-pulse text-lg mt-4">⏳</div>
            </div>);
    }
    if (error) {
        return (<div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-red-500">
                <p>Error: {error}</p>
                <button onClick={handleBackToLobby} className="mt-4 underline text-blue-400 hover:text-blue-300">
                    Back to Lobby
                </button>
            </div>);
    }
    // Only show waiting message if status is confirmed 'waiting'
    if (status === 'waiting') {
        return (<div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-400">
                <h1 className="text-2xl text-white mb-4">Waiting for Opponent...</h1>
                <p className="mb-2">Game ID: <span className="text-yellow-500">{gameId}</span></p>
                <p className="mb-6">Share this ID or wait for someone to join from the lobby.</p>
                <div className="animate-pulse text-lg mb-8">⏳</div>
                <button onClick={handleBackToLobby} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200">
                    Back to Lobby
                </button>
            </div>);
    }
    // Fallback or if status is unexpected (should have navigated away already)
    return (<div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-400">
            <p>Checking game status...</p>
             <button onClick={handleBackToLobby} className="mt-4 underline text-blue-400 hover:text-blue-300">
                 Back to Lobby
             </button>
         </div>);
};
exports["default"] = WaitingScreen;
