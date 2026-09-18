import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { GameState } from '../game/types.js';
import { describeMotion, trainingMotion, type MotionStep } from '../utils/trainingMotion.js';

type Anchor = { rect: DOMRect; face?: HTMLElement; element: HTMLElement };
type Snapshot = Map<string, Anchor>;
const colors: Record<string, string> = { water: '#8fe4dc', earth: '#bddf91', air: '#cbbcff', fire: '#ffb08b', neutral: '#e8c383' };

function snapshot(root: HTMLElement | null): Snapshot {
  const result: Snapshot = new Map();
  root?.querySelectorAll<HTMLElement>('[data-motion-anchor]').forEach(element => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) return;
    // Cards outside a scrolling tray travel to/from its visible zone instead.
    let parent = element.parentElement;
    while (parent && parent !== root) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden)/.test(style.overflow + style.overflowX + style.overflowY)) {
        const clip = parent.getBoundingClientRect();
        if (rect.right <= clip.left || rect.left >= clip.right || rect.bottom <= clip.top || rect.top >= clip.bottom) return;
      }
      parent = parent.parentElement;
    }
    const face = element.classList.contains('wd-card-art') ? element.cloneNode(true) as HTMLElement : undefined;
    result.set(element.dataset.motionAnchor!, { rect, face, element });
  });
  return result;
}

