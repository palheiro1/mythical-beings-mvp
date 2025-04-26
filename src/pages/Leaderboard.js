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
var react_1 = require("react");
var NavBar_1 = require("../components/NavBar");
var supabase_1 = require("../utils/supabase"); // Assuming supabase client is exported
var Leaderboard = function () {
    var _a = (0, react_1.useState)([]), leaderboardData = _a[0], setLeaderboardData = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    (0, react_1.useEffect)(function () {
        var fetchLeaderboard = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, data, fetchError, processedData, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setLoading(true);
                        setError(null);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, supabase_1.supabase
                                .from('profiles')
                                .select('id, username, avatar_url, games_won, games_played')
                                .order('games_won', { ascending: false })
                                .order('games_played', { ascending: true }) // Optional tie-breaker
                                .limit(100)];
                    case 2:
                        _a = _b.sent(), data = _a.data, fetchError = _a.error;
                        if (fetchError) {
                            throw fetchError;
                        }
                        processedData = data.map(function (entry) {
                            var _a, _b;
                            return (__assign(__assign({}, entry), { games_won: (_a = entry.games_won) !== null && _a !== void 0 ? _a : 0, games_played: (_b = entry.games_played) !== null && _b !== void 0 ? _b : 0 }));
                        });
                        setLeaderboardData(processedData);
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _b.sent();
                        console.error('[Leaderboard] Error fetching data:', err_1);
                        setError(err_1 instanceof Error ? err_1.message : 'Failed to load leaderboard data.');
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        fetchLeaderboard();
    }, []);
    return (<div className="min-h-screen bg-gray-900 text-white">
      <NavBar_1["default"] />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
          Leaderboard
        </h1>

        {loading && <p className="text-center text-gray-400">Loading leaderboard...</p>}
        {error && <p className="text-center text-red-500">Error: {error}</p>}

        {!loading && !error && (<div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700 bg-opacity-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-16">Rank</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Games Won</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Games Played</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {leaderboardData.map(function (entry, index) {
                var _a;
                return (<tr key={entry.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-200 text-center">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img width={32} height={32} className="h-10 w-10 rounded-full object-cover border border-gray-600" src={entry.avatar_url || "/api/placeholder-avatar?text=".concat(((_a = entry.username) === null || _a === void 0 ? void 0 : _a.charAt(0).toUpperCase()) || '?')} alt={entry.username || 'User Avatar'}/>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-100">{entry.username || "User (".concat(entry.id.substring(0, 6), ")")}</div>
                          {/* Optional: Add user ID or other info */}
                          {/* <div className="text-xs text-gray-400">{entry.id}</div> */}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.games_won}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.games_played}</td>
                  </tr>);
            })}
                {leaderboardData.length === 0 && (<tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-400">No players found on the leaderboard yet.</td>
                  </tr>)}
              </tbody>
            </table>
          </div>)}
      </div>
    </div>);
};
exports["default"] = Leaderboard;
