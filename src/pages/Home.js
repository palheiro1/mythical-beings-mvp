"use strict";
exports.__esModule = true;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var auth_ui_react_1 = require("@supabase/auth-ui-react");
var auth_ui_shared_1 = require("@supabase/auth-ui-shared");
var supabase_1 = require("../utils/supabase");
var AuthContext_1 = require("../context/AuthContext");
var Home = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, AuthContext_1.useAuth)(), session = _a.session, loading = _a.loading;
    (0, react_1.useEffect)(function () {
        if (!loading && session) {
            console.log('[Home] User already logged in, redirecting to /lobby');
            navigate('/lobby');
        }
    }, [session, loading, navigate]);
    if (loading) {
        return <div className="text-center p-10">Loading...</div>;
    }
    return (<div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <img src="/images/assets/LogoXogoBrancoTransparenteEN.png" alt="Mythical Beings Logo" className="w-1/3 h-auto mb-8"/>
      <h1 className="text-4xl font-bold mb-2">Welcome to Mythical Beings</h1>
      <p className="text-lg text-gray-300 mb-8">Log in or Sign up to join the battle!</p>

      <div className="w-full max-w-sm bg-gray-800 p-8 rounded-lg shadow-xl flex flex-col items-center">
        <auth_ui_react_1.Auth supabaseClient={supabase_1.supabase} appearance={{
            theme: auth_ui_shared_1.ThemeSupa,
            style: {
                input: { width: '16rem' },
                button: { width: '16rem' }
            }
        }} providers={[]} theme="dark" redirectTo={"".concat(window.location.origin, "/lobby")}/>
      </div>
    </div>);
};
exports["default"] = Home;
