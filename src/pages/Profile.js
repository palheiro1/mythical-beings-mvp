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
// File: src/pages/Profile.tsx
var react_1 = require("react");
var AuthContext_1 = require("../context/AuthContext");
var supabase_1 = require("../utils/supabase");
var NavBar_1 = require("../components/NavBar"); // Import NavBar
var ProfilePage = function () {
    var _a;
    var _b = (0, AuthContext_1.useAuth)(), user = _b.user, authLoading = _b.loading;
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)({
        username: null,
        avatar_url: null,
        website: null,
        games_won: 0,
        games_played: 0
    }), profileData = _d[0], setProfileData = _d[1];
    var _e = (0, react_1.useState)(''), newUsername = _e[0], setNewUsername = _e[1];
    var _f = (0, react_1.useState)(''), newWebsite = _f[0], setNewWebsite = _f[1];
    var _g = (0, react_1.useState)(false), uploading = _g[0], setUploading = _g[1];
    var _h = (0, react_1.useState)(null), avatarFile = _h[0], setAvatarFile = _h[1];
    var _j = (0, react_1.useState)(null), notification = _j[0], setNotification = _j[1];
    (0, react_1.useEffect)(function () {
        var fetchProfile = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, data, error, status_1, error_1;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!user) return [3 /*break*/, 6];
                        setLoading(true);
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, supabase_1.supabase
                                .from('profiles')
                                .select("username, website, avatar_url, games_won, games_played")
                                .eq('id', user.id)
                                .single()];
                    case 2:
                        _a = _d.sent(), data = _a.data, error = _a.error, status_1 = _a.status;
                        if (error && status_1 !== 406) {
                            throw error;
                        }
                        if (data) {
                            setProfileData({
                                username: data.username,
                                avatar_url: data.avatar_url,
                                website: data.website,
                                games_won: (_b = data.games_won) !== null && _b !== void 0 ? _b : 0,
                                games_played: (_c = data.games_played) !== null && _c !== void 0 ? _c : 0
                            });
                            setNewUsername(data.username || '');
                            setNewWebsite(data.website || '');
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _d.sent();
                        console.error('Error fetching profile:', error_1);
                        setNotification('Could not fetch profile data.');
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        setLoading(false); // No user, not loading
                        _d.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        }); };
        if (!authLoading) {
            fetchProfile();
        }
    }, [user, authLoading]);
    var updateProfile = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var avatarUrl_1, updates, error, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    if (!user)
                        return [2 /*return*/];
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    avatarUrl_1 = profileData.avatar_url;
                    if (!avatarFile) return [3 /*break*/, 3];
                    return [4 /*yield*/, uploadAvatar(avatarFile)];
                case 2:
                    avatarUrl_1 = _a.sent();
                    if (!avatarUrl_1) {
                        // Error handled in uploadAvatar
                        return [2 /*return*/];
                    }
                    _a.label = 3;
                case 3:
                    updates = {
                        id: user.id,
                        username: newUsername,
                        website: newWebsite,
                        avatar_url: avatarUrl_1,
                        updated_at: new Date()
                    };
                    return [4 /*yield*/, supabase_1.supabase.from('profiles').upsert(updates)];
                case 4:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    setProfileData(function (prev) { return (__assign(__assign({}, prev), { username: newUsername, website: newWebsite, avatar_url: avatarUrl_1 })); });
                    setNotification('Profile updated successfully!');
                    return [3 /*break*/, 7];
                case 5:
                    error_2 = _a.sent();
                    console.error('Error updating profile:', error_2);
                    setNotification("Error updating profile: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error'));
                    return [3 /*break*/, 7];
                case 6:
                    setLoading(false);
                    setAvatarFile(null); // Clear file input state after attempt
                    setTimeout(function () { return setNotification(null); }, 3000); // Clear notification
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleAvatarChange = function (event) {
        if (event.target.files && event.target.files.length > 0) {
            setAvatarFile(event.target.files[0]);
        }
    };
    var uploadAvatar = function (file) { return __awaiter(void 0, void 0, void 0, function () {
        var fileExt, fileName, filePath, uploadError, data, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!user)
                        return [2 /*return*/, null];
                    setUploading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    fileExt = file.name.split('.').pop();
                    fileName = "".concat(user.id, "-").concat(Math.random(), ".").concat(fileExt);
                    filePath = "".concat(fileName);
                    return [4 /*yield*/, supabase_1.supabase.storage.from('avatars').upload(filePath, file, { upsert: true })];
                case 2:
                    uploadError = (_a.sent()).error;
                    if (uploadError) {
                        throw uploadError;
                    }
                    data = supabase_1.supabase.storage.from('avatars').getPublicUrl(filePath).data;
                    if (!(data === null || data === void 0 ? void 0 : data.publicUrl)) {
                        throw new Error("Could not get public URL for uploaded avatar.");
                    }
                    setNotification('Avatar uploaded successfully!');
                    return [2 /*return*/, data.publicUrl];
                case 3:
                    error_3 = _a.sent();
                    console.error('Error uploading avatar:', error_3);
                    setNotification("Error uploading avatar: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                    return [2 /*return*/, null];
                case 4:
                    setUploading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (authLoading || loading) {
        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading profile...</div>;
    }
    if (!user) {
        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Please log in to view your profile.</div>;
    }
    return (<div className="min-h-screen bg-gray-900 text-white">
      <NavBar_1["default"] /> {/* Add NavBar */}
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300">
          Your Profile
        </h1>

        {notification && (<div className={"fixed top-5 right-5 p-3 rounded-md shadow-lg text-white ".concat(notification.startsWith('Error') ? 'bg-red-600' : 'bg-green-600', " z-50")}>
            {notification}
          </div>)}

        <div className="max-w-2xl mx-auto bg-gray-800 bg-opacity-70 p-8 rounded-xl shadow-xl">
          <form onSubmit={updateProfile} className="space-y-6">
            {/* Avatar Display and Upload */}
            <div className="flex flex-col items-center space-y-4">
              <img src={profileData.avatar_url || "/api/placeholder-avatar?text=".concat(((_a = profileData.username) === null || _a === void 0 ? void 0 : _a.charAt(0).toUpperCase()) || '?')} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-2 border-purple-500"/>
              <div>
                <label htmlFor="avatar-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200">
                  {uploading ? 'Uploading...' : 'Upload New Avatar'}
                </label>
                <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} className="hidden"/>
              </div>
              {avatarFile && <span className="text-xs text-gray-400 mt-1">{avatarFile.name}</span>}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input id="username" type="text" value={newUsername} onChange={function (e) { return setNewUsername(e.target.value); }} className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Your public username"/>
            </div>

            {/* Website */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-1">Website</label>
              <input id="website" type="url" value={newWebsite} onChange={function (e) { return setNewWebsite(e.target.value); }} className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="https://your-website.com"/>
            </div>

            {/* Stats Display */}
            <div className="flex justify-around pt-4 border-t border-gray-700">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{profileData.games_won}</p>
                <p className="text-sm text-gray-400">Games Won</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-300">{profileData.games_played}</p>
                <p className="text-sm text-gray-400">Games Played</p>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button type="submit" disabled={loading || uploading} className={"w-full font-bold py-3 px-6 rounded-md transition duration-200 ease-in-out ".concat(loading || uploading ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700')}>
                {loading || uploading ? 'Saving...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>);
};
exports["default"] = ProfilePage;
