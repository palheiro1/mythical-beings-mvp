"use strict";
exports.__esModule = true;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var Home_js_1 = require("./pages/Home.js");
var Lobby_js_1 = require("./pages/Lobby.js");
var GameScreen_js_1 = require("./pages/GameScreen.js");
var NFTSelection_js_1 = require("./pages/NFTSelection.js");
var Profile_js_1 = require("./pages/Profile.js");
var HowToPlay_js_1 = require("./pages/HowToPlay.js");
var Leaderboard_js_1 = require("./pages/Leaderboard.js");
var WaitingScreen_js_1 = require("./pages/WaitingScreen.js");
var AuthContext_js_1 = require("./context/AuthContext.js");
var ProtectedRoute_js_1 = require("./components/ProtectedRoute.js");
function App() {
    return (<react_router_dom_1.BrowserRouter>
      <AuthContext_js_1.AuthProvider>
        <react_router_dom_1.Routes>
          {/* Public Route */}
          <react_router_dom_1.Route path="/" element={<Home_js_1["default"] />}/>

          {/* Protected Routes */}
          <react_router_dom_1.Route element={<ProtectedRoute_js_1["default"] />}>
            <>
              <react_router_dom_1.Route path="/lobby" element={<Lobby_js_1["default"] />}/>
              <react_router_dom_1.Route path="/game/:gameId" element={<GameScreen_js_1["default"] />}/>
              <react_router_dom_1.Route path="/profile" element={<Profile_js_1["default"] />}/>
              <react_router_dom_1.Route path="/nft-selection/:gameId" element={<NFTSelection_js_1["default"] />}/>
              <react_router_dom_1.Route path="/how-to-play" element={<HowToPlay_js_1["default"] />}/>
              <react_router_dom_1.Route path="/leaderboard" element={<Leaderboard_js_1["default"] />}/>
              <react_router_dom_1.Route path="/waiting/:gameId" element={<WaitingScreen_js_1["default"] />}/>
            </>
          </react_router_dom_1.Route>
        </react_router_dom_1.Routes>
      </AuthContext_js_1.AuthProvider>
    </react_router_dom_1.BrowserRouter>);
}
exports["default"] = App;
