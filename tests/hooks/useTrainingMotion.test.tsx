import { StrictMode, useRef } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrainingMotion } from '../../src/hooks/useTrainingMotion.js';
import { createTrainingSession, HUMAN_ID } from '../../src/game/trainingSession.js';
import type { GameState } from '../../src/game/types.js';

const calls: { node: HTMLElement; frames: Keyframe[]; cancel: ReturnType<typeof vi.fn> }[] = [];
let reduced = false;
function Board({ game, handHidden = false }: { game: GameState; handHidden?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const { announcement, presenting } = useTrainingMotion(game, root, layer, 'stable', false);
  return <div ref={root} data-testid="board" data-presenting={presenting}>
    <div ref={layer} data-testid="layer" aria-hidden="true" inert />
    <p role="status">{announcement}</p>
    <button data-motion-anchor={`hand:${HUMAN_ID}`}>Hand</button>
    <button data-motion-anchor="discard">Discards</button>
    <div data-motion-anchor="market">Market</div>
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
beforeEach(() => {
  calls.length = 0; reduced = false;
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
});
