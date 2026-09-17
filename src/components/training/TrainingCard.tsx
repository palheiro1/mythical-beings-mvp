import DigitalCardFace from '../DigitalCardFace.js';
import '../../digital-cards-compact.css';
import type { Creature, Knowledge } from '../../game/types.js';

export type DisplayCard = Creature | Knowledge;
export default function TrainingCard({ card, onInspect, rotation = card.rotation ?? 0, board = false, selected = false }: {
  card: DisplayCard; onInspect: (card: DisplayCard) => void; rotation?: number; board?: boolean; selected?: boolean;
}) {
  return <div className={`wd-card ${board ? 'wd-card-board' : ''} ${selected ? 'is-selected' : ''}`}>
    <button type="button" className="wd-card-art" onClick={() => onInspect({ ...card, rotation })} aria-label={`Inspect ${card.name}`}>
      <DigitalCardFace card={card} rotation={rotation} sizes={board ? '180px' : '(max-width: 767px) 250px, 360px'} />
    </button>
  </div>;
}
