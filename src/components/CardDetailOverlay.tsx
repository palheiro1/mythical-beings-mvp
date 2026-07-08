import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Creature, Knowledge } from '../game/types.js';
import { cn, StatusBadge } from './ui/index.js';

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
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      onMouseDown={onClose}
    >
      <div
        className="surface-obsidian grid w-full max-w-3xl gap-4 rounded-xl border p-4 text-white shadow-[0_28px_90px_rgba(0,0,0,0.72)] sm:grid-cols-[minmax(180px,260px)_1fr] sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mx-auto aspect-[921/1217] w-full max-w-[220px] overflow-hidden rounded-xl border border-amber-200/40 bg-slate-950 shadow-[0_18px_44px_rgba(0,0,0,0.48)] sm:max-w-none">
          {showBack ? (
            <div className="card-back-face h-full w-full" aria-label="Hidden card">
              <img src="/logos/logo-header-dark.png" alt="" className="card-back-crest" draggable={false} />
            </div>
          ) : (
            <img src={imagePath} alt={card.name} className="h-full w-full object-cover" draggable={false} />
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

          <div className={cn('mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4', showBack ? 'text-slate-400' : 'text-slate-200')}>
            <p className="text-sm leading-6">{description}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CardDetailOverlay;
