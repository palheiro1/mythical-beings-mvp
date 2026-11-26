import { StrictMode, useRef } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrainingMotion } from '../../src/hooks/useTrainingMotion.js';
import { duelTiming as pace } from '../../src/utils/duelMotionPlayer.js';
import { createTrainingSession, HUMAN_ID } from '../../src/game/trainingSession.js';
import type { GameState } from '../../src/game/types.js';
import ActionLights from '../../src/components/game/ActionLights.js';
import { effectScenario, resolveScenario } from '../browser/duelEffectScenarios.js';

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
    <ActionLights owner={HUMAN_ID} remaining={game.actionsPerTurn - game.actionsTakenThisTurn} total={game.actionsPerTurn} />
    {game.players.map(player => <div key={player.id}>
      <strong data-motion-anchor={`power:${player.id}`}>{player.power}</strong>
      {player.creatures.map(card => <div key={card.id} data-motion-anchor={`creature:${player.id}:${card.id}`}>
        {card.name}<strong data-motion-wisdom="">{card.currentWisdom}</strong>
      </div>)}
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
    label: attack.name, element: attack.element, amount: damage, blocked, defenders: [`card:${defense.instanceId}`],
    before: before.players[1].power, after: after.players[1].power }];
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
    after.presentationCues![0].label = 'Earthquake';
    const view = render(<StrictMode><Board game={before} /></StrictMode>);
    const layer = view.getByTestId('layer');
    expect(sound.play).not.toHaveBeenCalled();
    await act(async () => view.rerender(<StrictMode><Board game={after} /></StrictMode>));
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack']);
    const status = view.getByRole('status');
    expect(status).toHaveTextContent(/^Earthquake · 5 damage$/);
    await act(async () => vi.advanceTimersByTimeAsync(pace.source));
    expect(layer.querySelector('.wd-mark-quake')).toBeInTheDocument();
    expect(layer.querySelector('.wd-mark-shield')).toBeNull();
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack']);
    await act(async () => vi.advanceTimersByTimeAsync(pace.travel));
    expect(layer.querySelector('.wd-mark-shield')).toBeInTheDocument();
    expect(status).toHaveTextContent('3 blocked');
    expect(status).not.toHaveTextContent('Power');
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack', 'block']);
    await act(async () => vi.advanceTimersByTimeAsync(pace.target + pace.travel));
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack', 'block', 'damage']);
    expect(status).toHaveTextContent('20 → 18');
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

  it('lights the extra action when the chain reaches the availability event', async () => {
    const { before, after } = hit(1);
    after.actionsPerTurn = 3;
    after.presentationCues!.push({
      kind: 'effect', source: `actions:${HUMAN_ID}`, label: 'Action Phase', element: 'neutral',
      action: 'available', target: `actions:${HUMAN_ID}`, targets: [{ anchor: `actions:${HUMAN_ID}`, label: 'Actions', amount: 1 }],
    });
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    const lights = view.container.querySelectorAll('[data-action-light]');
    expect(lights).toHaveLength(3);
    expect(lights[2]).toHaveAttribute('data-awaiting-effect');
    await act(async () => vi.advanceTimersByTimeAsync(pace.source + pace.travel + pace.result));
    expect(lights[2]).not.toHaveAttribute('data-awaiting-effect');
    expect(view.getByTestId('layer')).toHaveTextContent('+1 action');
    await act(async () => vi.runAllTimersAsync());
  });

  it('keeps audio in reduced motion and cancels a future damage sound on navigation', async () => {
    reduced = true;
    const { before, after } = hit(2, 1);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    await act(async () => vi.runAllTimersAsync());
    expect(sound.play.mock.calls.map(([cue]) => cue.kind)).toEqual(['attack', 'block', 'damage']);
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

  it('holds the shield and the full-block result for separate reading intervals', async () => {
    const { before, after } = hit(0, 3);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    const layer = view.getByTestId('layer');
    expect(layer.querySelector('.wd-motion-result')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(pace.source + pace.travel));
    expect(layer.querySelector('.wd-mark-shield')).toBeInTheDocument();
    expect(layer.querySelector('.wd-motion-result')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(pace.target));
    expect(layer.querySelector('.wd-motion-result')).toHaveTextContent('Blocked 3');
    await act(async () => vi.advanceTimersByTimeAsync(pace.result - 1));
    expect(layer.querySelector('.wd-motion-result')).not.toBeNull();
    expect(view.getByTestId('board')).toHaveAttribute('data-presenting', 'true');
    await act(async () => vi.runAllTimersAsync());
    expect(layer).toBeEmptyDOMElement();
    expect(view.getByTestId('board')).toHaveAttribute('data-presenting', 'false');
  });

  it('intercepts partial damage at the defending card before showing Power lost', async () => {
    const { before, after } = hit(2, 3);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    const power = view.container.querySelector(`[data-motion-anchor="power:${after.players[1].id}"]`);
    expect(power).toHaveAttribute('data-displayed-value', '20');
    await act(async () => vi.advanceTimersByTimeAsync(pace.source));
    const layer = view.getByTestId('layer');
    expect(layer.querySelector('.wd-motion-ring')).toBeInTheDocument();
    expect(layer.querySelector('.wd-motion-result')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(pace.travel + pace.target));
    expect(layer.querySelector('.wd-motion-result')).toBeNull();
    expect(power).toHaveAttribute('data-displayed-value', '20');
    await act(async () => vi.advanceTimersByTimeAsync(pace.travel));
    expect(power).toHaveAttribute('data-displayed-value', '18');
    expect(layer.querySelector('.wd-motion-result')).toHaveTextContent('−2 Power');
    expect(layer.querySelector('.wd-motion-result small')).toHaveTextContent('3 blocked');
    expect(view.getByRole('status')).toHaveTextContent('3 blocked → −2 opponent’s Power');
    act(() => window.dispatchEvent(new Event('resize')));
    expect(power).not.toHaveAttribute('data-displayed-value');
    await act(async () => vi.runAllTimersAsync());
    expect(layer).toBeEmptyDOMElement();
  });

  it('kindles Serpent before it flies and starts Lisovik after the discard', async () => {
    const setup = await effectScenario('Fire');
    const end = resolveScenario('Fire', setup);
    const view = render(<Board game={setup.state} />);
    const layer = view.getByTestId('layer');
    await act(async () => view.rerender(<Board game={{ ...end.state, presentationCues: end.events.at(-1)!.cues }} />));
    const status = view.getByRole('status');
    expect(status).toHaveTextContent(/^Fire · Forced discard$/);
    expect(layer.querySelectorAll('.wd-mark-ember')).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(pace.source));
    expect(layer.querySelectorAll('.wd-mark-ember')).toHaveLength(2);
    expect(status).toHaveTextContent('Serpent');
    expect(status).not.toHaveTextContent('Lisovik');
    await act(async () => vi.advanceTimersByTimeAsync(pace.target - 1));
    expect(layer.querySelector('.wd-motion-flight:not(.wd-motion-resting)')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(layer.querySelector('.wd-motion-flight .wd-carried-ember')).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(pace.travel));
    expect(layer.querySelector('.wd-motion-result')).toHaveTextContent('Serpent');
    expect(status).toHaveTextContent('Serpent → Discards');
    await act(async () => vi.advanceTimersByTimeAsync(pace.result - 1));
    expect(status).not.toHaveTextContent('Lisovik');
    expect(layer.querySelector('.wd-motion-result')).toHaveTextContent('Serpent');
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(layer).toHaveTextContent('Lisovik');
    expect(status).toHaveTextContent('Lisovik');
    expect(status).not.toHaveTextContent('20 → 19');
    expect(document.querySelector('.wd-choice-pointer')).toBeNull();
    await act(async () => vi.runAllTimersAsync());
  });

  it('sweeps one gust across Migration’s two targets and leaves the third Creature still', async () => {
    const setup = await effectScenario('Migration');
    const end = resolveScenario('Migration', setup);
    const view = render(<Board game={setup.state} />);
    await act(async () => view.rerender(<Board game={{ ...end.state, presentationCues: end.events.at(-1)!.cues }} />));
    const wisdom = (id: string) => view.container.querySelector(`[data-motion-anchor="creature:south:${id}"] [data-motion-wisdom]`);
    expect(wisdom('tarasca')).toHaveAttribute('data-displayed-value', '2');
    expect(wisdom('adaro')).toHaveAttribute('data-displayed-value', '4');
    expect(wisdom('lisovik')).not.toHaveAttribute('data-displayed-value');
    await act(async () => vi.advanceTimersByTimeAsync(pace.source));
    const layer = view.getByTestId('layer');
    expect(layer.querySelectorAll('.wd-mark-gust')).toHaveLength(1);
    expect(layer).not.toHaveTextContent('Wisdom 2 → 0');
    expect(view.getByRole('status')).toHaveTextContent('Tarasca, Adaro');
    expect(view.getByRole('status')).not.toHaveTextContent('Wisdom 2 → 0');
    await act(async () => vi.advanceTimersByTimeAsync(pace.travel));
    expect(wisdom('tarasca')).toHaveAttribute('data-displayed-value', '0');
    expect(wisdom('adaro')).toHaveAttribute('data-displayed-value', '1');
    expect(layer).toHaveTextContent('Wisdom 2 → 0');
    expect(layer).toHaveTextContent('Wisdom 4 → 1');
    expect(calls.filter(call => call.frames.some(f => String(f.transform).includes('rotate(')))
      .map(call => call.node.dataset.motionAnchor)).toEqual(['creature:south:tarasca', 'creature:south:adaro']);
    expect(document.querySelector('.wd-choice-pointer')).toBeNull();
    await act(async () => vi.runAllTimersAsync());
  });

  it('names offscreen cards as they act and restores the complete summary on fast-forward', async () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
      return new DOMRect(20, this.dataset.motionAnchor?.startsWith('card:') ? -200 : 20, 80, 100);
    });
    const setup = await effectScenario('Fire');
    const end = resolveScenario('Fire', setup);
    const view = render(<Board game={setup.state} />);
    await act(async () => view.rerender(<Board game={{ ...end.state, presentationCues: end.events.at(-1)!.cues }} />));
    const status = view.getByRole('status');
    expect(status).toHaveTextContent('Fire · your Adaro');
    expect(status).not.toHaveTextContent('Serpent');
    await act(async () => vi.advanceTimersByTimeAsync(pace.source));
    expect(status).toHaveTextContent('Serpent · opposing Tarasca');
    expect(status).not.toHaveTextContent('Lisovik');
    act(() => window.dispatchEvent(new Event('resize')));
    expect(status).toHaveTextContent('Lisovik (Serpent left play)');
    expect(status).toHaveTextContent('20 → 19');
    await act(async () => vi.runAllTimersAsync());
    expect(view.getByTestId('layer')).toBeEmptyDOMElement();
  });

  it('retains the result long enough to read in reduced motion', async () => {
    reduced = true;
    const { before, after } = hit(1, 2);
    const view = render(<Board game={before} />);
    await act(async () => view.rerender(<Board game={after} />));
    await act(async () => vi.advanceTimersByTimeAsync(pace.source + 2 * pace.travel + pace.target + pace.result - 100));
    const layer = view.getByTestId('layer');
    expect(layer.querySelector('.wd-motion-result')).toHaveTextContent('−1 Power');
    expect(layer.querySelector('.wd-motion-result small')).toHaveTextContent('2 blocked');
    expect(calls.every(call => call.frames.every(frame => !frame.transform))).toBe(true);
    await act(async () => vi.runAllTimersAsync());
    expect(layer).toBeEmptyDOMElement();
  });
});

it('finishes each admitted effect before condensing the rest of a long chain', async () => {
  const { before, after } = hit(1);
  after.presentationCues = Array.from({ length: 7 }, (_, i) => ({ ...after.presentationCues![0], label: `Source ${i + 1}` }));
  const view = render(<Board game={before} />);
  await act(async () => view.rerender(<Board game={after} />));
  const duration = pace.source + pace.travel + pace.result;
  await act(async () => vi.advanceTimersByTimeAsync(3 * duration - 1));
  expect(view.getByRole('status')).toHaveTextContent('Source 3');
  expect(view.getByRole('status')).not.toHaveTextContent('Source 4');
  expect(view.getByTestId('layer').querySelector('.wd-motion-result')).toHaveTextContent('−1 Power');
  await act(async () => vi.advanceTimersByTimeAsync(pace.chainLimit - 3 * duration + 1));
  expect(view.getByTestId('board')).toHaveAttribute('data-presenting', 'false');
  expect(sound.play.mock.calls.filter(([cue]) => cue.kind === 'attack')).toHaveLength(3);
  expect(view.getByRole('status')).toHaveTextContent('Source 7');
  expect(view.getByTestId('layer')).toBeEmptyDOMElement();
});
