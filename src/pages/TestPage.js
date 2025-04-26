"use strict";
exports.__esModule = true;
var react_1 = require("react");
var TestPage = function () {
    console.log('[TestPage] Minimal component rendering!');
    return (<div className="min-h-screen bg-blue-900 text-white p-8"> {/* Different background */}
      <h1 className="text-3xl font-bold">Test Page Rendered!</h1>
      <p>If you see this, ProtectedRoute/Outlet works for /test.</p>
    </div>);
};
exports["default"] = TestPage;
