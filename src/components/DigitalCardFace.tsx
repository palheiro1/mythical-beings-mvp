import { Ban, Droplet, Flame, Heart, Leaf, RotateCw, Shield, Sparkles, Swords, Wind, type LucideIcon } from 'lucide-react';
import CardArtwork from './CardArtwork.js';
import { getCardArtClass, getCardPresentation, type CycleKind, type DisplayCard } from '../utils/digitalCards.js';
import '../digital-cards.css';

const elementIcons: Record<string, LucideIcon> = { water: Droplet, earth: Leaf, air: Wind, fire: Flame, neutral: Sparkles };
const cycleIcons: Record<CycleKind, LucideIcon> = { wisdom: Sparkles, damage: Swords, defense: Shield, power: Heart, rotate: RotateCw, block: Ban, limit: Ban, effect: Sparkles };
const shortKinds: Record<CycleKind, string> = { wisdom: 'WIS', damage: 'DMG', defense: 'DEF', power: 'PWR', rotate: 'ROT', block: 'BLOCK', limit: 'MAX', effect: 'EFFECT' };

interface DigitalCardFaceProps {
  card: DisplayCard;
  rotation?: number;
  variant?: 'compact' | 'detail';
  imageLoading?: 'eager' | 'lazy';
  sizes?: string;
  descriptionId?: string;
  className?: string;
}

/** Shared, non-interactive face; its owner supplies the action or inspect button. */
export default function DigitalCardFace({ card, rotation = card.rotation ?? 0, variant = 'compact', imageLoading = 'eager', sizes, descriptionId, className = '' }: DigitalCardFaceProps) {
  const view = getCardPresentation(card, rotation);
  const ElementIcon = elementIcons[card.element] ?? Sparkles;
  const CurrentIcon = cycleIcons[view.current.kind];
  const detail = variant === 'detail';

  return <span className={`dc-frame dc-${view.knowledge ? 'knowledge' : 'being'} dc-${variant} ${view.nameIsLong ? 'dc-long-name' : ''} ${className}`}
    data-element={card.element} data-card-id={card.id} data-rotation-step={view.step} data-final={view.final || undefined}>
    <span className="dc-face">
      <span className="dc-header">
        <span className="dc-value" aria-label={`${view.knowledge ? 'Cost' : 'Wisdom'} ${view.value}`}>
          <strong>{view.value}</strong><span>{view.knowledge ? 'COST' : 'WISDOM'}</span>
        </span>
        <span className="dc-name-block"><span className="dc-name">{card.name}</span><span className="dc-type">{view.knowledge ? 'Knowledge' : 'Being'} · {card.element}</span></span>
        <span className="dc-element" aria-label={card.element}><ElementIcon aria-hidden="true" /></span>
      </span>
      <span className={`dc-art-window ${getCardArtClass(card)}`}>
        <CardArtwork src={card.image} alt={card.name} className="dc-art-source" loading={imageLoading} sizes={sizes ?? (detail ? '500px' : '(max-width: 767px) 180px, 300px')} />
        <span className="dc-art-corner" aria-hidden="true" /><span className="dc-art-corner dc-art-corner-right" aria-hidden="true" />
      </span>
      {detail && <span className="dc-rules">
        <span className="dc-rules-label"><Sparkles aria-hidden="true" />{view.knowledge ? 'Card effect' : 'Passive ability'}</span>
        <span className="dc-rules-text" id={descriptionId}>{view.rules}</span>
      </span>}
      <span className="dc-footer">
        {detail ? <>
          <span className="dc-cycle-heading"><span>{view.knowledge ? 'Rotation effect' : 'Wisdom cycle'}</span><strong>{view.knowledge ? view.final ? 'Final rotation' : `${shortKinds[view.current.kind]} ${view.current.value}` : `${view.step * 90}°`}</strong></span>
          <span className="dc-cycle" aria-label="Rotation cycle">
            {view.cycle.map((entry, index) => {
              const Icon = cycleIcons[entry.kind];
              return <span key={index} className={`dc-cycle-step ${index === view.step ? 'is-current' : ''}`} aria-current={index === view.step ? 'step' : undefined} aria-label={`${index * 90} degrees: ${entry.label}`}>
                <span className="dc-cycle-value">{view.knowledge && <Icon aria-hidden="true" />}{entry.kind === 'limit' ? '≤' : ''}{entry.value}</span><span className="dc-cycle-angle">{index * 90}°</span>
              </span>;
            })}
          </span>
        </> : <>
          <span className="dc-compact-stat" aria-label={view.knowledge ? view.current.label : `Wisdom ${view.value}`}>
            {view.knowledge ? <><CurrentIcon aria-hidden="true" /><span>{view.current.kind === 'limit' ? '≤' : ''}{view.current.value}</span><span className="dc-stat-kind">{shortKinds[view.current.kind]}</span></> : <>W<span>{view.value}</span></>}
            {view.final && <span className="dc-final-mark" aria-label="Final rotation">!</span>}
          </span>
          <span className="dc-ticks" aria-label={`Rotation ${view.step * 90} degrees, step ${view.step + 1} of ${view.cycle.length}`}>
            {view.cycle.map((_, index) => <span key={index} className={index === view.step ? 'is-current' : ''} />)}
          </span>
        </>}
      </span>
    </span>
  </span>;
}
