import React, { useEffect, useState } from 'react';

export type DamageEvent = {
  key: string;           // unique id per event
  x: number;             // viewport x (px)
  y: number;             // viewport y (px)
  damage?: number;
  blocked?: number;      // defense absorbed
  crit?: boolean;
  bypass?: boolean;      // armor bypassed
};

interface CombatFloatersProps {
  event?: DamageEvent | null;
  onDone?: () => void;
}

const CombatFloaters: React.FC<CombatFloatersProps> = ({ event, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDone && onDone();
    }, 900);
    return () => clearTimeout(t);
  }, [event, onDone]);

  if (!event || !visible) return null;

  const parts: { text: string; className: string }[] = [];
  if (event.damage && event.damage > 0) parts.push({ text: `-${event.damage}`, className: 'text-red-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]' });
  if (event.blocked && event.blocked > 0) parts.push({ text: `(${event.blocked})`, className: 'text-blue-300' });
  if (event.crit) parts.push({ text: 'CRIT', className: 'text-yellow-300' });
  if (event.bypass) parts.push({ text: 'BYPASS', className: 'text-gray-200' });

  return (
    <div
      className="fixed pointer-events-none select-none z-[75]"
      style={{ left: event.x, top: event.y, transform: 'translate(-50%, -50%)' }}
    >
      <div className="animate-floatAndFade">
        <div className="flex gap-1 text-xl font-extrabold">
          {parts.map((p, i) => (
            <span key={i} className={p.className}>{p.text}</span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes floatAndFade {
          0% { transform: translate(-50%, -50%) translateY(10px); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translate(-50%, -50%) translateY(-24px); opacity: 0; }
        }
        .animate-floatAndFade { animation: floatAndFade 900ms ease-out forwards; }
      `}</style>
    </div>
  );
};

export default CombatFloaters;
