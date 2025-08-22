import React, { useEffect, useMemo, useState } from 'react';
import { useCardRegistry } from '../../context/CardRegistry.js';

export type MoveEvent = {
  id: string;        // instanceId
  fromId: string;    // registry key where it was
  toId: string;      // registry key where it goes
  image: string;     // image url
};

interface CardMoveLayerProps {
  event?: MoveEvent | null;
  onDone?: () => void;
  durationMs?: number;
}

const CardMoveLayer: React.FC<CardMoveLayerProps> = ({ event, onDone, durationMs = 500 }) => {
  const registry = useCardRegistry();
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const [visible, setVisible] = useState(false);

  const rects = useMemo(() => {
    if (!event) return null;
    const from = registry.getRect(event.fromId);
    const to = registry.getRect(event.toId);
    return from && to ? { from, to } : null;
  }, [event, registry]);

  useEffect(() => {
    if (!event || !rects) return;

    // Start at 'from'
    setStyle({
      position: 'fixed',
      left: rects.from.left,
      top: rects.from.top,
      width: rects.from.width,
      height: rects.from.height,
      zIndex: 70,
      transition: `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`,
      transform: 'translate(0px, 0px)',
      opacity: 0.95,
    });
    setVisible(true);

    // In next frame, move to 'to'
    requestAnimationFrame(() => {
      if (!rects) return;
      const dx = rects.to.left - rects.from.left;
      const dy = rects.to.top - rects.from.top;
      setStyle(s => ({ ...(s || {}), transform: `translate(${dx}px, ${dy}px)` }));
      setTimeout(() => {
        setVisible(false);
        onDone && onDone();
      }, durationMs);
    });
  }, [event, rects, durationMs, onDone]);

  if (!event || !rects || !style || !visible) return null;

  return (
    <div style={style} className="pointer-events-none select-none">
      <img src={event.image} alt="moving-card" className="w-full h-full object-cover rounded-[10px] shadow-xl" />
    </div>
  );
};

export default CardMoveLayer;
