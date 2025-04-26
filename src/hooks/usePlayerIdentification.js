"use strict";
exports.__esModule = true;
exports.usePlayerIdentification = void 0;
var react_1 = require("react");
var AuthContext_1 = require("../context/AuthContext"); // Import useAuth
/**
 * Hook to determine the current player's ID based on the authenticated user.
 * @returns The current player's ID or null if not authenticated or loading.
 */
function usePlayerIdentification() {
    var _a = (0, AuthContext_1.useAuth)(), user = _a.user, authLoading = _a.loading, session = _a.session; // Get user and loading state from context
    var _b = (0, react_1.useState)(null), currentPlayerId = _b[0], setCurrentPlayerId = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    (0, react_1.useEffect)(function () {
        console.log('[usePlayerIdentification] Auth state update:', { authLoading: authLoading, user: user === null || user === void 0 ? void 0 : user.id, sessionExists: !!session });
        if (!authLoading) {
            if (user) {
                setCurrentPlayerId(user.id);
                setError(null);
                console.log("[usePlayerIdentification] Player ID set from authenticated user: ".concat(user.id));
            }
            else {
                setCurrentPlayerId(null);
                setError('User not logged in.');
                console.log('[usePlayerIdentification] No authenticated user found.');
            }
        }
        else {
            // Still loading auth state
            setCurrentPlayerId(null);
            setError(null); // Clear error while loading
            console.log('[usePlayerIdentification] Waiting for authentication status...');
        }
        // Depend on user object and authLoading state
    }, [user, authLoading, session]);
    // Return authLoading as the primary loading indicator for this hook
    return [currentPlayerId, setCurrentPlayerId, error, setError, authLoading];
}
exports.usePlayerIdentification = usePlayerIdentification;
