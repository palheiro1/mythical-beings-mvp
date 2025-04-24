import React, { useState, useRef, useEffect } from 'react';
import { Creature, Knowledge } from '../game/types';

interface CardProps {
  card: Creature | Knowledge;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  rotation?: number; // degrees (0, 90, 180, 270)
  showBack?: boolean; // If true, show card back
  isDisabled?: boolean; // For actions, not hover/zoom
}

// Define zoom scale factor
const ZOOM_SCALE = 2.5;
// Define card dimensions (adjust if necessary, ensure aspect ratio matches)
const BASE_CARD_WIDTH_PX = 100; // Example base width in pixels
const BASE_CARD_HEIGHT_PX = BASE_CARD_WIDTH_PX * (3.5 / 2.5); // Assuming standard card aspect ratio

const Card: React.FC<CardProps> = ({ card, onClick, isSelected, rotation = 0, showBack = false, isDisabled = false }) => {
  // No isHovering state needed if it's only used for zoom logic
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null); // Ref to get card position

  const handleMouseEnter = () => {
    // Hover/zoom is independent of isDisabled
    if (hoverTimer.current) clearTimeout(hoverTimer.current); // Clear any existing timer before starting a new one
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const zoomedWidth = BASE_CARD_WIDTH_PX * ZOOM_SCALE;
        const zoomedHeight = BASE_CARD_HEIGHT_PX * ZOOM_SCALE;

        // Calculate ideal centered position based on original card
        let idealTop = rect.top + rect.height / 2;
        let idealLeft = rect.left + rect.width / 2;

        // Adjust position to keep the zoomed card within viewport bounds
        const marginTop = 10; // Margin from viewport edges
        const marginLeft = 10;

        // Adjust top
        if (idealTop - zoomedHeight / 2 < marginTop) {
          idealTop = zoomedHeight / 2 + marginTop; // Align top edge
        } else if (idealTop + zoomedHeight / 2 > vh - marginTop) {
          idealTop = vh - zoomedHeight / 2 - marginTop; // Align bottom edge
        }

        // Adjust left
        if (idealLeft - zoomedWidth / 2 < marginLeft) {
          idealLeft = zoomedWidth / 2 + marginLeft; // Align left edge
        } else if (idealLeft + zoomedWidth / 2 > vw - marginLeft) {
          idealLeft = vw - zoomedWidth / 2 - marginLeft; // Align right edge
        }

        setZoomPosition({
          top: `${idealTop}px`,
          left: `${idealLeft}px`,
          transform: 'translate(-50%, -50%)', // Center the zoomed card at the calculated position
        });
      }
      setIsZoomed(true); // Show the zoom
    }, 800); // 0.8 second delay
  };

  // Handler for leaving the original card area
  const handleMouseLeaveOriginalCard = () => {
    // Clear the timer ONLY. This prevents the zoom from showing if the mouse leaves quickly.
    // It does NOT hide the zoom if it's already visible.
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  // Handler specifically for closing the zoom (used by overlay and backdrop)
  const handleCloseZoom = () => {
    if (hoverTimer.current) { // Clear timer just in case it's somehow still active
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setIsZoomed(false); // Hide the zoom
  };

  const handleClick = () => {
    // Click action still respects isDisabled
    if (onClick && !isDisabled) {
      onClick(card.id);
    }
  };

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
      }
    };
  }, []);

  const imagePath = showBack ? '/images/spells/back.jpg' : card.image;

  // Calculate rotation style for inner content of the base card
  const rotationStyle = {
    transform: rotation ? `rotate(${-rotation}deg)` : 'none',
    transition: 'transform 0.3s ease-in-out',
    transformOrigin: 'center center',
  };

  return (
    <>
      <div
        ref={cardRef} // Attach ref to the main card element
        className={`
          relative w-full h-full
          bg-gray-700 rounded-[10px] shadow-md overflow-hidden
          transition-transform duration-300 ease-in-out
          ${onClick && !isDisabled ? 'cursor-pointer' : 'cursor-default'}
          ${isSelected ? 'border-yellow-400 border-2 ring-2 ring-yellow-400' : 'border-2 border-gray-500'}
          z-10 /* Keep base card at z-10 */
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeaveOriginalCard} // Use the specific handler for leaving the original card
        onClick={handleClick}
      >
        {/* Using a wrapper div for card content that rotates */}
        <div
          className="w-full h-full flex flex-col transition-transform duration-300"
          style={rotationStyle}
        >
          {/* Image Area */}
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <img
              src={imagePath}
              alt={card.name}
              className="object-cover w-full h-full"
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* Zoomed Card Overlay */}
      {isZoomed && (
        <div
          className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-40" // Backdrop
          onClick={handleCloseZoom} // Use the closing handler
        >
          <div
            className="fixed bg-gray-700 rounded-[10px] shadow-xl overflow-hidden border-4 border-yellow-500 z-50 pointer-events-auto" // Added pointer-events-auto to ensure leave event fires
            style={{
              ...zoomPosition,
              width: `${BASE_CARD_WIDTH_PX * ZOOM_SCALE}px`,
              height: `${BASE_CARD_HEIGHT_PX * ZOOM_SCALE}px`,
            }}
            onMouseLeave={handleCloseZoom} // Use the closing handler here too
          >
            {/* Inner content doesn't need rotation here as the base card shows rotation state */}
            <div className="w-full h-full flex flex-col">
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <img
                  src={imagePath} // Use the same image path
                  alt={card.name}
                  className="object-cover w-full h-full"
                  draggable={false}
                />
              </div>
              {/* Optional: Add more card details to the zoom view if needed */}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Card;
