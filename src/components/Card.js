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
exports.__esModule = true;
var react_1 = require("react");
// Define zoom scale factor
var ZOOM_SCALE = 2.5;
// Define card dimensions (adjust if necessary, ensure aspect ratio matches)
var BASE_CARD_WIDTH_PX = 100; // Example base width in pixels
var BASE_CARD_HEIGHT_PX = BASE_CARD_WIDTH_PX * (3.5 / 2.5); // Assuming standard card aspect ratio
var Card = function (_a) {
    var card = _a.card, onClick = _a.onClick, isSelected = _a.isSelected, _b = _a.rotation, rotation = _b === void 0 ? 0 : _b, _c = _a.showBack, showBack = _c === void 0 ? false : _c, _d = _a.isDisabled, isDisabled = _d === void 0 ? false : _d;
    // No isHovering state needed if it's only used for zoom logic
    var _e = (0, react_1.useState)(false), isZoomed = _e[0], setIsZoomed = _e[1];
    var _f = (0, react_1.useState)({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }), zoomPosition = _f[0], setZoomPosition = _f[1];
    var hoverTimer = (0, react_1.useRef)(null);
    var cardRef = (0, react_1.useRef)(null); // Ref to get card position
    var handleMouseEnter = function () {
        // Hover/zoom is independent of isDisabled
        if (hoverTimer.current)
            clearTimeout(hoverTimer.current); // Clear any existing timer before starting a new one
        hoverTimer.current = setTimeout(function () {
            if (cardRef.current) {
                var rect = cardRef.current.getBoundingClientRect();
                var vw = window.innerWidth;
                var vh = window.innerHeight;
                var zoomedWidth = BASE_CARD_WIDTH_PX * ZOOM_SCALE;
                var zoomedHeight = BASE_CARD_HEIGHT_PX * ZOOM_SCALE;
                // Calculate ideal centered position based on original card
                var idealTop = rect.top + rect.height / 2;
                var idealLeft = rect.left + rect.width / 2;
                // Adjust position to keep the zoomed card within viewport bounds
                var marginTop = 10; // Margin from viewport edges
                var marginLeft = 10;
                // Adjust top
                if (idealTop - zoomedHeight / 2 < marginTop) {
                    idealTop = zoomedHeight / 2 + marginTop; // Align top edge
                }
                else if (idealTop + zoomedHeight / 2 > vh - marginTop) {
                    idealTop = vh - zoomedHeight / 2 - marginTop; // Align bottom edge
                }
                // Adjust left
                if (idealLeft - zoomedWidth / 2 < marginLeft) {
                    idealLeft = zoomedWidth / 2 + marginLeft; // Align left edge
                }
                else if (idealLeft + zoomedWidth / 2 > vw - marginLeft) {
                    idealLeft = vw - zoomedWidth / 2 - marginLeft; // Align right edge
                }
                setZoomPosition({
                    top: "".concat(idealTop, "px"),
                    left: "".concat(idealLeft, "px"),
                    transform: 'translate(-50%, -50%)'
                });
            }
            setIsZoomed(true); // Show the zoom
        }, 800); // 0.8 second delay
    };
    // Handler for leaving the original card area
    var handleMouseLeaveOriginalCard = function () {
        // Clear the timer ONLY. This prevents the zoom from showing if the mouse leaves quickly.
        // It does NOT hide the zoom if it's already visible.
        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
    };
    // Handler specifically for closing the zoom (used by overlay and backdrop)
    var handleCloseZoom = function () {
        if (hoverTimer.current) { // Clear timer just in case it's somehow still active
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
        setIsZoomed(false); // Hide the zoom
    };
    var handleClick = function () {
        // Click action still respects isDisabled
        if (onClick && !isDisabled) {
            onClick(card.id);
        }
    };
    // Clear timer on unmount
    (0, react_1.useEffect)(function () {
        return function () {
            if (hoverTimer.current) {
                clearTimeout(hoverTimer.current);
            }
        };
    }, []);
    var imagePath = showBack ? '/images/spells/back.jpg' : card.image;
    // Calculate rotation style for inner content of the base card
    var rotationStyle = {
        transform: rotation ? "rotate(".concat(-rotation, "deg)") : 'none',
        transition: 'transform 0.3s ease-in-out',
        transformOrigin: 'center center'
    };
    return (<>
      <div ref={cardRef} // Attach ref to the main card element
     className={"\n          relative w-full h-full\n          bg-gray-700 rounded-[10px] shadow-md overflow-hidden\n          transition-transform duration-300 ease-in-out\n          ".concat(onClick && !isDisabled ? 'cursor-pointer' : 'cursor-default', "\n          ").concat(isSelected ? 'border-yellow-400 border-2 ring-2 ring-yellow-400' : 'border-2 border-gray-500', "\n          z-10 /* Keep base card at z-10 */\n        ")} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeaveOriginalCard} // Use the specific handler for leaving the original card
     onClick={handleClick}>
        {/* Using a wrapper div for card content that rotates */}
        <div className="w-full h-full flex flex-col transition-transform duration-300" style={rotationStyle}>
          {/* Image Area */}
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <img src={imagePath} alt={card.name} className="object-cover w-full h-full" draggable={false}/>
          </div>
        </div>
      </div>

      {/* Zoomed Card Overlay */}
      {isZoomed && (<div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-40" // Backdrop
         onClick={handleCloseZoom} // Use the closing handler
        >
          <div className="fixed bg-gray-700 rounded-[10px] shadow-xl overflow-hidden border-4 border-yellow-500 z-50 pointer-events-auto" // Added pointer-events-auto to ensure leave event fires
         style={__assign(__assign({}, zoomPosition), { width: "".concat(BASE_CARD_WIDTH_PX * ZOOM_SCALE, "px"), height: "".concat(BASE_CARD_HEIGHT_PX * ZOOM_SCALE, "px") })} onMouseLeave={handleCloseZoom} // Use the closing handler here too
        >
            {/* Inner content doesn't need rotation here as the base card shows rotation state */}
            <div className="w-full h-full flex flex-col">
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <img src={imagePath} // Use the same image path
         alt={card.name} className="object-cover w-full h-full" draggable={false}/>
              </div>
              {/* Optional: Add more card details to the zoom view if needed */}
            </div>
          </div>
        </div>)}
    </>);
};
exports["default"] = Card;
