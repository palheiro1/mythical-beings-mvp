import type { CueTarget, PresentationCue } from '../game/presentation.js';
import type { MotionStep } from './trainingMotion.js';
import type { SoundPresentation } from '../audio/trainingAudio.js';

interface Anchor {
  rect: DOMRect;
  element: HTMLElement;
  face?: HTMLElement;
}
type Snapshot = Map<string, Anchor>;
const ink = {
  attack: '#ffae75',
  shield: '#80e7ec',
  loss: '#ff9b91',
  gain: '#97f0b2',
  special: '#d5b4ff',
  move: '#ecd4a1',
  ember: '#ffb076',
  wind: '#b9dfcc',
};
export const duelTiming = {
  move: 550,
  source: 900,
  travel: 700,
  target: 1000,
  result: 2000,
  shortResult: 850,
  chainLimit: 12_000,
} as const;

function stepTiming(step: MotionStep) {
  const effect = step.kind === 'effect' ? step : undefined;
  const quick =
    step.kind === 'move' ||
    step.kind === 'rotate' ||
    (!!effect &&
      (effect.action === 'skip' ||
        effect.action === 'available' ||
        effect.action === 'free' ||
        effect.action === 'play' ||
        (effect.action === 'draw' && !effect.reason) ||
        (effect.action === 'rotate' && effect.source === effect.target) ||
        (effect.action === 'discard' && effect.reason !== 'Forced discard')));
  const intercept = step.kind === 'combat' && !!step.blocked && !step.bypass;
  const markedForDiscard = effect?.action === 'discard' && effect.reason === 'Forced discard';
  const quickResult = effect && effect.action !== 'draw' && effect.action !== 'play' ? duelTiming.shortResult : 0;
  return {
    source: quick ? 0 : duelTiming.source,
    travel: quick ? duelTiming.move : duelTiming.travel,
    target: intercept || markedForDiscard ? duelTiming.target : 0,
    residual: intercept && step.amount ? duelTiming.travel : 0,
    result: quick ? quickResult : duelTiming.result,
  };
}

type StepTiming = ReturnType<typeof stepTiming>;
type Caption = (preview?: string, targets?: readonly CueTarget[]) => void;

export function snapshotBoard(root: HTMLElement | null, only?: ReadonlySet<string>): Snapshot {
  const anchors: Snapshot = new Map();
  root?.querySelectorAll<HTMLElement>('[data-motion-anchor]').forEach((element) => {
    const id = element.dataset.motionAnchor!;
    if (only && !only.has(id)) return;
    const rect = element.getBoundingClientRect();
    if (
      !rect.width ||
      !rect.height ||
      rect.bottom <= 0 ||
      rect.top >= innerHeight ||
      rect.right <= 0 ||
      rect.left >= innerWidth
    )
      return;
    for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (!/(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) continue;
      const clip = parent.getBoundingClientRect();
      if (rect.right <= clip.left || rect.left >= clip.right || rect.bottom <= clip.top || rect.top >= clip.bottom)
        return;
    }
    const face =
      !only && element.matches('.wd-card-art,[data-motion-face]')
        ? (element.cloneNode(true) as HTMLElement)
        : undefined;
    anchors.set(id, { element, rect, face });
  });
  return anchors;
}

function frames(reduced: boolean, transform: string): Keyframe[] {
  return reduced
    ? [{ opacity: 1 }, { opacity: 1 }]
    : [{ transform: 'none' }, { transform, offset: 0.6 }, { transform: 'none' }];
}

