import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Creature, Knowledge } from '../game/types.js';
import { StatusBadge } from './ui/index.js';
import { cn } from './ui/cn.js';
import CardArtwork from './CardArtwork.js';

interface CardDetailOverlayProps {
  card: Creature | Knowledge | null;
  open: boolean;
  onClose: () => void;
  contextLabel?: string;
  showBack?: boolean;
}

function isKnowledge(card: Creature | Knowledge): card is Knowledge {
  return 'cost' in card && 'effect' in card;
}

const CardDetailOverlay: React.FC<CardDetailOverlayProps> = ({ card, open, onClose, contextLabel, showBack = false }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById('root');
    const rootWasInert = root?.hasAttribute('inert') ?? false;
    const rootAriaHidden = root?.getAttribute('aria-hidden');
    const previousOverflow = document.body.style.overflow;

    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hasAttribute('hidden'));

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!rootWasInert) root?.removeAttribute('inert');
      if (rootAriaHidden === null || rootAriaHidden === undefined) {
        root?.removeAttribute('aria-hidden');
      } else {
        root?.setAttribute('aria-hidden', rootAriaHidden);
      }
      window.requestAnimationFrame(() => previouslyFocusedRef.current?.focus());
    };
  }, [onClose, open]);

  if (!open || !card || typeof document === 'undefined') return null;

  const imagePath = card.image;
  const description = showBack
    ? 'This card is hidden.'
    : isKnowledge(card)
      ? card.effect
      : card.passiveAbility;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/76 px-3 py-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
      aria-describedby="card-detail-description"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="surface-obsidian grid w-full max-w-3xl gap-4 rounded-xl border p-4 text-white shadow-[0_28px_90px_rgba(0,0,0,0.72)] sm:grid-cols-[minmax(180px,260px)_1fr] sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mx-auto aspect-[921/1217] w-full max-w-[220px] overflow-hidden rounded-xl border border-amber-200/40 bg-slate-950 shadow-[0_18px_44px_rgba(0,0,0,0.48)] sm:max-w-none">
          {showBack ? (
            <div className="card-back-face h-full w-full" aria-label="Hidden card">
              <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" draggable={false} />
            </div>
          ) : (
            <CardArtwork src={imagePath} alt={card.name} className="h-full w-full object-cover" sizes="260px" />
          )}
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {contextLabel && <p className="text-xs font-bold uppercase tracking-normal text-cyan-200">{contextLabel}</p>}
              <h2 id="card-detail-title" className="mt-1 font-display text-3xl font-black text-slate-50">
                {showBack ? 'Hidden card' : card.name}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-amber-300/40"
              onClick={onClose}
              aria-label="Close card details"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {!showBack && (
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={isKnowledge(card) ? 'blue' : 'amber'}>
                {isKnowledge(card) ? card.type : 'Creature'}
              </StatusBadge>
              <StatusBadge tone="muted">{card.element}</StatusBadge>
              {isKnowledge(card) ? (
                <StatusBadge tone="violet">Cost {card.cost}</StatusBadge>
              ) : (
                <StatusBadge tone="violet">Wisdom {(card.wisdomCycle ?? [card.baseWisdom ?? 0]).join('/')}</StatusBadge>
              )}
            </div>
          )}

          <div id="card-detail-description" className={cn('mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4', showBack ? 'text-slate-400' : 'text-slate-200')}>
            <p className="text-sm leading-6">{description}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CardDetailOverlay;
