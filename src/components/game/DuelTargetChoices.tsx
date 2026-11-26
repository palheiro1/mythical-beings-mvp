import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { choiceTargets, type CueTarget } from '../../game/presentation.js';
import { snapshotBoard } from '../../utils/duelMotionPlayer.js';
import type { DuelView } from '../../utils/trainingMotion.js';

function choicesOnBoard(view: DuelView) {
  if ('gameId' in view) {
    const pending = view.pendingEffect;
    if (!pending?.presentationSource) return;
    const cue = view.presentationCues
      ?.filter((c) => c.action === 'choose' && c.source === pending.presentationSource?.source)
      .at(-1);
    const targets = pending.choices.map((choice) => {
      if (choice.kind === 'hand' && view.players[choice.playerIndex].id === pending.playerId)
        return { anchor: `card:${choice.instanceId}`, zone: `hand:${pending.playerId}`, label: choice.label };
      return choiceTargets(view, [choice])[0];
    });
    return { source: pending.presentationSource.source, zone: cue?.sourceZone, targets };
  }
  if (!view.pendingEffect) return;
  // The server sends eligible anchors only to the chooser, in the order of the options.
  const event = view.events.filter((e) => e.type !== 'suspend' && e.type !== 'resume').at(-1);
  const cue = event?.cues?.filter((c) => c.action === 'choose').at(-1);
  if (!cue?.targets?.length) return;
  const targets = cue.targets;
  return {
    source: cue.source,
    zone: cue.sourceZone,
    targets: view.pendingEffect.choices.map((choice, i) => (choice.kind === 'hand' ? targets[0] : targets[i])),
  };
}

function pointerPath(from: DOMRect, to: DOMRect) {
  const x = from.left + from.width / 2,
    y = from.top + from.height / 2;
  const dx = to.left + to.width / 2 - x,
    dy = to.top + to.height / 2 - y;
  if (Math.hypot(dx, dy) < 8) {
    return `M ${from.right - 3} ${y} Q ${from.right + 30} ${from.top - 22} ${x + 4} ${from.top + 3}`;
  }
  const edge = (rect: DOMRect) => Math.min(rect.width / 2 / Math.abs(dx), rect.height / 2 / Math.abs(dy), 0.44);
  const start = edge(from),
    end = 1 - edge(to);
  const mid = (start + end) / 2,
    curve = Math.min(0.1, 26 / Math.hypot(dx, dy));
  return `M ${x + start * dx} ${y + start * dy} Q ${x + mid * dx - curve * dy} ${y + mid * dy + curve * dx} ${x + end * dx} ${y + end * dy}`;
}

interface Props {
  view: DuelView;
  board: RefObject<HTMLDivElement | null>;
  className: string;
  children: ReactNode;
}

