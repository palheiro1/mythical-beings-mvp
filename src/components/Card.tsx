import React, { useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { useCardRegistry } from '../hooks/useCardRegistry.js';
import { Creature, Knowledge } from '../game/types.js';
import { cn } from './ui/cn.js';
import CardDetailOverlay from './CardDetailOverlay.js';
import DigitalCardFace from './DigitalCardFace.js';

interface CardProps {
  card: Creature | Knowledge;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  selected?: boolean;
  interactive?: boolean;
  ariaLabel?: string;
  onInspect?: (card: Creature | Knowledge) => void;
  rotation?: number; // degrees (0, 90, 180, 270)
  showBack?: boolean; // If true, show card back
  isDisabled?: boolean; // For actions, not hover/zoom
  fit?: 'card' | 'board';
  knowledgeStatus?: {
    steps: number;
    currentStep: number;
    effectLabel?: string;
    isFinalNext?: boolean;
  };
  imageLoading?: 'eager' | 'lazy';
}

const CARD_ASPECT_RATIO = 921 / 1217;
const DETAIL_ASPECT_RATIO = 320 / 538;
const HOVER_ZOOM_DELAY_MS = 360;

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

const Card: React.FC<CardProps> = ({
  card,
  onClick,
  isSelected,
  selected,
  interactive,
  ariaLabel,
  onInspect,
  rotation = card.rotation ?? 0,
  showBack = false,
  isDisabled = false,
  fit = 'card',
  knowledgeStatus,
  imageLoading = 'eager',
}) => {
  const registry = useCardRegistry();
  const [isZoomed, setIsZoomed] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [zoomFrame, setZoomFrame] = useState({ top: 80, left: 80, width: 280, height: 370 });
  const hoverTimer = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const normalizedRotation = normalizeRotation(rotation);
  const isBoardCard = fit === 'board';
  const isCardSelected = Boolean(isSelected || selected);
  const canUsePrimaryAction = Boolean(onClick) && !isDisabled;
  const canInspect = true;
  const hasPrimaryButton = canUsePrimaryAction || canInspect;

  const getCardTypeLabel = () => {
    if (showBack) return 'Hidden card';
    if ('cost' in card) return `${card.type} knowledge, cost ${card.cost}`;
    return 'Creature';
  };

  const effectiveAriaLabel = ariaLabel || [
    showBack ? 'Hidden card' : card.name,
    getCardTypeLabel(),
    isCardSelected ? 'selected' : null,
  ].filter(Boolean).join(', ');

  const calculateZoomFrame = useCallback(() => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 14;
    const gap = 18;

    let zoomHeight = Math.min(isBoardCard ? 440 : 500, Math.max(300, viewportHeight - 130));
    let zoomWidth = zoomHeight * DETAIL_ASPECT_RATIO;
    const maxWidth = Math.min(360, viewportWidth - margin * 2);

    if (zoomWidth > maxWidth) {
      zoomWidth = maxWidth;
      zoomHeight = zoomWidth / DETAIL_ASPECT_RATIO;
    }

    let left = rect.right + gap;
    if (left + zoomWidth > viewportWidth - margin) {
      left = rect.left - gap - zoomWidth;
    }
    if (left < margin) {
      left = Math.min(Math.max(rect.left + rect.width / 2 - zoomWidth / 2, margin), viewportWidth - zoomWidth - margin);
    }

    let top = rect.top + rect.height / 2 - zoomHeight / 2;
    top = Math.min(Math.max(top, margin), viewportHeight - zoomHeight - margin);

    setZoomFrame({ top, left, width: zoomWidth, height: zoomHeight });
  }, [isBoardCard]);

  const handleMouseEnter = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      calculateZoomFrame();
      setIsZoomed(true);
    }, HOVER_ZOOM_DELAY_MS);
  };

  const handleMouseLeaveOriginalCard = (): void => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setIsZoomed(false);
  };

  const handleCloseZoom = (): void => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setIsZoomed(false);
  };

  const handleClick = (): void => {
    handleCloseZoom();
    if (onClick && !isDisabled) {
      onClick(card.id);
    }
  };

  const handleInspect = (): void => {
    handleCloseZoom();
    onInspect?.({ ...card, rotation: normalizedRotation });
    setIsInspecting(true);
  };

  const handlePrimaryClick = (): void => {
    if (canUsePrimaryAction) {
      handleClick();
      return;
    }
    if (canInspect) {
      handleInspect();
    }
  };

  useEffect(() => {
    return (): void => {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
      }
    };
  }, []);

  const maybeInstance = (card as Knowledge).instanceId;

  useEffect(() => {
    if (!maybeInstance || !cardRef.current) return undefined;
    registry.register(`card:${maybeInstance}`, cardRef.current);
    return () => registry.register(`card:${maybeInstance}`, null);
  }, [maybeInstance, registry]);

  useEffect(() => {
    if (!isZoomed) return undefined;
    const handleResize = () => calculateZoomFrame();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [calculateZoomFrame, isZoomed]);

  const cardTransform = isBoardCard ? 'translate(-50%, -50%)' : undefined;
  const boardCardHeight = knowledgeStatus ? 'clamp(70px, 18vw, 96px)' : 'clamp(82px, 22vw, 112px)';
  const boardCardWidth = `calc(${boardCardHeight} * ${CARD_ASPECT_RATIO})`;
  const cardVisual = showBack ? (
    <span className="card-back-face" aria-hidden>
      <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" draggable={false} />
    </span>
  ) : (
    <DigitalCardFace
      card={card}
      rotation={normalizedRotation}
      imageLoading={imageLoading}
      sizes={isBoardCard ? '112px' : '(max-width: 639px) 46vw, (max-width: 1279px) 180px, 240px'}
    />
  );

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          'group/card relative z-10 grid h-full w-full place-items-center overflow-visible',
          canUsePrimaryAction || canInspect ? 'cursor-pointer' : 'cursor-default',
          isDisabled ? 'opacity-80' : '',
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeaveOriginalCard}
        title={showBack ? 'Hidden card' : card.name}
      >
        <button
          type="button"
          className={cn(
            'grid border-0 bg-transparent p-0 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/55 focus:ring-offset-2 focus:ring-offset-slate-950',
            isBoardCard ? 'absolute left-1/2 top-1/2' : 'relative h-full max-h-full',
            hasPrimaryButton ? 'cursor-pointer' : 'cursor-default',
            interactive === false ? 'cursor-default' : '',
          )}
          style={{
            aspectRatio: CARD_ASPECT_RATIO,
            width: isBoardCard ? boardCardWidth : undefined,
            height: isBoardCard ? boardCardHeight : undefined,
            transform: cardTransform,
          }}
          onClick={handlePrimaryClick}
          disabled={interactive === false}
          aria-label={effectiveAriaLabel}
          aria-pressed={canUsePrimaryAction ? isCardSelected : undefined}
        >
          <span
            className={cn(
              'block h-full w-full overflow-hidden rounded-[8px] bg-slate-950 shadow-[0_12px_28px_rgba(0,0,0,0.42)] ring-1 transition duration-300 ease-out will-change-transform',
              canUsePrimaryAction ? 'hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(0,0,0,0.48),0_0_18px_rgba(56,223,248,0.12)]' : '',
              isCardSelected ? 'card-state-ring ring-amber-200' : 'ring-[rgba(220,200,162,0.18)]',
              isDisabled ? 'saturate-[0.72]' : '',
            )}
          >
            {cardVisual}
          </span>
        </button>

        {!showBack && (
          <button
            type="button"
            className={cn(
              'absolute right-1.5 top-1.5 z-30 grid h-11 w-11 place-items-center rounded-full border border-cyan-200/25 bg-black/72 text-cyan-100 opacity-0 shadow-lg transition hover:bg-black/85 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/50 group-hover/card:opacity-100',
              isBoardCard && 'right-1 top-1 h-9 w-9',
            )}
            onClick={(event) => {
              event.stopPropagation();
              handleInspect();
            }}
            aria-label={`Inspect ${card.name}`}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {isZoomed && typeof document !== 'undefined' && createPortal((
        <div
          className="surface-obsidian pointer-events-none fixed z-50 overflow-hidden rounded-xl border border-amber-200/55 shadow-[0_24px_70px_rgba(0,0,0,0.7),0_0_26px_rgba(183,121,42,0.2)]"
          style={{
            top: zoomFrame.top,
            left: zoomFrame.left,
            width: zoomFrame.width,
            height: zoomFrame.height,
          }}
          aria-hidden
        >
          {showBack ? (
            <div className="card-back-face h-full w-full" aria-hidden>
              <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" draggable={false} />
            </div>
          ) : (
            <DigitalCardFace
              card={card}
              rotation={normalizedRotation}
              variant="detail"
              sizes={`${Math.ceil(zoomFrame.width)}px`}
            />
          )}
        </div>
      ), document.body)}

      <CardDetailOverlay
        card={{ ...card, rotation: normalizedRotation }}
        open={isInspecting}
        onClose={() => setIsInspecting(false)}
        showBack={showBack}
      />
    </>
  );
};

export default Card;
