import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Creature, Knowledge } from '../game/types.js';
import DigitalCardFace from './DigitalCardFace.js';
import { getCardPresentation } from '../utils/digitalCards.js';

interface CardDetailOverlayProps {
  card: Creature | Knowledge | null;
  open: boolean;
  onClose: () => void;
  contextLabel?: string;
  showBack?: boolean;
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

  const presentation = getCardPresentation(card);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-3 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
      aria-describedby="card-detail-description"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} tabIndex={-1} className="surface-obsidian max-h-[calc(100dvh-2rem)] w-full max-w-[390px] overflow-y-auto rounded-xl border border-white/15 p-4 text-white shadow-2xl">
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-lg bg-[#09151e] p-1">
          <div>
            {contextLabel && <p className="text-xs text-cyan-200">{contextLabel}</p>}
            <h2 id="card-detail-title" className="font-display text-xl font-bold">{showBack ? 'Hidden card' : card.name}</h2>
            {!showBack && <span className="text-xs text-slate-300">{presentation.knowledge ? 'Cost' : 'Wisdom'} {presentation.value}</span>}
          </div>
          <button ref={closeButtonRef} type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/15 text-slate-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-200" onClick={onClose} aria-label="Close card details">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {showBack ? <>
          <div className="card-back-face aspect-[921/1217] w-full" aria-label="Hidden card">
            <img src="/logos/logo-header-dark.webp" alt="" width="520" height="388" className="card-back-crest" draggable={false} />
          </div>
          <p id="card-detail-description" className="mt-3 text-sm text-slate-300">This card is hidden.</p>
        </> : <DigitalCardFace card={card} variant="detail" descriptionId="card-detail-description" sizes="500px" />}
      </div>
    </div>,
    document.body,
  );
};

export default CardDetailOverlay;
