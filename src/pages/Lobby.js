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
var AuthContext_1 = require("../context/AuthContext");
var usePlayerIdentification_1 = require("../hooks/usePlayerIdentification");
var supabase_1 = require("../utils/supabase");
var uuid_1 = require("uuid");
var NavBar_1 = require("../components/NavBar"); // Import NavBar
var Lobby = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var authLoading = (0, AuthContext_1.useAuth)().loading;
    var _a = (0, usePlayerIdentification_1.usePlayerIdentification)(), currentPlayerId = _a[0], playerError = _a[2], idLoading = _a[4];
    var _b = (0, react_1.useState)([]), availableGames = _b[0], setAvailableGames = _b[1];
    var _c = (0, react_1.useState)(true), loadingGames = _c[0], setLoadingGames = _c[1];
    var _d = (0, react_1.useState)(null), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(false), showCreateModal = _e[0], setShowCreateModal = _e[1];
    var _f = (0, react_1.useState)(0), betAmount = _f[0], setBetAmount = _f[1];
    var _g = (0, react_1.useState)(null), notification = _g[0], setNotification = _g[1];
    var _h = (0, react_1.useState)(false), isCreating = _h[0], setIsCreating = _h[1];
    var _j = (0, react_1.useState)({ username: null, avatar_url: null }), userProfile = _j[0], setUserProfile = _j[1];
    var _k = (0, react_1.useState)({}), onlineUsers = _k[0], setOnlineUsers = _k[1];
    var presenceChannelRef = (0, react_1.useRef)(null);
    var isLoading = authLoading || idLoading || loadingGames;
    console.log('[Lobby] Rendering component...', { isLoading: isLoading, error: error, gamesCount: availableGames.length, currentPlayerId: currentPlayerId });
    var fetchGamesAndProfiles = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var fetchedGames, gamesWithUsernames, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('[Lobby] fetchGamesAndProfiles: Fetching games...');
                    setLoadingGames(true);
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    return [4 /*yield*/, (0, supabase_1.getAvailableGames)()];
                case 2:
                    fetchedGames = _a.sent();
                    if (!fetchedGames) return [3 /*break*/, 4];
                    console.log('[Lobby] fetchGamesAndProfiles: Fetched games data:', fetchedGames);
                    return [4 /*yield*/, Promise.all(fetchedGames.map(function (game) { return __awaiter(void 0, void 0, void 0, function () {
                            var creatorUsername, profile;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        creatorUsername = null;
                                        if (!game.player1_id) return [3 /*break*/, 2];
                                        return [4 /*yield*/, (0, supabase_1.getProfile)(game.player1_id)];
                                    case 1:
                                        profile = _a.sent();
                                        creatorUsername = (profile === null || profile === void 0 ? void 0 : profile.username) || game.player1_id.substring(0, 8);
                                        _a.label = 2;
                                    case 2: return [2 /*return*/, __assign(__assign({}, game), { creatorUsername: creatorUsername })];
                                }
                            });
                        }); }))];
                case 3:
                    gamesWithUsernames = _a.sent();
                    console.log('[Lobby] fetchGamesAndProfiles: Games with usernames:', gamesWithUsernames);
                    setAvailableGames(gamesWithUsernames);
                    return [3 /*break*/, 5];
                case 4:
                    setAvailableGames([]);
                    _a.label = 5;
                case 5:
                    setError(null);
                    return [3 /*break*/, 8];
                case 6:
                    error_1 = _a.sent();
                    console.error('[Lobby] fetchGamesAndProfiles: Error fetching games or profiles:', error_1);
                    setError('Failed to fetch games or creator profiles');
                    setAvailableGames([]);
                    return [3 /*break*/, 8];
                case 7:
                    console.log('[Lobby] fetchGamesAndProfiles: Setting loadingGames to false.');
                    setLoadingGames(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); }, []);
    (0, react_1.useEffect)(function () {
        if (!authLoading && !idLoading) {
            fetchGamesAndProfiles();
        }
    }, [authLoading, idLoading, fetchGamesAndProfiles]);
    (0, react_1.useEffect)(function () {
        if (playerError) {
            console.warn('[Lobby] Player identification error:', playerError);
            setNotification("Error identifying player: ".concat(playerError));
            var timer_1 = setTimeout(function () { return setNotification(null); }, 5000);
            return function () { return clearTimeout(timer_1); };
        }
    }, [playerError]);
    (0, react_1.useEffect)(function () {
        if (currentPlayerId) {
            (0, supabase_1.getProfile)(currentPlayerId)
                .then(function (profile) {
                setUserProfile({ username: (profile === null || profile === void 0 ? void 0 : profile.username) || null, avatar_url: (profile === null || profile === void 0 ? void 0 : profile.avatar_url) || null });
            })["catch"](console.error);
        }
    }, [currentPlayerId]);
    (0, react_1.useEffect)(function () {
        if (!supabase_1.supabase)
            return;
        console.log('[Lobby Realtime] Setting up games subscription.');
        var gamesChannel = supabase_1.supabase
            .channel('public:games')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games', filter: 'status=eq.waiting' }, function (payload) { return __awaiter(void 0, void 0, void 0, function () {
            var newGame, creatorUsername, profile, err_1, gameWithUsername;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[Lobby Realtime] New game detected:', payload["new"]);
                        newGame = payload["new"];
                        creatorUsername = null;
                        if (!newGame.player1_id) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, supabase_1.getProfile)(newGame.player1_id)];
                    case 2:
                        profile = _a.sent();
                        creatorUsername = (profile === null || profile === void 0 ? void 0 : profile.username) || newGame.player1_id.substring(0, 8);
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        console.error('[Lobby Realtime] Error fetching profile for new game creator:', err_1);
                        creatorUsername = newGame.player1_id.substring(0, 8);
                        return [3 /*break*/, 4];
                    case 4:
                        gameWithUsername = __assign(__assign({}, newGame), { creatorUsername: creatorUsername });
                        setAvailableGames(function (currentGames) {
                            if (currentGames.some(function (game) { return game.id === gameWithUsername.id; })) {
                                return currentGames;
                            }
                            return __spreadArray(__spreadArray([], currentGames, true), [gameWithUsername], false);
                        });
                        return [2 /*return*/];
                }
            });
        }); })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, function (payload) {
            console.log('[Lobby Realtime] Game update detected:', payload["new"]);
            var updatedGame = payload["new"];
            setAvailableGames(function (currentGames) {
                return currentGames.map(function (game) {
                    return game.id === updatedGame.id ? __assign(__assign(__assign({}, game), updatedGame), { creatorUsername: game.creatorUsername }) : game;
                }).filter(function (game) { return game.status === 'waiting'; });
            });
        })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'games' }, function (payload) {
            console.log('[Lobby Realtime] Game delete detected:', payload.old);
            var deletedGameId = payload.old.id;
            setAvailableGames(function (currentGames) {
                return currentGames.filter(function (game) { return game.id !== deletedGameId; });
            });
        })
            .subscribe(function (status, err) {
            if (status === 'SUBSCRIBED') {
                console.log('[Lobby Realtime] Successfully subscribed to games channel.');
            }
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('[Lobby Realtime] Subscription error:', err);
                setError('Realtime connection error for game list.');
            }
        });
        return function () {
            if (gamesChannel) {
                console.log('[Lobby Realtime] Unsubscribing from games channel.');
                supabase_1.supabase.removeChannel(gamesChannel);
            }
        };
    }, [supabase_1.supabase]);
    (0, react_1.useEffect)(function () {
        if (!supabase_1.supabase || !currentPlayerId || !userProfile.username) {
            console.log('[Lobby Presence] Waiting for Supabase/User ID/Profile before subscribing.');
            return;
        }
        console.log('[Lobby Presence] Setting up presence channel.');
        var channel = supabase_1.supabase.channel('lobby-presence', {
            config: {
                presence: {
                    key: currentPlayerId
                }
            }
        });
        var fetchProfileForUser = function (userId) { return __awaiter(void 0, void 0, void 0, function () {
            var profile_1, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!onlineUsers[userId]) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, supabase_1.getProfile)(userId)];
                    case 2:
                        profile_1 = _a.sent();
                        setOnlineUsers(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[userId] = {
                                username: (profile_1 === null || profile_1 === void 0 ? void 0 : profile_1.username) || "User (".concat(userId.substring(0, 6), ")"),
                                avatar_url: (profile_1 === null || profile_1 === void 0 ? void 0 : profile_1.avatar_url) || null
                            }, _a)));
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _a.sent();
                        console.error("[Lobby Presence] Error fetching profile for ".concat(userId, ":"), err_2);
                        setOnlineUsers(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[userId] = { username: "User (".concat(userId.substring(0, 6), ")"), avatar_url: null }, _a)));
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        channel
            .on('presence', { event: 'sync' }, function () {
            console.log('[Lobby Presence] Sync event received.');
            var newState = channel.presenceState();
            console.log('[Lobby Presence] Current presence state:', newState);
            var userIds = Object.keys(newState);
            userIds.forEach(fetchProfileForUser);
            setOnlineUsers(function (currentUsers) {
                var updatedUsers = {};
                userIds.forEach(function (id) {
                    if (currentUsers[id]) {
                        updatedUsers[id] = currentUsers[id];
                    }
                });
                return updatedUsers;
            });
        })
            .on('presence', { event: 'join' }, function (_a) {
            var key = _a.key, newPresences = _a.newPresences;
            console.log('[Lobby Presence] Join event:', { key: key, newPresences: newPresences });
            fetchProfileForUser(key);
        })
            .on('presence', { event: 'leave' }, function (_a) {
            var key = _a.key, leftPresences = _a.leftPresences;
            console.log('[Lobby Presence] Leave event:', { key: key, leftPresences: leftPresences });
            setOnlineUsers(function (prev) {
                var updated = __assign({}, prev);
                delete updated[key];
                return updated;
            });
        })
            .subscribe(function (status) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(status === 'SUBSCRIBED')) return [3 /*break*/, 2];
                        console.log('[Lobby Presence] Successfully subscribed to presence channel.');
                        return [4 /*yield*/, channel.track({
                                user_id: currentPlayerId,
                                username: userProfile.username
                            })];
                    case 1:
                        _a.sent();
                        console.log('[Lobby Presence] User tracked.');
                        return [3 /*break*/, 3];
                    case 2:
                        if (status === 'CLOSED') {
                            console.log('[Lobby Presence] Channel closed.');
                        }
                        else {
                            console.error('[Lobby Presence] Subscription error/status:', status);
                            setError('Realtime connection error for online players.');
                        }
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        presenceChannelRef.current = channel;
        return function () {
            if (presenceChannelRef.current) {
                console.log('[Lobby Presence] Unsubscribing and removing channel.');
                presenceChannelRef.current.untrack();
                supabase_1.supabase.removeChannel(presenceChannelRef.current);
                presenceChannelRef.current = null;
            }
        };
    }, [supabase_1.supabase, currentPlayerId, userProfile.username]);
    var handleJoinGame = function (gameId) { return __awaiter(void 0, void 0, void 0, function () {
        var joinedGame, functionError, errorMsg, _a, gameData, fetchError, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!currentPlayerId) {
                        setNotification('Cannot join game: User not identified.');
                        setTimeout(function () { return setNotification(null); }, 3000);
                        return [2 /*return*/];
                    }
                    console.log("[Lobby] Player ".concat(currentPlayerId, " attempting to join game: ").concat(gameId));
                    setNotification("Joining game ".concat(gameId, "..."));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 12, , 13]);
                    return [4 /*yield*/, (0, supabase_1.joinGame)(gameId, currentPlayerId)];
                case 2:
                    joinedGame = _b.sent();
                    if (!joinedGame) return [3 /*break*/, 4];
                    console.log("[Lobby] Successfully joined game ".concat(gameId, ". Triggering card dealing..."));
                    setNotification('Game joined! Dealing cards...');
                    return [4 /*yield*/, supabase_1.supabase.functions.invoke('deal-cards', {
                            body: { gameId: gameId }
                        })];
                case 3:
                    functionError = (_b.sent()).error;
                    if (functionError) {
                        console.error('[Lobby] Error calling deal-cards function:', functionError);
                        errorMsg = 'Joined game, but failed to deal cards.';
                        if (functionError.message.includes('already dealt') || functionError.message.includes('status')) {
                            errorMsg = 'Game setup issue. Cards might already be dealt or status incorrect.';
                        }
                        else if (functionError.message.includes('Not enough creatures')) {
                            errorMsg = 'Game configuration error: Not enough creatures defined.';
                        }
                        setNotification("".concat(errorMsg, " Please try rejoining or contact support."));
                        setTimeout(function () { return setNotification(null); }, 6000);
                    }
                    else {
                        console.log('[Lobby] deal-cards function invoked successfully. Navigating to NFT Selection...');
                        setNotification('Cards dealt! Starting selection...');
                        navigate("/nft-selection/".concat(gameId));
                    }
                    return [3 /*break*/, 11];
                case 4: return [4 /*yield*/, supabase_1.supabase.from('games').select('player1_id, player2_id, status, player1_dealt_hand').eq('id', gameId).single()];
                case 5:
                    _a = _b.sent(), gameData = _a.data, fetchError = _a.error;
                    if (fetchError)
                        throw fetchError;
                    if (!(gameData && (gameData.player1_id === currentPlayerId || gameData.player2_id === currentPlayerId))) return [3 /*break*/, 10];
                    console.log("[Lobby] User is already in game ".concat(gameId, ". Checking status..."));
                    if (!(gameData.status === 'selecting' || gameData.status === 'active' || (gameData.player1_dealt_hand && gameData.player1_dealt_hand.length > 0))) return [3 /*break*/, 6];
                    console.log("[Lobby] Game status is '".concat(gameData.status, "'. Navigating to NFT Selection..."));
                    navigate("/nft-selection/".concat(gameId));
                    return [3 /*break*/, 9];
                case 6:
                    if (!(gameData.status === 'waiting' && gameData.player2_id === currentPlayerId)) return [3 /*break*/, 8];
                    setNotification('You seem to be in the game, but setup might be incomplete. Trying to initiate setup...');
                    setTimeout(function () { return setNotification(null); }, 4000);
                    return [4 /*yield*/, supabase_1.supabase.functions.invoke('deal-cards', { body: { gameId: gameId } })];
                case 7:
                    _b.sent();
                    navigate("/nft-selection/".concat(gameId));
                    return [3 /*break*/, 9];
                case 8:
                    setNotification('Already in game, but current status is unclear. Refreshing...');
                    setTimeout(function () { return setNotification(null); }, 4000);
                    fetchGamesAndProfiles();
                    _b.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (gameData && gameData.status !== 'waiting') {
                        setNotification('Failed to join: Game is already full or in progress.');
                        setTimeout(function () { return setNotification(null); }, 4000);
                        fetchGamesAndProfiles();
                    }
                    else {
                        setNotification('Failed to join game. It might no longer be available.');
                        setTimeout(function () { return setNotification(null); }, 4000);
                        fetchGamesAndProfiles();
                    }
                    _b.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    error_2 = _b.sent();
                    console.error("[Lobby] Error joining game ".concat(gameId, ":"), error_2);
                    setNotification("Error joining game: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error'));
                    setTimeout(function () { return setNotification(null); }, 4000);
                    fetchGamesAndProfiles();
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    }); };
    var handleCreateGame = function () { return __awaiter(void 0, void 0, void 0, function () {
        var newGameId, createdGameData, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!currentPlayerId) {
                        setNotification('Please log in to create a game.');
                        setTimeout(function () { return setNotification(null); }, 3000);
                        return [2 /*return*/];
                    }
                    console.log('[Lobby] Creating game with bet amount:', betAmount);
                    setIsCreating(true);
                    newGameId = (0, uuid_1.v4)();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, supabase_1.createGame)(newGameId, currentPlayerId, betAmount)];
                case 2:
                    createdGameData = _a.sent();
                    if (createdGameData) {
                        setShowCreateModal(false);
                        setNotification('Game created successfully! Proceeding to NFT Selection...');
                        navigate("/nft-selection/".concat(newGameId));
                    }
                    else {
                        setNotification('Failed to create game. The game ID might already exist or another error occurred.');
                        setTimeout(function () { return setNotification(null); }, 4000);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    error_3 = _a.sent();
                    console.error('[Lobby] Error creating game:', error_3);
                    setNotification("Failed to create game: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                    setTimeout(function () { return setNotification(null); }, 4000);
                    return [3 /*break*/, 5];
                case 4:
                    setIsCreating(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    console.log('[Lobby] Preparing to return JSX...', { isLoading: isLoading, error: error });
    return (<div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      <NavBar_1["default"] />
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-cyan-400/10 pointer-events-none -z-10"/>

        {isLoading ? (<div className="text-center text-gray-400 py-10">Loading Lobby...</div>) : playerError && !currentPlayerId ? (<div className="text-center text-red-400 py-10">Error: {playerError}. Please refresh or check URL parameters if testing.</div>) : error ? (<div className="text-center text-red-400 py-10">Error loading games: {error}</div>) : (<div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
              <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
                <span className="text-purple-400 text-2xl">👥</span>
                Players Online ({Object.keys(onlineUsers).length})
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-60 pr-2">
                {Object.entries(onlineUsers).length > 0 ? (Object.entries(onlineUsers).map(function (_a) {
                var _b;
                var userId = _a[0], profile = _a[1];
                return (<div key={userId} className="flex items-center space-x-3 p-2 bg-gray-700 rounded-md">
                      <img width={32} height={32} src={profile.avatar_url || "/api/placeholder-avatar?text=".concat(((_b = profile.username) === null || _b === void 0 ? void 0 : _b.charAt(0).toUpperCase()) || '?')} alt={profile.username || 'User Avatar'} className="h-8 w-8 rounded-full object-cover border border-gray-500"/>
                      <span className="text-sm font-medium text-gray-200 truncate">{profile.username || "User (".concat(userId.substring(0, 6), ")")}</span>
                    </div>);
            })) : (<div className="text-center text-gray-400 py-4">No other players currently online.</div>)}
              </div>
            </div>

            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
              <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
                <span className="text-yellow-400 text-2xl">🎮</span>
                Available Games
              </h2>
              <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
                {availableGames.length > 0 ? availableGames.map(function (game) { return (<div key={game.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center shadow-md">
                    <div>
                      <p className="text-lg font-semibold">{game.creatorUsername || 'Unknown Creator'}</p>
                      <p className="text-sm text-gray-400">Bet: {game.bet_amount} GEM</p>
                      <p className={"text-sm font-medium ".concat(game.status === 'waiting' ? 'text-yellow-400' : 'text-green-400')}>
                        {game.status === 'waiting' ? 'Waiting...' : game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      {game.status === 'waiting' && game.player1_id !== currentPlayerId && (<button onClick={function () { return handleJoinGame(game.id); }} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200">
                          Join Game
                        </button>)}
                    </div>
                  </div>); }) : (<div className="text-center text-gray-400 py-4">No available games right now.</div>)}
              </div>
            </div>

            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col items-center gap-5">
              <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100">Actions</h2>
              {currentPlayerId ? (<button onClick={function () { return setShowCreateModal(true); }} className="bg-green-600 hover:bg-green-700 text-white text-lg font-semibold py-3 px-6 rounded-md transition-colors duration-200 w-full max-w-[200px]">
                  Create Game
                </button>) : (<p className="text-gray-400 text-center">Log in to create a game.</p>)}
            </div>
          </div>)}
      </div>

      {showCreateModal && (<div className="fixed inset-0 bg-black bg-opacity-50 z-40"></div>)}
      {showCreateModal && (<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-6 rounded-lg shadow-lg max-w-md z-50">
          <h2 className="text-xl font-semibold text-center mb-4">Create New Game</h2>
          <div className="flex flex-col gap-4">
            <label htmlFor="bet-amount" className="block text-sm font-medium text-gray-400 mb-1">Bet Amount (0 for Free)</label>
            <div className="flex items-center bg-gray-700 rounded-md border border-gray-600">
              <input id="bet-amount" type="number" min="0" value={betAmount} onChange={function (e) { return setBetAmount(Math.max(0, Number(e.target.value))); }} className="flex-grow p-3 rounded-l-md bg-transparent text-white focus:outline-none" placeholder="Enter bet amount"/>
              <img src="/images/assets/gem.png" alt="GEM" className="h-6 w-6 mx-3"/>
            </div>

            <div className="flex gap-4 mt-4">
              <button onClick={handleCreateGame} disabled={isCreating} className={"flex-1 py-3 px-6 rounded-md text-white font-semibold ".concat(isCreating ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 transition-colors duration-200')}>
                {isCreating ? 'Creating...' : 'Confirm & Create'}
              </button>
              <button onClick={function () { return setShowCreateModal(false); }} className="flex-1 py-3 px-6 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors duration-200">
                Cancel
              </button>
            </div>
          </div>
        </div>)}

      {notification && (<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {notification}
        </div>)}
    </div>);
};
exports["default"] = Lobby;
