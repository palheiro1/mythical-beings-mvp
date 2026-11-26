import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import BotGame from '../../src/pages/BotGame.js';
import TrainingSelection from '../../src/pages/TrainingSelection.js';
import { TUTORIAL_PROGRESS_KEY } from '../../src/utils/trainingMode.js';
import { DIRECT_CARDS_QUERY } from '../../src/hooks/useDirectCards.js';

vi.unmock('react-router-dom');
const emit = vi.hoisted(() => vi.fn(() => true));
vi.mock('../../src/analytics/productAnalytics.js', () => ({ track: emit }));

function renderFlow(path = '/bot-game?mode=guided') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/bot-game" element={<BotGame />} /><Route path="/bot-selection" element={<TrainingSelection />} /></Routes></MemoryRouter>);
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
function finishIntro() {
  click('Next');
  click('Next');
  click('Start lesson');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
}
function botTurn() { for (let i = 0; i < 5; i++) act(() => { vi.advanceTimersByTime(550); }); }
/** Advance fake timers in small steps until the bot's turn lands on the next guided step. */
function advanceUntil(predicate: () => boolean, step = 100) {
  for (let elapsed = 0; elapsed < 8000; elapsed += step) {
    if (predicate()) return;
    act(() => { vi.advanceTimersByTime(step); });
  }
  if (!predicate()) throw new Error('Timed out waiting for the next guided step.');
}
function orientation(initial = false, direct = false) {
  let portrait = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({ get matches() { return query === DIRECT_CARDS_QUERY ? direct || portrait : portrait; },
    addEventListener: (_: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_: string, callback: () => void) => listeners.delete(callback),
  }));
  return (value: boolean) => act(() => { portrait = value; listeners.forEach(callback => callback()); });
}

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); emit.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('public practice journey', () => {
  it('completes the mobile lesson through card faces, keeping inspection separate', () => {
    orientation(false, true); const { container } = renderFlow(); finishIntro();
    expect(container.querySelector('.wd-empty-slot')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.wd-lane-action,.wd-card-action')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name:'Draw Lepidoptera' })).toBeInTheDocument();
    const inspect = screen.getByRole('button', { name:'Inspect Lepidoptera', exact:true });
    inspect.focus(); fireEvent.click(inspect);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Lepidoptera');
    expect(screen.getByText('2 / 2 actions left')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(16); });
    fireEvent.keyDown(window, { key:'Escape' });
    act(() => { vi.advanceTimersByTime(16); });
    expect(inspect).toHaveFocus();
    const draw = screen.getByRole('button', { name:'Draw Lepidoptera', exact:true });
    expect(draw).toHaveClass('wd-card-art');
    fireEvent.click(within(draw).getByRole('img', { name:'Lepidoptera' }));
    const rotate = screen.getByRole('button', { name:'Rotate Tarasca', exact:true });
    expect(rotate).toHaveClass('wd-card-art');
    fireEvent.click(within(rotate).getByRole('img', { name:'Tarasca' }));
    botTurn();
    click('Select Lepidoptera');
    const play = screen.getByRole('button', { name:'Play Lepidoptera on Tarasca', exact:true });
    expect(play).toHaveClass('wd-card-art', 'is-highlighted');
    fireEvent.click(within(play).getByRole('img', { name:'Tarasca' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tulpar · Choose a target/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your Power: 21')).toBeInTheDocument();
    click('End Turn'); botTurn();
    expect(screen.getByRole('img', { name: 'Bot Power, from 20 to 19' })).toBeInTheDocument();
    expect(screen.getByLabelText('Guided lesson')).toHaveTextContent('In your Knowledge Phase, Lepidoptera dealt 1 damage and rotated.');
    click('See Tulpar’s bonus'); click('Continue Practice');
    expect(screen.getByText('0:30')).toBeInTheDocument();
    expect(localStorage.getItem(TUTORIAL_PROGRESS_KEY)).toBe('completed');
  });
  it('pulses each guided step’s target in order', () => {
    renderFlow(); finishIntro();
    // Draw Lepidoptera: the coach banner speaks first, then the market card it points at.
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByLabelText('Guided lesson')).toHaveClass('wd-coach-highlight');
    act(() => { vi.advanceTimersByTime(1450); });
    expect(screen.getByLabelText('Guided lesson')).not.toHaveClass('wd-coach-highlight');
    expect(screen.getByRole('button', { name: 'Draw Lepidoptera', exact: true })).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByRole('button', { name: 'Draw Lepidoptera', exact: true })).not.toHaveClass('wd-guide-glow');
    click('Draw Lepidoptera');
    // Rotate Tarasca: the rotate control.
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByRole('button', { name: 'Rotate Tarasca', exact: true })).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByRole('button', { name: 'Rotate Tarasca', exact: true })).not.toHaveClass('wd-guide-glow');
    click('Rotate Tarasca');
    // Select Lepidoptera: the hand card first, then Tarasca's "Play here".
    advanceUntil(() => !!screen.queryByRole('heading', { name: 'Select Lepidoptera' }));
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByRole('button', { name: 'Select Lepidoptera', exact: true })).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByRole('button', { name: 'Select Lepidoptera', exact: true })).not.toHaveClass('wd-guide-glow');
    click('Select Lepidoptera');
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByRole('button', { name: 'Play Lepidoptera on Tarasca', exact: true })).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByRole('button', { name: 'Play Lepidoptera on Tarasca', exact: true })).not.toHaveClass('wd-guide-glow');
    click('Play Lepidoptera on Tarasca');
    // End your turn: End Turn.
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByRole('button', { name: 'End Turn', exact: true })).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByRole('button', { name: 'End Turn', exact: true })).not.toHaveClass('wd-guide-glow');
    click('End Turn');
    // 6. Lepidoptera strikes: "See Tulpar's bonus", then "Continue Practice".
    advanceUntil(() => !!screen.queryByRole('button', { name: 'See Tulpar’s bonus' }));
    act(() => { vi.advanceTimersByTime(150); });
    const bonus = screen.getByRole('button', { name: 'See Tulpar’s bonus', exact: true });
    expect(bonus).toHaveAttribute('data-guide-target', 'bonus');
    expect(bonus).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(bonus).not.toHaveClass('wd-guide-glow');
    click('See Tulpar’s bonus');
    act(() => { vi.advanceTimersByTime(150); });
    const cont = screen.getByRole('button', { name: 'Continue Practice', exact: true });
    expect(cont).toHaveAttribute('data-guide-target', 'continue');
    expect(cont).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(cont).not.toHaveClass('wd-guide-glow');
    click('Continue Practice');
    act(() => { vi.advanceTimersByTime(1450); });
    expect(document.querySelector('.wd-guide-glow')).not.toBeInTheDocument();
  }, 20_000);
  it('retains a mobile selection on an invalid target and lets the same hand card cancel it', () => {
    orientation(false, true); renderFlow(); finishIntro(); click('Skip tutorial'); click('Continue Practice');
    click('Draw Lepidoptera'); click('Select Lepidoptera');
    click('Play Lepidoptera on Tarasca');
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name:'Select Lepidoptera' })).toHaveAttribute('aria-pressed','true');
    expect(screen.getByText('1 / 2 actions left')).toBeInTheDocument();
    click('Select Lepidoptera');
    expect(screen.getByRole('button', { name:'Select Lepidoptera' })).toHaveAttribute('aria-pressed','false');
    expect(screen.getByRole('button', { name:'Rotate Tarasca' })).toHaveClass('wd-card-art');
  });
  it('supports keyboard activation of direct cards without changing inspection into a move', async () => {
    vi.useRealTimers();
    orientation(false, true); renderFlow(); finishIntro();
    const user = userEvent.setup();
    const inspect = screen.getByRole('button', { name:'Inspect Tarasca', exact:true });
    inspect.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tarasca');
    await waitFor(() => expect(screen.getByRole('button', { name:'Close card details' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(inspect).toHaveFocus());
    expect(screen.getByText('2 / 2 actions left')).toBeInTheDocument();
    screen.getByRole('button', { name:'Draw Lepidoptera', exact:true }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('heading', { name:'Rotate Tarasca' })).toBeInTheDocument();
    screen.getByRole('button', { name:'Rotate Tarasca', exact:true }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Bot’s turn')).toBeInTheDocument();
  });
  it('waits for landscape on a phone and keeps the prepared lesson intact', () => {
    const rotate = orientation(true); renderFlow();
    expect(screen.getByRole('heading', { name:'Turn your phone to play.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name:'Start learning' })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(90_000); });
    rotate(false);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Bring the bot’s Power to zero.');
    finishIntro();
    expect(screen.getByRole('heading', { name:'Draw Lepidoptera' })).toBeInTheDocument();
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
  });
  it('keeps the current introduction and example rotation across a portrait round-trip', () => {
    const rotate = orientation(); renderFlow();
    click('Next'); click('Try rotating Tarasca');
    rotate(true);
    expect(screen.getByRole('heading', { name:'Turn your phone to play.' })).toBeInTheDocument();
    rotate(false);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('How a turn works');
    expect(screen.getByRole('button', { name:'Reset example' })).toBeInTheDocument();
    click('Next'); click('Start lesson');
    expect(screen.getByRole('heading', { name:'Draw Lepidoptera' })).toBeInTheDocument();
  });
  it('pauses an active clock in portrait and resumes its remaining seconds without resetting the match', () => {
    const rotate = orientation(); renderFlow(); finishIntro(); click('Skip tutorial'); click('Continue Practice');
    click('Draw Lepidoptera');
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByText('0:25')).toBeInTheDocument();
    rotate(true); act(() => { vi.advanceTimersByTime(60_000); }); rotate(false);
    expect(screen.getByText('0:25')).toBeInTheDocument();
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name:'Select Lepidoptera' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(25_000); });
    expect(screen.getByText('Bot’s turn')).toBeInTheDocument();
  });
  it('opens Rules in the match and resumes with the same turn, cards and clock', () => {
    renderFlow(); finishIntro(); click('Skip tutorial'); click('Continue Practice');
    click('Draw Lepidoptera');
    act(() => { vi.advanceTimersByTime(5_750); });
    expect(screen.getByText('0:25')).toBeInTheDocument();
    click('Rules');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Duel rules');
    act(() => { vi.advanceTimersByTime(60_000); });
    click('Resume duel');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('0:25')).toBeInTheDocument();
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Lepidoptera' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('0:24')).toBeInTheDocument();
  });
  it('keeps a third-turn selection and stops the bot when using browser Back and Forward around Rules', async () => {
    const router = createMemoryRouter([{ path: '/bot-game', element: <BotGame /> }], { initialEntries: ['/bot-game?mode=guided'] });
    render(<RouterProvider router={router} />);
    finishIntro(); click('Skip tutorial'); click('Continue Practice'); click('Draw Lepidoptera'); click('End Turn');
    act(() => { vi.advanceTimersByTime(550); });
    click('Rules'); botTurn();
    expect(screen.getByText('Turn 1 · Duel paused')).toBeInTheDocument();
    await act(() => router.navigate(-1));
    expect(screen.getByText('Bot’s turn')).toBeInTheDocument();
    botTurn(); click('End Turn'); botTurn(); click('Select Lepidoptera');
    expect(screen.getByText('Turn 3')).toBeInTheDocument();
    const clock = screen.getByRole('timer').textContent;
    const power = screen.getByLabelText(/^Bot Power:/);
    click('Rules');
    act(() => { vi.advanceTimersByTime(60_000); });
    await act(() => router.navigate(-1));
    expect(screen.getByText('Turn 3')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(clock!);
    expect(screen.getByRole('button', { name: 'Select Lepidoptera' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/^Bot Power:/)).toBe(power);
    expect(screen.getByText('2 / 2 actions left')).toBeInTheDocument();
    await act(() => router.navigate(1));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Duel rules');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Turn 3')).toBeInTheDocument();
    expect(emit.mock.calls.filter(call => call[0] === 'training_start')).toHaveLength(1);
  });
  it('suspends scheduled bot moves while rotating and resumes the same turn', () => {
    const rotate = orientation(); renderFlow(); finishIntro(); click('Draw Lepidoptera'); click('Rotate Tarasca');
    rotate(true); act(() => { vi.advanceTimersByTime(60_000); }); rotate(false);
    expect(screen.getByText('Bot’s turn')).toBeInTheDocument();
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
    botTurn();
    expect(screen.getByRole('heading', { name:'Select Lepidoptera' })).toBeInTheDocument();
    click('Select Lepidoptera'); rotate(true); rotate(false);
    expect(screen.getByRole('button', { name:'Select Lepidoptera' })).toHaveAttribute('aria-pressed', 'true');
    click('Play Lepidoptera on Tarasca');
    expect(screen.getByRole('heading', { name:'End your turn' })).toBeInTheDocument();
  });
  it('allows an explicit portrait fallback when the player cannot rotate', () => {
    orientation(true); renderFlow(); click('Can’t rotate? Continue in portrait');
    finishIntro(); click('Skip tutorial'); click('Continue Practice');
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText('0:29')).toBeInTheDocument();
  });
  it('starts the recommended team without a wallet, with a paused tutorial', () => {
    renderFlow('/bot-selection?mode=guided');
    expect(screen.getByText('3/3 selected')).toBeInTheDocument();
    click('Start Lesson');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Bring the bot’s Power to zero.');
    finishIntro();
    expect(screen.getByRole('heading', { name:'Draw Lepidoptera' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
    expect(screen.getByText('Clock paused')).toBeInTheDocument();
    expect(emit.mock.calls.filter(call => call[0] === 'first_action')).toHaveLength(0);
  });
  it('finishes the real lesson, continues with a full clock and automatically ends the free turn', () => {
    const { container } = renderFlow(); finishIntro();
    click('Draw Lepidoptera');
    click('Rotate Tarasca');
    botTurn();
    expect(screen.getByRole('heading', { name:'Select Lepidoptera' })).toBeInTheDocument();
    click('Select Lepidoptera');
    click('Play Lepidoptera on Tarasca');
    expect(screen.getByLabelText('Bot Power: 20')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Power: 21')).toBeInTheDocument();
    expect(screen.getByText(/End Turn to skip Tulpar’s optional rotation/)).toBeInTheDocument();
    click('End Turn');
    botTurn();
    expect(screen.getByRole('img', { name: 'Bot Power, from 20 to 19' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bot Power: 19')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Turn 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name:'End Turn' })).toBeDisabled();
    click('See Tulpar’s bonus');
    expect(screen.getByRole('heading', { name:'Tulpar’s bonus' })).toBeInTheDocument();
    expect(localStorage.getItem(TUTORIAL_PROGRESS_KEY)).toBe('completed');
    const turn = screen.getByText(/^Turn \d+$/).textContent;
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText(turn!)).toBeInTheDocument();
    click('Continue Practice');
    expect(screen.getByText('0:30')).toBeInTheDocument();
    const playerCallout = screen.getByText('Your turn');
    const header = container.querySelector('.wd-match-header')!;
    expect(header).not.toHaveAttribute('data-clock-warning');
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByText('0:10')).toBeInTheDocument();
    expect(header).toHaveAttribute('data-clock-warning', 'amber');
    const amber = header.querySelector('.wd-clock-flare');
    click('Rules');
    act(() => { vi.advanceTimersByTime(20_000); });
    click('Resume duel');
    expect(header.querySelector('.wd-clock-flare')).toBe(amber);
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByText('0:05')).toBeInTheDocument();
    expect(header).toHaveAttribute('data-clock-warning', 'red');
    const red = header.querySelector('.wd-clock-flare');
    expect(red).not.toBe(amber);
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(screen.getByText('0:01')).toBeInTheDocument();
    expect(header.querySelector('.wd-clock-flare')).toBe(red);
    expect(screen.getByText('Your turn')).toBe(playerCallout);
    expect(screen.getByRole('timer', { name: 'Turn clock' })).toHaveClass('wd-clock-low');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Bot’s turn')).toHaveClass('wd-turn-callout');
    expect(playerCallout).not.toBeInTheDocument();
    expect(header).not.toHaveAttribute('data-clock-warning');
    expect(emit.mock.calls.filter(call => call[0] === 'first_action')).toHaveLength(1);
  });
  it('resumes the same warning and time after a free-practice card effect', () => {
    const { container } = renderFlow(); finishIntro();
    click('Skip tutorial'); click('Continue Practice');
    click('Draw Lepidoptera'); click('Rotate Tarasca'); botTurn();
    click('Select Lepidoptera');
    act(() => { vi.advanceTimersByTime(20_000); });
    const timer = screen.getByRole('timer', { name: 'Turn clock' });
    const timeBeforeEffect = timer.textContent;
    expect(timer.closest('header')).toHaveAttribute('data-clock-warning', 'amber');
    const flare = container.querySelector('.wd-clock-flare');
    expect(flare).toBeInTheDocument();
    click('Play Lepidoptera on Tarasca');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tulpar');
    const choices = within(screen.getByRole('dialog')).getAllByRole('button').map(choice => choice.textContent);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rules' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Duel rules');
    act(() => { vi.advanceTimersByTime(30_000); }); click('Resume duel');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tulpar');
    expect(within(screen.getByRole('dialog')).getAllByRole('button').map(choice => choice.textContent)).toEqual(choices);
    expect(screen.getByText('Clock paused')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(30_000); });
    click('Skip effect');
    expect(timer.textContent).toBe(timeBeforeEffect);
    expect(container.querySelector('.wd-clock-flare')).toBe(flare);
  });
  it('inspects without consuming an action, closes by Escape and restores focus', () => {
    renderFlow(); finishIntro();
    const card = screen.getByRole('button', { name:'Inspect Tarasca', exact:true });
    card.focus(); fireEvent.click(card);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tarasca');
    expect(screen.getByText('Wisdom 0')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(16); });
    fireEvent.keyDown(window, { key:'Escape' });
    act(() => { vi.advanceTimersByTime(16); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(card).toHaveFocus();
    expect(emit.mock.calls.filter(call => call[0] === 'first_action')).toHaveLength(0);
  });
  it('shows a terminal result, replays with the same team, and tracks each completed run once', () => {
    renderFlow(); finishIntro();
    click('Concede match');
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name:'Concede Match', exact:true }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Match conceded');
    expect(emit.mock.calls.filter(call => call[0] === 'training_complete')).toHaveLength(1);
    click('Play Again');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('0:30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name:'Rotate Tarasca' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(emit.mock.calls.filter(call => call[0] === 'training_start')).toHaveLength(2);
    expect(emit.mock.calls.filter(call => call[0] === 'training_complete')).toHaveLength(1);
  });
  it('recovers a direct free-practice link without a stored team', () => {
    renderFlow('/bot-game?mode=free');
    expect(screen.getByRole('heading', { name:'Three creatures. Your strategy.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name:'Start Practice' })).toBeDisabled();
    const choices = screen.getAllByRole('button', { name:/^Choose / });
    choices.slice(0,3).forEach(button => fireEvent.click(button));
    expect(screen.getByRole('button', { name:'Start Practice' })).toBeEnabled();
    click('Start Practice');
    expect(screen.getByText('0:30')).toBeInTheDocument();
  });
  it('does not call a skipped lesson complete and restarts a full free-practice clock', () => {
    renderFlow(); finishIntro(); click('Skip tutorial');
    expect(localStorage.getItem(TUTORIAL_PROGRESS_KEY)).toBe('skipped');
    click('Continue Practice');
    expect(screen.getByText('0:30')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name:'Guided lesson' })).not.toBeInTheDocument();
  });
});
