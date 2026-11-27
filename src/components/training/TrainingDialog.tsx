import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function TrainingDialog({ title, children, onClose, className, showBoard = false }: { title: string; children: ReactNode; onClose?: () => void; className?: string; showBoard?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const wasInert = root?.hasAttribute('inert');
    const overflow = document.body.style.overflow;
    if (!showBoard) {
      root?.setAttribute('inert', '');
      document.body.style.overflow = 'hidden';
    }
    ref.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) { event.preventDefault(); closeRef.current(); }
      if (showBoard || event.key !== 'Tab' || !ref.current) return;
      const elements = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'));
      const first = elements[0]; const last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      if (!showBoard) {
        if (!wasInert) root?.removeAttribute('inert');
        document.body.style.overflow = overflow;
      }
      window.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [showBoard]);
  return createPortal(<div className={showBoard ? 'wd-dialog-backdrop wd-target-backdrop' : 'wd-dialog-backdrop'} onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <div ref={ref} className={className ? `wd-dialog ${className}` : 'wd-dialog'} role="dialog" aria-modal={!showBoard} aria-labelledby={id} tabIndex={-1}>
      <header><h2 id={id}>{title}</h2>{onClose && <button className="wd-icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>}</header>
      {children}
    </div>
  </div>, document.body);
}
