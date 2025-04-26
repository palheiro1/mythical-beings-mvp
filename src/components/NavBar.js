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
var supabase_1 = require("../utils/supabase"); // Assuming getProfile fetches username/avatar
var NavBar = function () {
    var _a = (0, AuthContext_1.useAuth)(), user = _a.user, signOut = _a.signOut, authLoading = _a.loading;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _b = (0, react_1.useState)({ username: null, avatar_url: null }), userProfile = _b[0], setUserProfile = _b[1];
    var _c = (0, react_1.useState)(true), loadingProfile = _c[0], setLoadingProfile = _c[1];
    (0, react_1.useEffect)(function () {
        var isMounted = true;
        var fetchUserProfile = function () { return __awaiter(void 0, void 0, void 0, function () {
            var profile, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!user) return [3 /*break*/, 6];
                        setLoadingProfile(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, (0, supabase_1.getProfile)(user.id)];
                    case 2:
                        profile = _a.sent();
                        if (isMounted && profile) {
                            setUserProfile({
                                username: profile.username || "User (".concat(user.id.substring(0, 6), ")"),
                                avatar_url: profile.avatar_url
                            });
                        }
                        else if (isMounted) {
                            setUserProfile({ username: "User (".concat(user.id.substring(0, 6), ")"), avatar_url: null });
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        console.error('[NavBar] Error fetching profile:', error_1);
                        if (isMounted) {
                            setUserProfile({ username: "User (".concat(user.id.substring(0, 6), ")"), avatar_url: null });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        if (isMounted) {
                            setLoadingProfile(false);
                        }
                        return [7 /*endfinally*/];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        if (isMounted) {
                            setLoadingProfile(false); // Not logged in, profile loading finished
                            setUserProfile({ username: null, avatar_url: null }); // Reset profile
                        }
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        }); };
        if (!authLoading) {
            fetchUserProfile();
        }
        return function () {
            isMounted = false;
        };
    }, [user, authLoading]); // Re-fetch when user or authLoading changes
    var handleSignOut = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, signOut()];
                case 1:
                    _a.sent();
                    navigate('/'); // Redirect to home after sign out
                    return [2 /*return*/];
            }
        });
    }); };
    var isLoading = authLoading || loadingProfile;
    return (<nav className="bg-gray-800 bg-opacity-80 backdrop-blur-sm text-white p-3 shadow-md flex justify-between items-center sticky top-0 z-30">
      <div className="flex items-center space-x-6">
        <react_router_dom_1.Link to="/lobby" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300 hover:opacity-80 transition-opacity">
          Mythical Arena
        </react_router_dom_1.Link>
        <div className="hidden md:flex items-center space-x-4">
          <react_router_dom_1.Link to="/lobby" className="text-gray-300 hover:text-white transition-colors">Lobby</react_router_dom_1.Link>
          <react_router_dom_1.Link to="/how-to-play" className="text-gray-300 hover:text-white transition-colors">How to Play</react_router_dom_1.Link>
          <react_router_dom_1.Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors">Leaderboard</react_router_dom_1.Link>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {isLoading ? (<div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>) : user && userProfile.username ? (<>
            <react_router_dom_1.Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <img width={32} height={32} src={userProfile.avatar_url
                ? userProfile.avatar_url
                : "/api/placeholder-avatar?text=".concat(userProfile.username.charAt(0).toUpperCase())} alt="User Avatar" className="h-8 w-8 rounded-full object-cover border border-gray-500"/>
              <span className="text-sm font-medium hidden sm:inline">{userProfile.username}</span>
            </react_router_dom_1.Link>
            <button onClick={handleSignOut} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200">
              Sign Out
            </button>
          </>) : (<react_router_dom_1.Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200">
            Login
          </react_router_dom_1.Link>)}
      </div>
      {/* Mobile Menu Links (Optional) */}
      <div className="md:hidden flex flex-col items-center space-y-1 mt-2 border-t border-gray-700 pt-2">
          <react_router_dom_1.Link to="/lobby" className="text-gray-300 hover:text-white transition-colors text-sm">Lobby</react_router_dom_1.Link>
          <react_router_dom_1.Link to="/how-to-play" className="text-gray-300 hover:text-white transition-colors text-sm">How to Play</react_router_dom_1.Link>
          <react_router_dom_1.Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors text-sm">Leaderboard</react_router_dom_1.Link>
      </div>
    </nav>);
};
exports["default"] = NavBar;
