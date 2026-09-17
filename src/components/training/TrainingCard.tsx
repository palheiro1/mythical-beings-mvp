import { Info } from 'lucide-react';
import DigitalCardFace from '../DigitalCardFace.js';
import '../../digital-cards-compact.css';
import type { Creature, Knowledge } from '../../game/types.js';

export type DisplayCard = Creature | Knowledge;
export interface CardAction {
  label: string;
  onActivate: () => void;
  valid: boolean;
  reason?: string;
  pressed?: boolean;
  highlighted?: boolean;
  guideTarget?: string;
  replacement?: string;
}
export default function TrainingCard({ card, onInspect, rotation = card.rotation ?? 0, board = false, selected = false, action }: {
  card: DisplayCard; onInspect: (card: DisplayCard) => void; rotation?: number; board?: boolean; selected?: boolean;
  action?: CardAction;
}) {
  return <div className={`wd-card ${board ? 'wd-card-board' : ''} ${selected ? 'is-selected' : ''}`}>
    <button type="button" className={`wd-card-art ${action?.highlighted ? 'is-highlighted' : ''}`} onClick={action ? action.onActivate : () => onInspect({ ...card, rotation })}
      aria-label={action?.label ?? `Inspect ${card.name}`} aria-disabled={action ? !action.valid : undefined}
      aria-pressed={action?.pressed} title={action?.reason} data-guide-target={action?.guideTarget}>
      <DigitalCardFace card={card} rotation={rotation} sizes={board ? '180px' : '(max-width: 767px) 250px, 360px'} />
      {action?.replacement && <span className="wd-card-replacement">Replaces {action.replacement}</span>}
    </button>
    {action && <button type="button" className="wd-card-inspect" aria-label={`Inspect ${card.name}`} onClick={() => onInspect({ ...card, rotation })}><Info size={18} aria-hidden="true" /></button>}
  </div>;
}
