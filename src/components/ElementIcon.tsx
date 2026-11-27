import { Flame, Sparkles, type LucideProps } from 'lucide-react';
import airIcon from '../assets/elements/air.svg?no-inline';
import earthIcon from '../assets/elements/earth.svg?no-inline';
import waterIcon from '../assets/elements/water.svg?no-inline';

const originalIcons: Record<string, string> = { air: airIcon, earth: earthIcon, water: waterIcon };
type ElementIconProps = Pick<LucideProps, 'size' | 'className' | 'aria-label' | 'aria-hidden'> & { element?: string };

/** Ana Santiso's original SVGs retain their shapes and colour gradients. */
export default function ElementIcon({ element = 'neutral', size = 16, className, 'aria-label': label, 'aria-hidden': hidden }: ElementIconProps) {
  const src = originalIcons[element];
  if (!src) {
    const Icon = element === 'fire' ? Flame : Sparkles;
    return <Icon size={size} className={className} aria-label={label} aria-hidden={hidden} data-element-icon={element} />;
  }
  return <img src={src} alt={hidden === true || hidden === 'true' ? '' : label ?? element} width={size} height={size} className={className}
    aria-label={label} aria-hidden={hidden} data-element-icon={element} draggable={false}
    style={{ objectFit: 'contain', ...(element === 'earth' ? { background: '#f4e8d1', borderRadius: 2, padding: 1 } : {}) }} />;
}
