"use strict";
exports.__esModule = true;
exports.useTurnTimer = void 0;
var react_1 = require("react");
function useTurnTimer(_a) {
    var isMyTurn = _a.isMyTurn, phase = _a.phase, turnDurationSeconds = _a.turnDurationSeconds, onTimerEnd = _a.onTimerEnd, gameTurn = _a.gameTurn, currentPlayerIndex = _a.currentPlayerIndex;
    var _b = (0, react_1.useState)(turnDurationSeconds), remainingTime = _b[0], setRemainingTime = _b[1];
    var intervalRef = (0, react_1.useRef)(null);
    var onTimerEndRef = (0, react_1.useRef)(onTimerEnd); // Use ref to avoid effect dependency issues
    // Keep the callback ref up-to-date
    (0, react_1.useEffect)(function () {
        onTimerEndRef.current = onTimerEnd;
    }, [onTimerEnd]);
    (0, react_1.useEffect)(function () {
        // Function to clear existing interval
        var clearTimerInterval = function () {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
        // Start timer only if it's my turn and in the action phase
        if (isMyTurn && phase === 'action') {
            console.log("[useTurnTimer] Starting timer for turn ".concat(gameTurn, ", player ").concat(currentPlayerIndex, ". Duration: ").concat(turnDurationSeconds, "s"));
            // Reset timer to full duration at the start of the actionable turn
            setRemainingTime(turnDurationSeconds);
            clearTimerInterval(); // Clear any previous interval just in case
            intervalRef.current = setInterval(function () {
                setRemainingTime(function (prevTime) {
                    if (prevTime <= 1) {
                        clearTimerInterval(); // Clear interval when time runs out
                        console.log("[useTurnTimer] Timer ended for turn ".concat(gameTurn, ", player ").concat(currentPlayerIndex, ". Calling onTimerEnd."));
                        onTimerEndRef.current(); // Call the latest end turn function
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
        else {
            // If not my turn or not action phase, clear interval and reset display time
            clearTimerInterval();
            setRemainingTime(turnDurationSeconds); // Reset display time
            // console.log(`[useTurnTimer] Timer stopped/reset. isMyTurn: ${isMyTurn}, phase: ${phase}`);
        }
        // Cleanup function to clear interval on unmount or when dependencies change
        return function () {
            clearTimerInterval();
            // console.log(`[useTurnTimer] Cleanup effect. Interval cleared.`);
        };
    }, [isMyTurn, phase, turnDurationSeconds, gameTurn, currentPlayerIndex]); // Rerun effect if turn/phase/player changes
    return remainingTime;
}
exports.useTurnTimer = useTurnTimer;
