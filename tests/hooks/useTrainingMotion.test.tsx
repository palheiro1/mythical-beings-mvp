import { StrictMode, useRef } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrainingMotion } from '../../src/hooks/useTrainingMotion.js';
import { createTrainingSession, HUMAN_ID } from '../../src/game/trainingSession.js';
import type { GameState } from '../../src/game/types.js';

const calls: { node: HTMLElement; frames: Keyframe[]; cancel: ReturnType<typeof vi.fn> }[] = [];
let reduced = false;
const sound = { play: vi.fn(), stopEffects: vi.fn() };
function Board({ game, handHidden = false }: { game: GameState; handHidden?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const { announcement, presenting } = useTrainingMotion(game, root, layer, 'stable', false, sound);
  return <div ref={root} data-testid="board" data-presenting={presenting}>
    <div ref={layer} data-testid="layer" aria-hidden="true" inert />
    <p role="status">{announcement}</p>
    <button data-motion-anchor={`hand:${HUMAN_ID}`}>Hand</button>
    <button data-motion-anchor="discard">Discards</button>
    <div data-motion-anchor="market">Market</div>
    {game.players.map(player => <div key={player.id}>
      <strong data-motion-anchor={`power:${player.id}`}>{player.power}</strong>
      {player.field.map(slot => slot.knowledge && <div key={slot.creatureId} className="wd-card-art" data-motion-anchor={`card:${slot.knowledge.instanceId}`}>{slot.knowledge.name}</div>)}
    </div>)}
    {[...game.market, ...handHidden ? [] : game.players[0].hand].map(card =>
      <button key={card.instanceId} data-motion-anchor={`card:${card.instanceId}`} className="wd-card-art">{card.name}</button>)}
  </div>;
}
function deal() {
  const before = createTrainingSession(['tarasca', 'adaro', 'tulpar'], 'guided', 'animation').game;
  const after = structuredClone(before);
  after.players[0].hand.push(after.market.shift()!);
  return { before, after };
}
function hit(damage: number, blocked = 0) {
  const { before } = deal();
  const attack = before.market.shift()!;
  const defense = before.market.shift()!;
  before.players[0].field[0].knowledge = attack;
  before.players[1].field[0].knowledge = defense;
  const after = structuredClone(before);
  after.players[1].power -= damage;
  after.presentationCues = [{ kind: 'combat', source: `card:${attack.instanceId}`, target: `power:${after.players[1].id}`,
    label: attack.name, element: attack.element, amount: damage, blocked, defenders: [`card:${defense.instanceId}`] }];
  return { before, after };
}
beforeEach(() => {
  calls.length = 0; reduced = false;
  sound.play.mockClear(); sound.stopEffects.mockClear();
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    return new DOMRect(this.dataset.motionAnchor?.startsWith('hand:') ? 300 : 20, 20, 80, 100);
  });
  vi.stubGlobal('Animation', class {});
  // A cancellable browser animation: unresolved animations must not survive teardown.
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, writable: true, value: function(this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
    let reject!: (reason?: unknown) => void;
    let timer: ReturnType<typeof setTimeout>;
    const finished = new Promise<void>((resolve, fail) => { reject = fail; timer = setTimeout(resolve, Number(options.duration)); });
    const cancel = vi.fn(() => { clearTimeout(timer); reject(new Error('cancelled')); });
    calls.push({ node: this, frames, cancel });
    return { finished, cancel };
  } });
});
afterEach(() => { delete (HTMLElement.prototype as Partial<HTMLElement>).animate; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('training animation lifecycle', () => {
  it('plays a partial block before damage, at the matching visible impacts', async () => {
    const { before, after } = hit(2, 3);
    const view = render(<StrictMode><Board game={before} /></StrictMode>);
    expect(sound.play).not.toHaveBeenCalled();
    await act(async () => view.rerender(<StrictMode><Board game={after} /></StrictMode>));
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack']);
    await act(async () => vi.advanceTimersByTimeAsync(660));
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack', 'block']);
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack', 'block', 'damage']);
    await act(async () => vi.runAllTimersAsync());
    view.rerender(<StrictMode><Board game={after} /></StrictMode>);
    expect(sound.play).toHaveBeenCalledTimes(3);
  });

  it('never sounds damage for a full defense and cancels sound with the presentation', async () => {
    const { before, after } = hit(0, 4);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    await act(async () => vi.runAllTimersAsync());
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack', 'block']);
    sound.stopEffects.mockClear();
    act(() => window.dispatchEvent(new Event('resize')));
    expect(sound.stopEffects).toHaveBeenCalledTimes(1);
  });

  it('keeps audio in reduced motion and cancels a future damage sound on navigation', async () => {
    reduced = true;
    const { before, after } = hit(2, 1);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    await act(async () => vi.runAllTimersAsync());
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack', 'block', 'damage']);
    expect(sound.play.mock.calls.at(-1)?.[0].delay).toBe(0.15);
    sound.stopEffects.mockClear();
    view.unmount();
    expect(sound.stopEffects).toHaveBeenCalled();
  });

  it('retains semantic sound when browser animations are unavailable', async () => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    const { before, after } = hit(1, 2);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['block', 'damage']);
  });

  it('captures a removed source and flies to a hidden hand tab, then removes all copies', async () => {
    const { before, after } = deal();
    const view = render(<StrictMode><Board game={before} handHidden /></StrictMode>);
    expect(calls).toHaveLength(0);
    await act(async () => view.rerender(<StrictMode><Board game={after} handHidden /></StrictMode>));
    const flight = view.getByTestId('layer').querySelector('.wd-motion-flight');
    expect(flight).toHaveTextContent(before.market[0].name);
    expect(view.getByRole('status')).toHaveTextContent('→ hand');
    await act(async () => vi.runAllTimersAsync());
    expect(view.getByTestId('layer')).toBeEmptyDOMElement();
    const count = calls.length;
    view.rerender(<StrictMode><Board game={after} handHidden /></StrictMode>);
    expect(calls).toHaveLength(count);
  });

  it('cancels current and queued animations on resize and unmount', async () => {
    const { before, after } = deal();
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    const next = structuredClone(after);
    next.discardPile.push(next.players[0].hand.shift()!);
    await act(async () => view.rerender(<Board game={next} />));
    const count = calls.length;
    act(() => window.dispatchEvent(new Event('resize')));
    expect(view.getByTestId('layer')).toBeEmptyDOMElement();
    await act(async () => vi.runAllTimersAsync());
    expect(calls).toHaveLength(count);
    expect(calls.every(call => call.cancel.mock.calls.length > 0)).toBe(true);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps semantic feedback with reduced motion and uses no travelling/rotating transforms', async () => {
    reduced = true;
    const { before, after } = deal();
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    expect(view.getByTestId('layer').querySelector('.wd-motion-flight')).toBeNull();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(call => call.frames.every(frame => !frame.transform))).toBe(true);
    expect(view.getByRole('status')).toHaveTextContent(before.market[0].name);
    await act(async () => vi.runAllTimersAsync());
    expect(view.getByTestId('layer')).toBeEmptyDOMElement();
  });

  it('releases the result dialog after a nonvisual state update during a flight', async () => {
    const { before, after } = deal();
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    expect(view.getByTestId('board')).toHaveAttribute('data-presenting', 'true');
    await act(async () => view.rerender(<Board game={{ ...after, phase: 'gameOver', winner: 'bot' }} />));
    await act(async () => vi.runAllTimersAsync());
    expect(view.getByTestId('board')).toHaveAttribute('data-presenting', 'false');
  });

  it('removes an active flight immediately on unmount without leaving timers', async () => {
    const { before, after } = deal();
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    expect(calls.length).toBeGreaterThan(0);
    view.unmount();
    await act(async () => vi.runAllTimersAsync());
    expect(calls.every(call => call.cancel.mock.calls.length > 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows a fully blocked attack as a shield and readable result without damage feedback', async () => {
    const { before, after } = hit(0, 3);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    const layer = view.getByTestId('layer');
    expect(layer.querySelector('.wd-motion-result')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(660));
    expect(layer.querySelector('.wd-motion-guard')).not.toBeNull();
    expect(layer.querySelector('.is-blocked')).toHaveTextContent('3BlockedNo Power lost');
    expect(layer.querySelector('.is-damage')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(850));
    expect(layer.querySelector('.is-blocked')).not.toBeNull();
    expect(view.getByTestId('board')).toHaveAttribute('data-presenting', 'true');
    await act(async () => vi.runAllTimersAsync());
    expect(layer).toBeEmptyDOMElement();
    expect(view.getByTestId('board')).toHaveAttribute('data-presenting', 'false');
  });

  it('intercepts partial damage at the defending card before showing Power lost', async () => {
    const { before, after } = hit(2, 3);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    await act(async () => vi.advanceTimersByTimeAsync(660));
    const layer = view.getByTestId('layer');
    expect(layer.querySelector('.wd-motion-guard')).not.toBeNull();
    expect(layer.querySelector('.wd-motion-strike')).not.toBeNull();
    expect(layer.querySelector('.wd-motion-result')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(layer.querySelector('.is-damage')).toHaveTextContent('−2Damage5 attack · 3 blocked');
    expect(view.getByRole('status')).toHaveTextContent('3 blocked · 2 damage');
    act(() => window.dispatchEvent(new Event('resize')));
    await act(async () => vi.runAllTimersAsync());
    expect(layer).toBeEmptyDOMElement();
  });

  it('retains combat reading time and shields with reduced motion without a travelling strike', async () => {
    reduced = true;
    const { before, after } = hit(1, 2);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const layer = view.getByTestId('layer');
    expect(layer.querySelector('.is-damage')).toHaveTextContent('−1Damage3 attack · 2 blocked');
    expect(layer.querySelector('.wd-motion-guard')).not.toBeNull();
    expect(layer.querySelector('.wd-motion-strike')).toBeNull();
    expect(calls.every(call => call.frames.every(frame => !frame.transform))).toBe(true);
    await act(async () => vi.runAllTimersAsync());
    expect(layer).toBeEmptyDOMElement();
  });
});
