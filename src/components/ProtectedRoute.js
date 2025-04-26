"use strict";
exports.__esModule = true;
// File: src/components/ProtectedRoute.tsx
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var AuthContext_1 = require("../context/AuthContext");
var ProtectedRoute = function () {
    var _a = (0, AuthContext_1.useAuth)(), session = _a.session, loading = _a.loading;
    if (loading) {
        // Optional: Show a loading spinner while checking auth state
        return <div className="text-center p-10">Checking authentication...</div>;
    }
    if (!session) {
        // User not authenticated, redirect to login page
        console.log('[ProtectedRoute] No session found, redirecting to /');
        return <react_router_dom_1.Navigate to="/" replace/>;
    }
    // User is authenticated, render the child route component
    return <react_router_dom_1.Outlet />;
};
exports["default"] = ProtectedRoute;