/** Presentation only: the authoritative local state and turn clock never wait for animation. */
export function useTrainingMotion(game: GameState, root: RefObject<HTMLDivElement | null>, layer: RefObject<HTMLDivElement | null>, layoutKey: string, paused: boolean) {
  const previous = useRef(game);
  const before = useRef<Snapshot>(new Map());
  const generation = useRef(0);
  const chain = useRef(Promise.resolve());
  const pendingBatches = useRef(0);
  const animations = useRef(new Set<Animation>());
  const [announcement, setAnnouncement] = useState('');
  const [presenting, setPresenting] = useState(false);
  const capture = useCallback(() => { before.current = snapshot(root.current); }, [root]);
  const cancel = useCallback(() => {
    generation.current++;
    animations.current.forEach(animation => animation.cancel());
    animations.current.clear();
    layer.current?.replaceChildren();
    chain.current = Promise.resolve();
    pendingBatches.current = 0;
    setPresenting(false);
  }, [layer]);

  useLayoutEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reset = () => { cancel(); capture(); };
    window.addEventListener('resize', reset);
    window.addEventListener('scroll', reset, true);
    const onVisibility = () => { if (document.hidden) reset(); };
    document.addEventListener('visibilitychange', onVisibility);
    media?.addEventListener('change', reset);
    return () => {
      cancel();
      window.removeEventListener('resize', reset);
      window.removeEventListener('scroll', reset, true);
      document.removeEventListener('visibilitychange', onVisibility);
      media?.removeEventListener('change', reset);
    };
  }, [cancel, capture]);

  useLayoutEffect(() => { cancel(); capture(); }, [layoutKey, paused, cancel, capture]);

  useLayoutEffect(() => {
    if (previous.current.gameId !== game.gameId) cancel();
    const steps = trainingMotion(previous.current, game);
    previous.current = game;
    const old = before.current;
    const next = snapshot(root.current);
    before.current = next;
    if (!steps.length || paused || document.hidden) return;
    setAnnouncement(steps.map(describeMotion).join('. '));
    const overlay = layer.current;
    if (!overlay || typeof overlay.animate !== 'function') return;
    const token = generation.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    setPresenting(true);
    pendingBatches.current++;
    const valid = () => token === generation.current && overlay.isConnected;
    const find = (id: string) => next.get(id) ?? old.get(id);
    const duration = steps.length > 6 ? 220 : 320;
    const impactDuration = Math.max(180, Math.min(360, 1200 / Math.max(1, steps.filter(step => step.kind !== 'move' && step.kind !== 'rotate').length)));
    const held = new Map<string, HTMLElement>();

    function copyFace(anchor: Anchor) {
      const node = document.createElement('div');
      node.className = 'wd-motion-flight';
      node.style.cssText = `left:${anchor.rect.x}px;top:${anchor.rect.y}px;width:${anchor.rect.width}px;height:${anchor.rect.height}px`;
      if (anchor.face) {
        const clone = anchor.face.cloneNode(true) as HTMLElement;
        clone.removeAttribute('data-motion-anchor');
        clone.querySelectorAll('[id],[data-motion-anchor]').forEach(child => { child.removeAttribute('id'); child.removeAttribute('data-motion-anchor'); });
        node.append(clone);
      }
      return node;
    }

    async function animate(element: HTMLElement, frames: Keyframe[], time = duration) {
      if (!valid()) return;
      const animation = element.animate(frames, { duration: time, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' });
      animations.current.add(animation);
      try { await animation.finished; } catch { /* Cancellation on layout change/unmount is normal. */ }
      finally { animation.cancel(); animations.current.delete(animation); }
    }
    function marker(rect: DOMRect, className: string, text = '', color = colors.neutral) {
      const node = document.createElement('div');
      node.className = `wd-motion-mark ${className}`;
      node.textContent = text;
      node.style.cssText = `left:${Math.max(8, Math.min(window.innerWidth - 168, rect.x + rect.width / 2 - 76))}px;top:${Math.max(8, Math.min(window.innerHeight - 48, rect.y + rect.height / 2 - 16))}px;--motion-color:${color}`;
      overlay!.append(node);
      return node;
    }
    async function pulse(anchor: Anchor | undefined, color: string, time = duration) {
      if (!anchor || !valid()) return;
      const node = marker(anchor.rect, 'wd-motion-ring', '', color);
      Object.assign(node.style, { left: `${anchor.rect.x - 3}px`, top: `${anchor.rect.y - 3}px`, width: `${anchor.rect.width + 6}px`, height: `${anchor.rect.height + 6}px` });
      await animate(node, reduced ? [{ opacity: .9 }, { opacity: 0 }] : [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1.02)', offset: .35 }, { opacity: 0, transform: 'scale(1.05)' }], reduced ? Math.min(time, 180) : time);
      node.remove();
    }
    async function play(step: MotionStep) {
      if (!valid()) return;
      if (step.kind === 'move') {
        held.get(step.from.anchor)?.remove();
        held.delete(step.from.anchor);
        const from = old.get(step.from.anchor) ?? old.get(step.from.zone) ?? find(step.from.zone);
        const to = next.get(step.to.anchor) ?? next.get(step.to.zone);
        if (!to) return;
        if (reduced || !from) { await pulse(to, colors.neutral); return; }
        const visual = from.face ?? to.face;
        const flight = copyFace({ ...from, face: visual });
        flight.className = `wd-motion-flight ${visual ? '' : 'wd-motion-card-back'}`;
        const width = from.face ? from.rect.width : to.face ? to.rect.width : 48;
        const height = from.face ? from.rect.height : to.face ? to.rect.height : 64;
        flight.style.cssText = `left:${from.rect.x}px;top:${from.rect.y}px;width:${width}px;height:${height}px`;
        overlay!.append(flight);
        const destinationWidth = to.face ? to.rect.width : Math.min(40, to.rect.width);
        const scale = destinationWidth / width;
        const dx = to.rect.x + to.rect.width / 2 - (from.rect.x + width / 2);
        const dy = to.rect.y + to.rect.height / 2 - (from.rect.y + height / 2);
        const conceal = to.face && to.element.isConnected
          ? animate(to.element, [{ opacity: 0 }, { opacity: 0, offset: .85 }, { opacity: 1 }]) : Promise.resolve();
        await Promise.all([conceal, animate(flight, [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * .45}px,${dy * .45 - 14}px) scale(1.06) rotate(-3deg)`, opacity: 1, offset: .45 },
          { transform: `translate(${dx}px,${dy}px) scale(${scale})`, opacity: to.face ? 1 : .15 },
        ])]);
        flight.remove();
        if (valid()) void pulse(to, colors[step.to.card.element]);
        return;
      }
      if (step.kind === 'rotate') {
        const target = find(step.to.anchor);
        if (!target) return;
        const delta = (step.to.card.rotation ?? 0) - (step.from.card.rotation ?? 0);
        const label = marker(target.rect, 'wd-motion-rotation', `${delta < 0 ? '↶' : '↷'} ${Math.abs(delta)}°`);
        const surface = held.get(step.to.anchor) ?? target.element;
        const tick = surface.querySelector<HTMLElement>('.dp-ticks>.is-current,.dc-ticks>.is-current');
        if (tick && !reduced) void animate(tick, [{ transform: 'scaleX(.2)', opacity: .35 }, { transform: 'scaleX(1)', opacity: 1 }]);
        const tilt = !reduced && surface.isConnected ? animate(surface, [
          { transform: 'rotate(0deg)' }, { transform: `rotate(${delta < 0 ? -9 : 9}deg) scale(1.035)`, offset: .45 }, { transform: 'rotate(0deg)' },
        ]) : Promise.resolve();
        await Promise.all([tilt, pulse(target, colors.neutral), animate(label, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }])]);
        label.remove();
        return;
      }
      const source = find(step.source);
      const target = find(step.target) ?? source;
      const color = step.kind === 'combat' || (step.kind === 'power' && (step.amount ?? 0) < 0) ? '#ffb3a5'
        : step.kind === 'power' ? '#a9e7bd' : colors[step.element];
      await pulse(source, colors[step.element], 100);
      if (!valid() || !target) return;
      const work: Promise<void>[] = [];
      if (step.kind === 'combat' && step.blocked) step.defenders?.forEach(id => work.push(pulse(find(id), colors.water)));
      const text = step.kind === 'combat' ? `${step.blocked ? `⛨ ${step.blocked} blocked${step.amount ? '  ' : ''}` : ''}${step.amount ? `−${step.amount}` : ''}${step.bypass ? ' · Pierce' : ''}`
        : step.kind === 'power' ? `${(step.amount ?? 0) > 0 ? '+' : '−'}${Math.abs(step.amount ?? 0)} Power` : step.label;
      const node = marker(target.rect, `wd-motion-${step.kind} wd-motion-${step.element}`, text, color);
      if (!reduced && source && source !== target) {
        const trail = document.createElement('div');
        trail.className = 'wd-motion-trail';
        const x = source.rect.x + source.rect.width / 2, y = source.rect.y + source.rect.height / 2;
        const dx = target.rect.x + target.rect.width / 2 - x, dy = target.rect.y + target.rect.height / 2 - y;
        trail.style.cssText = `left:${x}px;top:${y}px;width:${Math.hypot(dx, dy)}px;rotate:${Math.atan2(dy, dx)}rad;--motion-color:${color}`;
        overlay!.append(trail);
        work.push(animate(trail, [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: .8, offset: .5 }, { transform: 'scaleX(1)', opacity: 0 }], 220).then(() => trail.remove()));
      }
      work.push(pulse(target, color, impactDuration));
      work.push(animate(node, reduced ? [{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }]
        : [{ opacity: 0, transform: 'translateY(5px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)', offset: .2 }, { opacity: 1, offset: .75 }, { opacity: 0, transform: 'translateY(-12px)' }], impactDuration));
      await Promise.all(work);
      node.remove();
    }
    chain.current = chain.current.then(async () => {
      if (!valid()) return;
      // Keep expired cards on the table while their last activation is presented.
      if (!reduced) steps.forEach(step => {
        if (step.kind !== 'move' || step.to.zone !== 'discard' || !step.from.zone.startsWith('slot:')) return;
        const source = old.get(step.from.anchor);
        if (!source?.face) return;
        const node = copyFace(source);
        node.classList.add('wd-motion-resting');
        held.set(step.from.anchor, node);
        overlay.append(node);
      });
      // Transfers/rotations in one action share a beat; effects retain engine order.
      let group: MotionStep[] = [];
      for (const step of steps) {
        if (!valid()) return;
        if (step.kind === 'move' && step.to.zone === 'discard' && group.some(item => item.kind === 'rotate')) {
          await Promise.all(group.map(play)); group = [];
        }
        if (step.kind === 'move' || step.kind === 'rotate') { group.push(step); continue; }
        await Promise.all(group.map(play)); group = [];
        if (valid()) await play(step);
      }
      if (valid()) await Promise.all(group.map(play));
      held.forEach(node => node.remove());
    }).catch(() => { if (valid()) cancel(); }).finally(() => {
      if (valid() && --pendingBatches.current === 0) setPresenting(false);
    });
  }, [game, root, layer, paused, cancel]);

  return { capture, announcement, presenting };
}
