"use strict";
exports.__esModule = true;
var react_1 = require("react");
var ActionBar = function (_a) {
    var isMyTurn = _a.isMyTurn, phase = _a.phase, winner = _a.winner, actionsTaken = _a.actionsTaken, actionsPerTurn = _a.actionsPerTurn, turnTimer = _a.turnTimer, isSpectator = _a.isSpectator, playerUsername = _a.playerUsername, opponentUsername = _a.opponentUsername, onEndTurnClick = _a.onEndTurnClick;
    var validActionsTaken = typeof actionsTaken === 'number' ? actionsTaken : 0;
    var validActionsPerTurn = typeof actionsPerTurn === 'number' && actionsPerTurn > 0 ? actionsPerTurn : 2;
    var actionsLeft = Math.max(0, validActionsPerTurn - validActionsTaken);
    console.log('[ActionBar] Rendering. Props:', { isMyTurn: isMyTurn, phase: phase, winner: winner, actionsTaken: actionsTaken, actionsPerTurn: actionsPerTurn, turnTimer: turnTimer, isSpectator: isSpectator });
    var getPhaseMessage = function () {
        if (winner) {
            var winnerName = winner === playerUsername ? playerUsername : (winner === opponentUsername ? opponentUsername : "Player (".concat(winner.substring(0, 6), ")"));
            return "Game Over! Winner: ".concat(winnerName);
        }
        if (isSpectator)
            return "Spectating";
        if (!isMyTurn)
            return "Opponent's Turn";
        switch (phase) {
            case 'knowledge':
                return "Your Turn: Knowledge Phase";
            case 'action':
                var actionsText = isNaN(actionsLeft) ? '...' : actionsLeft;
                var turnText = isNaN(validActionsPerTurn) ? '...' : validActionsPerTurn;
                // Display timer only during action phase and if it's my turn
                var timerText = isMyTurn ? " - Time: ".concat(turnTimer, "s") : '';
                return "Your Turn: Action Phase (".concat(actionsText, "/").concat(turnText, " actions left").concat(timerText, ")");
            case 'loading':
                return "Loading...";
            case 'end':
                return "Game Ended";
            default:
                return "Your Turn: ".concat(phase);
        }
    };
    var canEndTurn = isMyTurn && phase === 'action' && !winner;
    return (<div className="flex items-center justify-between p-3 bg-gray-800/90 text-white h-16 border-t border-gray-700">
      <div className="flex-1 text-left pl-4"> {/* Placeholder for potential left-side content */}
      </div>
      <div className="flex-1 text-center">
        <span className="text-lg font-semibold">{getPhaseMessage()}</span>
      </div>
      <div className="flex-1 text-right pr-4"> {/* Container for the button */}
        {canEndTurn && (<button onClick={onEndTurnClick} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-semibold transition-colors duration-150">
            End Turn
          </button>)}
      </div>
    </div>);
};
exports["default"] = ActionBar;
