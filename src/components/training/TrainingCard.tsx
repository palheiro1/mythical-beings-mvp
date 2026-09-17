import { Info } from 'lucide-react';
import DigitalCardFace from '../DigitalCardFace.js';
import PlayCardFace from './PlayCardFace.js';
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
export default function TrainingCard({ card, onInspect, rotation = card.rotation ?? 0, board = false, selected = false, action, playFace = false }: {
  card: DisplayCard; onInspect: (card: DisplayCard) => void; rotation?: number; board?: boolean; selected?: boolean;
  action?: CardAction;
  playFace?: boolean;
}) {
  const caption = <><span><span>{card.name}</span>{playFace && action?.replacement && <small className="wd-play-replacement">Replace {action.replacement}</small>}</span><Info size={12} aria-hidden="true" /></>;
  return <div className={`wd-card ${board ? 'wd-card-board' : ''} ${selected ? 'is-selected' : ''} ${playFace ? 'wd-play-card' : ''}`}>
    <button type="button" className={`wd-card-art ${action?.highlighted ? 'is-highlighted' : ''}`} onClick={action ? action.onActivate : () => onInspect({ ...card, rotation })}
      aria-label={action?.label ?? `Inspect ${card.name}`} aria-disabled={action ? !action.valid : undefined}
      aria-pressed={action?.pressed} title={action?.reason} data-guide-target={action?.guideTarget}>
      {playFace ? <PlayCardFace card={card} rotation={rotation} /> : <DigitalCardFace card={card} rotation={rotation} sizes={board ? '180px' : '(max-width: 767px) 250px, 360px'} />}
      {playFace && !action && <span className="wd-play-caption">{caption}</span>}
      {!playFace && action?.replacement && <span className="wd-card-replacement">Replaces {action.replacement}</span>}
    </button>
    {action && <button type="button" className={playFace ? 'wd-play-caption' : 'wd-card-inspect'} aria-label={`Inspect ${card.name}`} onClick={() => onInspect({ ...card, rotation })}>{playFace ? caption : <Info size={18} aria-hidden="true" />}</button>}
  </div>;
}
