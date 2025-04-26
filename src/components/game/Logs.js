"use strict";
exports.__esModule = true;
var react_1 = require("react");
var Logs = function (_a) {
    var logs = _a.logs;
    var logsEndRef = (0, react_1.useRef)(null);
    var scrollToBottom = function () {
        var _a;
        (_a = logsEndRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
    };
    (0, react_1.useEffect)(function () {
        scrollToBottom();
    }, [logs]); // Scroll down whenever logs update
    // Filter out zero-damage combat logs
    var filteredLogs = logs.filter(function (log) {
        // Regex to match "Combat: Player X absorbs all damage (raw 0 - defense Y)."
        var zeroDamagePattern = /^Combat: Player \\d+ absorbs all damage \\(raw 0 - defense \\d+\\)\\.$/;
        // Keep logs that *don't* match the pattern
        return !zeroDamagePattern.test(log);
    });
    return (<div className="w-full h-full bg-gray-900/80 text-white rounded-lg shadow-inner overflow-hidden flex flex-col p-2 border border-gray-600">
      <h3 className="text-sm font-semibold text-yellow-400 mb-1 px-1 border-b border-gray-700">Game Log</h3>
      <div className="flex-grow overflow-y-auto text-xs space-y-1 pr-1">
        {/* Render the filtered logs */} 
        {filteredLogs.map(function (log, index) { return (<p key={index} className="font-mono leading-tight py-0.5 my-0.5">{log}</p>); })}
        <div ref={logsEndRef}/> {/* Invisible element to scroll to */}
      </div>
    </div>);
};
exports["default"] = Logs;
