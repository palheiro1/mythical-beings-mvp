import { Ban, Droplet, Flame, Heart, Leaf, RotateCw, Shield, Sparkles, Swords, Wind, type LucideIcon } from 'lucide-react';
import CardArtwork from '../CardArtwork.js';
import { getCardArtClass, getCardPresentation, type CycleKind, type DisplayCard } from '../../utils/digitalCards.js';
import '../../digital-cards-play.css';

const elements: Record<string, LucideIcon> = { water: Droplet, earth: Leaf, air: Wind, fire: Flame, neutral: Sparkles };
const effects: Record<CycleKind, LucideIcon> = { wisdom: Sparkles, damage: Swords, defense: Shield, power: Heart, rotate: RotateCw, block: Ban, limit: Ban, effect: Sparkles };

/** Small play surface: square artwork, one value per meaning, then rotation. */
export default function PlayCardFace({ card, rotation = card.rotation ?? 0 }: { card: DisplayCard; rotation?: number }) {
  const view = getCardPresentation(card, rotation);
  const Element = elements[card.element] ?? Sparkles;
  const Effect = effects[view.current.kind];
  return <span className={`dc-frame dc-play dc-${view.knowledge ? 'knowledge' : 'being'}`} data-element={card.element} data-card-id={card.id} data-rotation-step={view.step} data-final={view.final || undefined}>
    <span className={`dc-art-window ${getCardArtClass(card)}`}>
      <CardArtwork src={card.image} alt={card.name} className="dc-art-source" sizes="180px" />
    </span>
    <span className="dp-stats">
      <span className="dp-primary" aria-label={`${view.knowledge ? 'Cost' : 'Wisdom'} ${view.value}`}><strong>{view.value}</strong><span className="dp-unit">{view.knowledge ? 'COST' : 'WIS'}</span></span>
      {view.knowledge ? <span className={`dp-effect dp-${view.current.kind}`} aria-label={view.current.label}><Effect aria-hidden="true" /><strong>{view.current.kind === 'limit' ? '≤' : ''}{view.current.value}</strong></span> : <Element className="dp-element" aria-label={card.element} />}
    </span>
    <span className="dp-ticks" aria-label={`Rotation ${view.step * 90} degrees, step ${view.step + 1} of ${view.cycle.length}${view.final ? ', final rotation' : ''}`}>
      {view.cycle.map((_, index) => <span key={index} className={index === view.step ? 'is-current' : ''} />)}
    </span>
  </span>;
}
