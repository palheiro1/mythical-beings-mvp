import type { CSSProperties } from 'react';
import CardArtwork from '../CardArtwork.js';
import type { Creature, Knowledge } from '../../game/types.js';

export type DisplayCard = Creature | Knowledge;
export default function TrainingCard({ card, onInspect, rotation = 0, board = false, selected = false }: {
  card: DisplayCard; onInspect: (card: DisplayCard) => void; rotation?: number; board?: boolean; selected?: boolean;
}) {
  return <div className={`wd-card ${board ? 'wd-card-board' : ''} ${selected ? 'is-selected' : ''}`}>
    <button type="button" className="wd-card-art" onClick={() => onInspect(card)} aria-label={`Inspect ${card.name}`}
      style={{ '--card-rotation': `${rotation}deg` } as CSSProperties}>
      <CardArtwork src={card.image} alt={card.name} className="wd-artwork" sizes={board ? '112px' : '(max-width: 767px) 140px, 240px'} />
    </button>
  </div>;
}
