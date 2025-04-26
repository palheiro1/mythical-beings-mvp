"use strict";
exports.__esModule = true;
var react_1 = require("react");
var Card_1 = require("./Card");
var Market = function (_a) {
    var cards = _a.cards, onCardClick = _a.onCardClick;
    return (<div className="flex justify-center items-center space-x-1 md:space-x-2 p-1 bg-blue-900/30 rounded min-h-[7rem]"> {/* Adjusted min-height */}
      {cards.map(function (card, idx) { return (<Card_1["default"] key={card.instanceId || "".concat(card.id, "-").concat(idx)} card={card} onClick={onCardClick}/>); })}
      {cards.length === 0 && <p className="text-xs text-gray-400 italic">Market is empty</p>}
    </div>);
};
exports["default"] = Market;
