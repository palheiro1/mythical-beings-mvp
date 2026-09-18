import CardArtwork from './CardArtwork.js';
import DigitalCardFace from './DigitalCardFace.js';
import '../digital-cards-compact.css';
import { getDisplayCardForImage } from '../utils/cardCatalog.js';
import type { DisplayCard } from '../utils/digitalCards.js';

export default function CardFaceByImage({ src, alt, card: liveCard, className = '' }: { src: string; alt: string; card?: DisplayCard; className?: string }) {
  const card = liveCard ?? getDisplayCardForImage(src);
  return <span className={`block aspect-[921/1217] ${className}`}>
    {card ? <DigitalCardFace card={card} /> : <CardArtwork src={src} alt={alt} className="h-full w-full object-contain" />}
  </span>;
}