export function playDuelMotion(
  layer: HTMLElement,
  old: Snapshot,
  next: Snapshot,
  steps: MotionStep[],
  sound?: SoundPresentation,
  onCaption?: (index: number, preview?: string, targets?: readonly CueTarget[]) => void,
) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const animations = new Set<Animation>();
  const held = new Map<string, HTMLElement>();
  const counters = new Set<HTMLElement>();
  const bonusLights = new Set<HTMLElement>();
  const nodes = new Set<Element>();
  let stopped = false;
  const find = (id: string) =>
    next.get(id) ?? old.get(id) ?? (id.startsWith('actions:') ? next.get(id.replace('actions:', 'power:')) : undefined);
  function append<T extends Element>(node: T): T {
    layer.append(node);
    nodes.add(node);
    return node;
  }
  function remove(node?: Element) {
    if (node) {
      node.remove();
      nodes.delete(node);
    }
  }
  async function animate(node: HTMLElement, keys: Keyframe[], duration: number) {
    if (stopped) return;
    const animation = node.animate(keys, { duration, fill: 'both', easing: 'ease-out' });
    animations.add(animation);
    try {
      await animation.finished;
    } catch {
      /* Resize, navigation and fast-forward cancel a beat. */
    } finally {
      animation.cancel();
      animations.delete(animation);
    }
  }
  function box(anchor: Anchor, className: string, color: string) {
    const node = document.createElement('div');
    node.className = className;
    node.style.cssText = `left:${anchor.rect.left}px;top:${anchor.rect.top}px;width:${anchor.rect.width}px;height:${anchor.rect.height}px;--cue-color:${color}`;
    return append(node);
  }
  function ring(anchor: Anchor | undefined, color: string) {
    if (anchor) return box(anchor, 'wd-motion-ring wd-cue-ring', color);
  }
  function badge(
    anchor: Anchor | undefined,
    symbol: string,
    title: string,
    detail: string,
    color: string,
    result = false,
    below = false,
  ) {
    if (!anchor) return;
    const node = document.createElement('div');
    node.className = result ? 'wd-cue-badge wd-motion-result' : 'wd-cue-badge';
    node.style.setProperty('--cue-color', color);
    const icon = document.createElement('i');
    icon.textContent = symbol;
    const name = document.createElement('strong');
    name.textContent = title;
    node.append(icon, name);
    if (detail) {
      const small = document.createElement('small');
      small.textContent = detail;
      node.append(small);
    }
    append(node);
    const bounds = node.getBoundingClientRect();
    const x = anchor.rect.left + (anchor.rect.width - bounds.width) / 2;
    const above = anchor.rect.top - bounds.height + 8;
    const desiredY = below && anchor.rect.bottom + bounds.height < innerHeight ? anchor.rect.bottom - 4 : above;
    node.style.left = `${Math.max(4, Math.min(innerWidth - bounds.width - 4, x))}px`;
    node.style.top = `${Math.max(4, Math.min(innerHeight - bounds.height - 4, desiredY >= 4 ? desiredY : anchor.rect.bottom - 8))}px`;
    return node;
  }
  type Mark = 'quake' | 'ember' | 'gust' | 'gain' | 'impact' | 'shield';
  function center({ rect }: Anchor) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  function mark(kind: Mark, x: number, y: number, width: number) {
    const node = document.createElement('span');
    node.className = `wd-table-mark wd-mark-${kind}`;
    Object.assign(node.style, { left: `${x}px`, top: `${y}px`, width: `${width}px` });
    node.append(document.createElement('i'));
    return append(node);
  }
  function drift(
    kind: Mark,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    ms: number,
    bend = 0,
  ) {
    if (reduced) return mark(kind, to.x, to.y, width);
    const node = mark(kind, from.x, from.y, width);
    const dx = to.x - from.x,
      dy = to.y - from.y;
    void animate(
      node,
      [
        { transform: 'scale(.62)', opacity: 0.65 },
        { transform: `translate(${dx * 0.5 + bend}px,${dy * 0.5 - bend}px) scale(1.08)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(.9)`, opacity: 0.75 },
      ],
      ms,
    ).then(() => remove(node));
  }
  function strike(
    kind: 'quake' | 'impact' | 'gain',
    from: Anchor | undefined,
    to: Anchor | undefined,
    ms: number,
    bypass = false,
  ) {
    if (!to) return;
    const end = center(to);
    const size = Math.max(48, Math.min(kind === 'quake' ? 112 : 76, to.rect.width * 0.9));
    if (kind === 'quake') end.y += Math.min(18, to.rect.height * 0.18);
    if (!from || reduced) return mark(kind, end.x, end.y, size);
    drift(kind, center(from), end, size, ms, bypass ? 50 : 0);
  }
  function kindle(anchor?: Anchor) {
    if (!anchor) return;
    const { rect } = anchor;
    return mark(
      'ember',
      rect.right - Math.min(12, rect.width * 0.2),
      rect.top + Math.min(19, rect.height * 0.3),
      Math.max(28, Math.min(46, rect.width * 0.45)),
    );
  }
  function gust(anchors: Anchor[], duration: number) {
    if (!anchors.length) return;
    const centers = anchors.map(center);
    const xs = centers.map((p) => p.x),
      ys = centers.map((p) => p.y);
    const vertical = Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs);
    const axis = vertical ? 'y' : 'x';
    centers.sort((a, b) => a[axis] - b[axis]);
    const width = Math.max(78, Math.min(178, anchors[0].rect.width * 1.4));
    if (reduced) {
      centers.forEach((p) => mark('gust', p.x, p.y, width * 0.65));
      return;
    }
    const from = { ...centers[0] },
      to = { ...centers[centers.length - 1] };
    from[axis] -= width * 0.3;
    to[axis] += width * 0.3;
    drift('gust', from, to, width, duration, 8);
  }
  function copy(anchor: Anchor, face?: HTMLElement) {
    const node = box(anchor, 'wd-motion-flight', ink.move);
    if (face) {
      const clone = face.cloneNode(true) as HTMLElement;
      [clone, ...clone.querySelectorAll('*')].forEach((el) => {
        el.removeAttribute('id');
        el.removeAttribute('data-motion-anchor');
        el.removeAttribute('autofocus');
      });
      node.append(clone);
    } else node.classList.add('wd-motion-card-back');
    return node;
  }
  function origin(t: CueTarget) {
    if (t.concealed && t.zone) return old.get(t.zone) ?? next.get(t.zone);
    return old.get(t.anchor) ?? (t.zone ? old.get(t.zone) : undefined) ?? find(t.anchor);
  }
  function destination(t: CueTarget) {
    if (t.destination === 'discard') return find('discard');
    if (t.destination?.startsWith('hand:') && t.concealed) return find(t.destination);
    return next.get(t.anchor) ?? (t.destination ? find(t.destination) : undefined);
  }
  async function flight(t: CueTarget, time: number, burning = false) {
    const from = origin(t),
      to = destination(t);
    if (!from || !to) return;
    if (reduced) {
      ring(to, ink.move);
      return;
    }
    const face = t.concealed ? undefined : (from.face ?? to.face);
    const node = copy(from, face);
    if (burning) {
      const ember = document.createElement('span');
      ember.className = 'wd-table-mark wd-mark-ember wd-carried-ember';
      ember.append(document.createElement('i'));
      node.append(ember);
    }
    if (!from.face) {
      const width = to.face ? to.rect.width : Math.min(54, from.rect.width);
      const height = to.face ? to.rect.height : Math.min(72, from.rect.height);
      Object.assign(node.style, {
        width: `${width}px`,
        height: `${height}px`,
        left: `${from.rect.x + (from.rect.width - width) / 2}px`,
        top: `${from.rect.y + (from.rect.height - height) / 2}px`,
      });
    }
    const dx = to.rect.x + to.rect.width / 2 - from.rect.x - from.rect.width / 2;
    const dy = to.rect.y + to.rect.height / 2 - from.rect.y - from.rect.height / 2;
    const arrivesHidden = (t.concealed && t.destination?.startsWith('hand:')) || t.destination === 'discard';
    const animation = animate(
      node,
      [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${dx}px,${dy}px) scale(${arrivesHidden ? 0.32 : 1})`,
          opacity: arrivesHidden ? 0.45 : 1,
        },
      ],
      time,
    );
    const settling =
      to.face && to.element.isConnected
        ? animate(to.element, [{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], time)
        : undefined;
    await Promise.all([animation, settling]);
    remove(node);
  }
  function showValue(node?: HTMLElement | null, value?: number) {
    if (node?.isConnected && value !== undefined) {
      node.dataset.displayedValue = String(Math.max(0, value));
      counters.add(node);
    }
  }
  const wait = (time: number) => animate(layer, [{ opacity: 1 }, { opacity: 1 }], time);
  const cleanup = () => {
    stopped = true;
    animations.forEach((a) => a.cancel());
    animations.clear();
    nodes.forEach((node) => node.remove());
    nodes.clear();
    counters.forEach((node) => delete node.dataset.displayedValue);
    counters.clear();
    bonusLights.forEach((light) => delete light.dataset.awaitingEffect);
    bonusLights.clear();
  };
  async function combat(cue: PresentationCue, time: StepTiming, caption: Caption) {
    const source = find(cue.source) ?? (cue.sourceZone ? find(cue.sourceZone) : undefined) ?? undefined,
      target = find(cue.target);
    const amount = Math.abs(cue.amount ?? 0),
      blocked = cue.blocked ?? 0;
    const attack = cue.attack ?? amount + blocked;
    const scoring = cue.kind === 'power' && (cue.amount ?? 0) > 0;
    const material = scoring ? 'gain' : cue.label === 'Earthquake' ? 'quake' : 'impact';
    const quantity = scoring ? `+${amount} Power` : `${attack} damage`;
    const trigger = cue.triggeredBy ? ` (${cue.triggeredBy.label} ${cue.trigger ?? 'left play'})` : '';
    caption(`${cue.label}${trigger} · ${quantity}`);
    ring(source, scoring ? ink.gain : ink.attack);
    badge(source, scoring ? '✦' : '⚔', cue.label, quantity, scoring ? ink.gain : ink.attack);
    if (!scoring) sound?.play({ kind: 'attack', element: cue.element });
    const surface = held.get(cue.source) ?? source?.element;
    if (surface?.isConnected) void animate(surface, frames(reduced, 'translateY(-4px) scale(1.045)'), time.source);
    await wait(time.source);
    if (stopped) return;
    const guards = cue.defense ?? (cue.defenders ?? []).map((anchor) => ({ anchor, label: 'Defense' }) as CueTarget);
    const shields = guards.map((g) => find(g.anchor) ?? (g.zone ? find(g.zone) : undefined));
    if (cue.bypass && cue.provider) {
      const provider = find(cue.provider.source);
      ring(provider, ink.special);
      badge(provider, '✦', cue.provider.label, 'Defense bypassed', ink.special);
      caption(`${cue.label} · ${quantity} → ${cue.provider.label} bypasses Defense`, [
        { anchor: cue.provider.source, label: cue.provider.label, zone: cue.provider.source },
      ]);
    }
    if (blocked && !cue.bypass) {
      shields.forEach((guard) => strike(material, source, guard, time.travel));
      await wait(time.travel);
      if (stopped) return;
      sound?.play({ kind: 'block', amount: blocked });
      const contributions = guards.map((g) => (g.amount === undefined ? g.label : `${g.label} · ${g.amount} Defense`));
      caption(
        [`${cue.label} · ${quantity}`, contributions.join(' + '), `${blocked} blocked`].filter(Boolean).join(' → '),
        guards,
      );
      guards.forEach((g, i) => {
        ring(shields[i], ink.shield);
        const guard = shields[i];
        if (guard) {
          const p = center(guard);
          mark('shield', p.x, p.y, Math.max(32, Math.min(50, guard.rect.width * 0.45)));
        }
        badge(shields[i], '⛨', g.label, g.amount === undefined ? 'Defense' : `${g.amount} Defense`, ink.shield);
      });
      await wait(time.target);
      if (stopped) return;
      if (time.residual) {
        strike(material, shields.find(Boolean) ?? source, target, time.residual);
        await wait(time.residual);
      }
    } else {
      strike(material, source, target, time.travel, cue.bypass);
      await wait(time.travel);
    }
    if (stopped) return;
    const color = scoring ? ink.gain : amount ? ink.loss : ink.shield;
    const detail = [
      blocked && amount ? `${blocked} blocked` : cue.bypass ? 'Defense bypassed' : '',
      cue.before === undefined || cue.after === undefined
        ? ''
        : `${Math.max(0, cue.before)} → ${Math.max(0, cue.after)}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const resultAnchor = !amount && shields.some(Boolean) ? shields.find(Boolean) : target;
    ring(resultAnchor, color);
    badge(
      resultAnchor,
      scoring ? '✦' : amount ? '◆' : '⛨',
      amount ? `${scoring ? '+' : '−'}${amount} Power` : `Blocked ${blocked}`,
      detail,
      color,
      true,
      !amount,
    );
    showValue(target?.element, cue.after);
    caption();
    if (amount && target?.element.isConnected)
      void animate(target.element, frames(reduced, 'scale(1.16)'), time.travel);
    if (amount) sound?.play({ kind: scoring ? 'heal' : 'damage', amount, element: cue.element });
    await wait(time.result);
  }
  async function effect(cue: PresentationCue, time: StepTiming, caption: Caption) {
    const targets = cue.targets ?? [],
      action = cue.action;
    const source =
      find(cue.source) ??
      (cue.sourceZone ? find(cue.sourceZone) : undefined) ??
      (cue.source.startsWith('card:') ? find('discard') : undefined);
    const fire = action === 'discard' && cue.label === 'Fire' && cue.reason === 'Forced discard';
    const color = fire
      ? ink.ember
      : action === 'reverse'
        ? ink.wind
        : action === 'discard'
          ? ink.loss
          : action === 'bonus' || action === 'available'
            ? ink.gain
            : ink.special;
    const symbol = action === 'reverse' ? '❧' : action === 'discard' ? '×' : '✦';
    const detail =
      cue.reason ??
      (
        {
          reverse: 'Rotate back',
          rotate: 'Rotate',
          choose: 'Choose a target',
          bonus: '+1 action next turn',
          available: 'Extra action available',
          free: 'No action spent',
          skip: 'Effect skipped',
          play: 'Played',
          draw: 'Draw',
          discard: 'Discard',
        } as Record<string, string>
      )[action ?? ''] ??
      'Effect';
    const isSimple = time.source === 0;
    const sourceBeat =
      action === 'play' || action === 'draw' ? origin(targets[0] ?? { anchor: cue.source, label: cue.label }) : source;
    const focus = action === 'draw' && cue.reason ? source : sourceBeat;
    caption(!isSimple || action === 'discard' || action === 'rotate' ? `${cue.label} · ${detail}` : undefined);
    if (action === 'available') {
      for (const light of source?.element.querySelectorAll<HTMLElement>('[data-awaiting-effect]') ?? []) {
        delete light.dataset.awaitingEffect;
        bonusLights.delete(light);
      }
    }
    ring(focus, color);
    if (fire) kindle(focus);
    if (!isSimple || action === 'bonus' || action === 'free' || action === 'skip')
      badge(focus, symbol, cue.label, detail, color);
    if (!isSimple) {
      const surface = held.get(cue.source) ?? focus?.element;
      if (surface?.isConnected) void animate(surface, frames(reduced, 'translateY(-4px) scale(1.045)'), time.source);
      await wait(time.source);
      if (stopped) return;
    }
    const located = targets.map((t) => ({ t, anchor: origin(t) ?? find(t.anchor) }));
    if (action === 'reverse')
      gust(
        located.flatMap(({ anchor }) => (anchor ? [anchor] : [])),
        time.travel,
      );
    const transfers: Promise<void>[] = [];
    const ignited = fire ? located.map(({ anchor }) => kindle(anchor)) : [];
    const names = targets.map((t) => (t.concealed ? 'Hidden card' : t.label));
    if (!isSimple && targets.length) caption(`${cue.label} · ${detail} → ${names.join(', ')}`, targets);
    if (time.target) {
      located.forEach(({ anchor }, index) => {
        ring(anchor, color);
        badge(anchor, symbol, names[index], detail, color);
      });
      await wait(time.target);
      if (stopped) return;
    }
    for (const { t, anchor } of located) {
      const to = t.destination ? destination(t) : anchor;
      if (!time.target) ring(action === 'discard' ? anchor : to, color);
      if (action === 'reverse' || action === 'rotate') {
        const node = held.get(t.anchor) ?? anchor?.element;
        if (node?.isConnected)
          void animate(node, frames(reduced, `rotate(${action === 'reverse' ? -12 : 10}deg)`), time.travel);
      } else if (action === 'discard' && !time.target) {
        badge(anchor, symbol, t.concealed ? 'Hidden card' : t.label, detail, color);
      } else if (action === 'status' && t.unit !== 'Wisdom') {
        badge(anchor, '⊘', t.label, detail, color);
      } else if (action === 'choose') {
        badge(anchor, '◎', t.label, 'Eligible target', color);
      } else if (action === 'bonus' || action === 'available' || action === 'free') {
        badge(to, symbol, action === 'available' ? `+${t.amount} action` : t.label, detail, color);
      }
      if (t.destination) {
        remove(held.get(t.anchor));
        held.delete(t.anchor);
        transfers.push(flight(t, time.travel, fire));
      }
    }
    if (!reduced) ignited.forEach(remove);
    const soundKind =
      action === 'discard'
        ? 'discard'
        : action === 'draw'
          ? 'draw'
          : action === 'play'
            ? 'place'
            : action === 'rotate' || action === 'reverse'
              ? 'rotate'
              : 'effect';
    sound?.play({ kind: soundKind, element: cue.element });
    await Promise.all([...transfers, wait(time.travel)]);
    if (stopped) return;
    for (const { t, anchor } of located) {
      if (t.unit === 'Wisdom') {
        showValue(wisdomValue(t), t.after);
        badge(anchor, symbol, t.label, `Wisdom ${t.before} → ${t.after}`, color);
      } else if (action === 'rotate' || action === 'reverse') {
        badge(anchor, symbol, t.label, `${t.before}° → ${t.after}°`, color);
      }
    }
    if (action === 'discard') {
      const pile = find('discard');
      badge(pile, '×', 'Discards', targets.map((t) => t.label).join(', '), color, true);
    }
    caption();
    if (time.result) await wait(time.result);
  }
  async function play(step: MotionStep, time: StepTiming, caption: Caption) {
    if (step.kind === 'combat' || step.kind === 'power') return combat(step, time, caption);
    if (!('from' in step)) return effect(step, time, caption);
    caption();
    // Saved local states can predate structured movement events.
    const t: CueTarget = { anchor: step.from.anchor, label: step.from.card.name, zone: step.from.zone };
    if (step.kind === 'move') {
      t.destination = step.to.zone;
      sound?.play({
        kind:
          t.destination === 'discard'
            ? 'discard'
            : t.destination === 'market'
              ? 'deal'
              : t.destination.startsWith('hand:')
                ? 'draw'
                : 'place',
        element: step.to.card.element,
      });
      if (reduced) {
        ring(destination(t), ink.move);
        await wait(time.travel);
      } else await flight(t, time.travel);
    } else {
      const node = find(t.anchor)?.element;
      sound?.play({ kind: 'rotate', element: step.to.card.element });
      if (node) await animate(node, frames(reduced, 'rotate(8deg)'), time.travel);
    }
  }
  function wisdomValue(t: CueTarget) {
    return next.get(t.anchor)?.element.querySelector<HTMLElement>('[data-motion-wisdom]');
  }
  // Keep the board at the first observed value until the animation reaches each result.
  for (const cue of steps) {
    if (cue.kind === 'move' || cue.kind === 'rotate') continue;
    const score = find(cue.target);
    if (score && !counters.has(score.element)) showValue(score.element, cue.before);
    if (cue.action === 'available' && score && cue.targets?.[0]?.amount) {
      const lights = Array.from(score.element.querySelectorAll<HTMLElement>('[data-action-light]'));
      for (const light of lights.slice(-cue.targets[0].amount)) {
        light.dataset.awaitingEffect = '';
        bonusLights.add(light);
      }
    }
    for (const t of cue.targets ?? []) {
      const wisdom = t.unit === 'Wisdom' ? wisdomValue(t) : undefined;
      if (wisdom && !counters.has(wisdom)) showValue(wisdom, t.before);
      if (t.destination !== 'discard' || !t.zone?.startsWith('slot:') || held.has(t.anchor)) continue;
      const from = old.get(t.anchor);
      if (from?.face) {
        const card = copy(from, from.face);
        card.classList.add('wd-motion-resting');
        held.set(t.anchor, card);
      }
    }
  }
  const finished = (async () => {
    const started = performance.now();
    for (const [index, step] of steps.entries()) {
      const time = stepTiming(step);
      const duration = time.source + time.travel + time.target + time.residual + time.result;
      // Fold the rest into the summary between effects so an impact always gets its reading time.
      if (stopped || performance.now() - started + duration > duelTiming.chainLimit) break;
      const retained = new Set(held.values());
      await play(step, time, (preview, targets) => onCaption?.(index, preview, targets));
      for (const node of nodes) if (!retained.has(node as HTMLElement)) remove(node);
    }
  })().finally(cleanup);
  return { finished, cancel: cleanup };
}