export default function DuelTargetChoices({ view, board, className, children }: Props) {
  const options = useRef<HTMLDivElement>(null);
  const shaft = useRef<SVGPathElement>(null);
  const tip = useId();
  const decision = view.pendingEffect?.id;
  const layout = useMemo(() => choicesOnBoard(view), [view]);
  const [aim, setAim] = useState<{ decision: string; index: number } | null>(null);
  const target: CueTarget | undefined = aim && aim.decision === decision ? layout?.targets[aim.index] : undefined;

  useEffect(() => {
    const root = board.current,
      list = options.current;
    if (!layout || !decision || !root || !list) return;
    const option = (index: number) =>
      list.querySelector<HTMLButtonElement>(`[data-choice-index="${index}"]:not(:disabled)`);
    const indexAt = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return -1;
      const button = el.closest<HTMLButtonElement>('button[data-choice-index]');
      if (button && list.contains(button)) return button.disabled ? -1 : Number(button.dataset.choiceIndex);
      const id = el.closest<HTMLElement>('[data-motion-anchor]')?.dataset.motionAnchor;
      if (!id || !(id.startsWith('card:') || id.startsWith('creature:'))) return -1;
      return layout.targets.findIndex((t) => t?.anchor === id);
    };
    const point = (event: Event) => {
      const index = indexAt(event.target);
      if (index < 0 || !option(index)) return setAim(null);
      setAim((current) => (current?.decision === decision && current.index === index ? current : { decision, index }));
    };
    function leave(event: Event) {
      const next = indexAt((event as PointerEvent | FocusEvent).relatedTarget);
      if (next < 0) setAim(null);
    }
    const confirm = (event: Event) => {
      const index = indexAt(event.target);
      setAim(null);
      if (index < 0 || list.contains(event.target as Node)) return;
      const button = option(index);
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        button.click();
      }
    };
    const surfaces = root.contains(list) ? [root] : [root, list];
    const eligible = Array.from(root.querySelectorAll<HTMLElement>('[data-motion-anchor]')).flatMap((el) => {
      const index = indexAt(el);
      if (index < 0 || !option(index)) return [];
      el.dataset.choiceEligible = '';
      const label = el.getAttribute('aria-label'),
        disabled = el.getAttribute('aria-disabled');
      const aimLabel = `Choose ${layout.targets[index].label}`;
      if (el instanceof HTMLButtonElement) {
        el.setAttribute('aria-label', aimLabel);
        el.removeAttribute('aria-disabled');
      }
      return [
        () => {
          delete el.dataset.choiceEligible;
          if (el.getAttribute('aria-label') === aimLabel) {
            if (label === null) el.removeAttribute('aria-label');
            else el.setAttribute('aria-label', label);
          }
          if (disabled !== null && !el.hasAttribute('aria-disabled')) el.setAttribute('aria-disabled', disabled);
        },
      ];
    });
    const handlers: [string, EventListener][] = [
      ['pointerover', point],
      ['pointerdown', point],
      ['focusin', point],
      ['pointerout', leave],
      ['focusout', leave],
      ['pointercancel', () => setAim(null)],
      ['click', confirm],
    ];
    surfaces.forEach((el) => handlers.forEach(([type, fn]) => el.addEventListener(type, fn, true)));
    return () => {
      eligible.forEach((restore) => restore());
      surfaces.forEach((el) => handlers.forEach(([type, fn]) => el.removeEventListener(type, fn, true)));
    };
  }, [board, decision, layout]);

  useLayoutEffect(() => {
    if (!target || !layout || !aim) return;
    const { source, zone } = layout;
    const { anchor, zone: targetZone } = target;
    const { index } = aim;
    const originInPile = view.discardPile.some((card) => `card:${card.instanceId}` === source);
    const ids = new Set([source, zone ?? '', target.anchor, target.zone ?? '', ...(originInPile ? ['discard'] : [])]);
    function place() {
      const anchors = snapshotBoard(board.current, ids);
      const from = anchors.get(source) ?? (zone && anchors.get(zone)) ?? (originInPile && anchors.get('discard'));
      const to = anchors.get(anchor) ?? (targetZone && anchors.get(targetZone));
      const option = options.current?.querySelector(`[data-choice-index="${index}"]`);
      const end = (to && to.rect) || option?.getBoundingClientRect();
      shaft.current?.setAttribute('d', from && end ? pointerPath(from.rect, end) : '');
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [board, target, aim, layout, view.discardPile]);

  return (
    <div ref={options} className={className}>
      {children}
      {target &&
        createPortal(
          <svg className="wd-choice-pointer" aria-hidden="true">
            <defs>
              <marker
                id={tip}
                markerWidth="13"
                markerHeight="12"
                refX="11"
                refY="6"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M1 1 12 6 1 11 4 6Z" fill="#f1d399" stroke="#4c3829" strokeWidth="1" />
              </marker>
            </defs>
            <path ref={shaft} className="wd-choice-shaft" markerEnd={`url(#${tip})`} />
          </svg>,
          document.body,
        )}
    </div>
  );
}
