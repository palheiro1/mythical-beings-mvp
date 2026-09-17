import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
function botTurn() { for (let i = 0; i < 5; i++) act(() => { vi.advanceTimersByTime(550); }); }
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
    orientation(false, true); const { container } = renderFlow();
    expect(container.querySelector('.wd-empty-slot')).not.toBeInTheDocument();
    expect(container.querySelector('.wd-lane-action,.wd-card-action')).not.toBeInTheDocument();
    click('Start learning');
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
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tulpar');
    click('Skip effect'); click('End Turn'); botTurn(); click('Continue Practice');
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(localStorage.getItem(TUTORIAL_PROGRESS_KEY)).toBe('completed');
  });
  it('retains a mobile selection on an invalid target and lets the same hand card cancel it', () => {
    orientation(false, true); renderFlow(); click('Skip tutorial'); click('Continue Practice');
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
    orientation(false, true); renderFlow(); click('Start learning');
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
    expect(screen.getByRole('heading', { name:'2. Grow your wisdom' })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name:'Your first duel' })).toBeInTheDocument();
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
  });
  it('pauses an active clock in portrait and resumes its remaining seconds without resetting the match', () => {
    const rotate = orientation(); renderFlow(); click('Skip tutorial'); click('Continue Practice');
    click('Draw Lepidoptera');
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByText('25s')).toBeInTheDocument();
    rotate(true); act(() => { vi.advanceTimersByTime(60_000); }); rotate(false);
    expect(screen.getByText('25s')).toBeInTheDocument();
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name:'Select Lepidoptera' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(25_000); });
    expect(screen.getByText('Bot’s turn')).toBeInTheDocument();
  });
  it('suspends scheduled bot moves while rotating and resumes the same turn', () => {
    const rotate = orientation(); renderFlow(); click('Start learning'); click('Draw Lepidoptera'); click('Rotate Tarasca');
    rotate(true); act(() => { vi.advanceTimersByTime(60_000); }); rotate(false);
    expect(screen.getByText('Bot’s turn')).toBeInTheDocument();
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
    botTurn();
    expect(screen.getByRole('heading', { name:'4. Play your knowledge' })).toBeInTheDocument();
    click('Select Lepidoptera'); rotate(true); rotate(false);
    expect(screen.getByRole('button', { name:'Select Lepidoptera' })).toHaveAttribute('aria-pressed', 'true');
    click('Play Lepidoptera on Tarasca');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tulpar');
  });
  it('allows an explicit portrait fallback when the player cannot rotate', () => {
    orientation(true); renderFlow(); click('Can’t rotate? Continue in portrait');
    click('Skip tutorial'); click('Continue Practice');
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText('29s')).toBeInTheDocument();
  });
  it('starts the recommended team without a wallet, with a paused tutorial', () => {
    renderFlow('/bot-selection?mode=guided');
    expect(screen.getByText('3/3 selected')).toBeInTheDocument();
    click('Start Lesson');
    expect(screen.getByRole('heading', { name:'Your first duel' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(screen.getByText('Turn 1')).toBeInTheDocument();
    expect(screen.getByText('Clock paused')).toBeInTheDocument();
    expect(emit.mock.calls.filter(call => call[0] === 'first_action')).toHaveLength(0);
  });
  it('finishes the real lesson, continues with a full clock and automatically ends the free turn', () => {
    renderFlow();
    click('Start learning');
    click('Draw Lepidoptera');
    click('Rotate Tarasca');
    botTurn();
    expect(screen.getByRole('heading', { name:'4. Play your knowledge' })).toBeInTheDocument();
    click('Select Lepidoptera');
    click('Play Lepidoptera on Tarasca');
    const effect = screen.getByRole('dialog');
    fireEvent.click(within(effect).getAllByRole('button')[0]);
    expect(screen.getByRole('heading', { name:'5. Pass the turn' })).toBeInTheDocument();
    click('End Turn');
    botTurn();
    expect(screen.getByRole('heading', { name:'You know the essentials.' })).toBeInTheDocument();
    expect(localStorage.getItem(TUTORIAL_PROGRESS_KEY)).toBe('completed');
    const turn = screen.getByText(/^Turn \d+$/).textContent;
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText(turn!)).toBeInTheDocument();
    click('Continue Practice');
    expect(screen.getByText('30s')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(29_000); });
    expect(screen.getByText('1s')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Bot’s turn')).toBeInTheDocument();
    expect(emit.mock.calls.filter(call => call[0] === 'first_action')).toHaveLength(1);
  });
  it('inspects without consuming an action, closes by Escape and restores focus', () => {
    renderFlow();
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
    renderFlow();
    click('Concede match');
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name:'Concede Match', exact:true }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Match conceded');
    expect(emit.mock.calls.filter(call => call[0] === 'training_complete')).toHaveLength(1);
    click('Play Again');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
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
    expect(screen.getByText('30s')).toBeInTheDocument();
  });
  it('does not call a skipped lesson complete and restarts a full free-practice clock', () => {
    renderFlow(); click('Skip tutorial');
    expect(localStorage.getItem(TUTORIAL_PROGRESS_KEY)).toBe('skipped');
    click('Continue Practice');
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name:'Guided lesson' })).not.toBeInTheDocument();
  });
});
