import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import BotGame from '../../src/pages/BotGame.js';
import TrainingSelection from '../../src/pages/TrainingSelection.js';
import { TUTORIAL_PROGRESS_KEY } from '../../src/utils/trainingMode.js';

vi.unmock('react-router-dom');
const emit = vi.hoisted(() => vi.fn(() => true));
vi.mock('../../src/analytics/productAnalytics.js', () => ({ track: emit }));

function renderFlow(path = '/bot-game?mode=guided') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/bot-game" element={<BotGame />} /><Route path="/bot-selection" element={<TrainingSelection />} /></Routes></MemoryRouter>);
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
function botTurn() { for (let i = 0; i < 5; i++) act(() => { vi.advanceTimersByTime(550); }); }

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); emit.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

describe('public practice journey', () => {
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
