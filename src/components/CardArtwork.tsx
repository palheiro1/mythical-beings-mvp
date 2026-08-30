import React, { useEffect, useState } from 'react';
import { cn } from './ui/cn.js';
import { getResponsiveCardSrcSet } from '../utils/cardAssets.js';

interface CardArtworkProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  draggable?: boolean;
  sizes?: string;
}

const CardArtwork: React.FC<CardArtworkProps> = ({
  src,
  alt,
  className,
  loading = 'eager',
  draggable = false,
  sizes = '(max-width: 639px) 46vw, (max-width: 1279px) 180px, 360px',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <span
        className={cn('grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.2),transparent_34%),linear-gradient(145deg,#10172c,#050811_55%,#211136)] p-4 text-center', className)}
        role="img"
        aria-label={`${alt}. Artwork unavailable.`}
      >
        <span>
          <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="mx-auto mb-3 h-12 w-12 object-contain opacity-65" aria-hidden />
          <span className="block font-display text-lg font-bold text-slate-100">{alt}</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-normal text-cyan-200">Artwork unavailable</span>
        </span>
      </span>
    );
  }

  const responsiveSrcSet = getResponsiveCardSrcSet(src);
  const isVectorArtwork = src.endsWith('.svg');

  return (
    <img
      src={src}
      srcSet={responsiveSrcSet}
      sizes={responsiveSrcSet ? sizes : undefined}
      alt={alt}
      width={isVectorArtwork ? 921 : 720}
      height={isVectorArtwork ? 1217 : 951}
      className={className}
      loading={loading}
      decoding="async"
      draggable={draggable}
      onError={() => setFailed(true)}
    />
  );
};

export default CardArtwork;
