import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BotGame from '../../src/pages/BotGame.js';
import TrainingSelection from '../../src/pages/TrainingSelection.js';

vi.unmock('react-router-dom');
vi.mock('../../src/analytics/productAnalytics.js', () => ({ track: vi.fn(() => true) }));

function renderFlow(path = '/bot-game?mode=guided') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/bot-game" element={<BotGame />} /><Route path="/bot-selection" element={<TrainingSelection />} /></Routes></MemoryRouter>);
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
function finishIntro() {
  for (let page = 1; page < 6; page++) click('Next');
  click('Start lesson');
}

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('training introduction', () => {
  it('explains the duel before launching the untouched guided match', () => {
    renderFlow();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Bring the bot’s Power to zero.');
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
    const teams = screen.getByRole('figure', { name: 'Both teams and their shared Power' });
    expect(teams).toHaveTextContent('Tarasca, Adaro, Tulpar');
    expect(within(teams).getAllByText('20 Power')).toHaveLength(2);

    click('Next');
    expect(dialog).toHaveAccessibleName('From the Market to your board');
    expect(screen.getByRole('figure', { name: 'Map of the practice arena' })).toHaveTextContent('Market');
    expect(dialog).toHaveTextContent('Each Creature can hold one Knowledge card at a time');

    click('Next');
    expect(dialog).toHaveAccessibleName('Two phases per turn');
    const cycle = screen.getByRole('figure', { name: 'Explore the turn cycle' });
    expect(cycle).toHaveTextContent('Your turn, Knowledge Phase.');
    click('See your actions');
    expect(cycle).toHaveTextContent('Your turn, Action Phase.');
    click('Pass to the bot');
    expect(cycle).toHaveTextContent('Bot’s turn, Knowledge Phase.');
    click('See the bot’s actions');
    expect(cycle).toHaveTextContent('Bot’s turn, Action Phase.');
    click('Return to your turn');
    expect(cycle).toHaveTextContent('Your turn, Knowledge Phase.');
    expect(dialog).toHaveTextContent('two, though card effects can change that number');

    click('Next');
    expect(dialog).toHaveAccessibleName('Choose your actions');
    const actions = screen.getByRole('figure', { name: 'Two actions in the opening turn' });
    expect(actions).toHaveTextContent('Draw Lepidoptera');
    expect(actions).toHaveTextContent('Rotate Tarasca');
    expect(dialog).toHaveTextContent('End Turn');

    click('Next');
    const example = screen.getByRole('figure', { name: 'Try a rotation with the lesson cards' });
    expect(example).toHaveTextContent('Air Ally');
    expect(example).toHaveTextContent('Lepidoptera requires 1 Wisdom. Tarasca has 0.');
    click('Try rotating Tarasca');
    expect(example).toHaveTextContent('Tarasca can now play Lepidoptera and keep its 2 Wisdom.');

    click('Next');
    expect(screen.getByText('6 / 6')).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName('Follow one card across turns');
    const timing = screen.getByRole('figure', { name: 'Lepidoptera across two of your turns' });
    expect(timing).toHaveTextContent('On play, gain 1 Power.');
    expect(timing).toHaveTextContent('Your next Knowledge Phase');
    expect(timing).toHaveTextContent('1 damage to the bot');
    click('Back');
    expect(screen.getByRole('button', { name: 'Reset example' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Guided lesson' })).not.toBeInTheDocument();

    click('Next'); click('Start lesson');
    expect(screen.getByText('2 / 2 actions left')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Power: 20')).toBeInTheDocument();
    expect(screen.getByLabelText('Bot Power: 20')).toBeInTheDocument();
    click('Draw Lepidoptera');
    expect(screen.getByRole('img', { name: 'Tarasca’s Wisdom, from 0 to 2' })).toBeInTheDocument();
  });

  it('shows the card’s destination and the actual creature’s Wisdom change as the player acts', () => {
    renderFlow();
    finishIntro();
    expect(screen.getByRole('img', { name: 'Draw, from Market to Hand' })).toBeInTheDocument();
    click('Draw Lepidoptera');
    expect(screen.getByRole('img', { name: 'Tarasca’s Wisdom, from 0 to 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rotate Tarasca' }).closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });

  it('cannot be dismissed with Escape or a backdrop click', () => {
    renderFlow();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Bring the bot’s Power to zero.');
    fireEvent.mouseDown(document.querySelector('.wd-dialog-backdrop')!);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Bring the bot’s Power to zero.');
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
  });

  it('focuses the first real draw control after the introduction finishes', () => {
    renderFlow();
    finishIntro();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Draw Lepidoptera' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draw Lepidoptera' })).toHaveFocus();
    expect(screen.getByText('Clock paused')).toBeInTheDocument();
  });

  it('pulses the coach frame for about a second after the introduction closes', () => {
    renderFlow();
    finishIntro();
    expect(screen.getByLabelText('Guided lesson')).not.toHaveClass('wd-coach-highlight');
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByLabelText('Guided lesson')).toHaveClass('wd-coach-highlight');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByLabelText('Guided lesson')).not.toHaveClass('wd-coach-highlight');
  });

  it('then hands the glow from the coach to the market card', () => {
    renderFlow();
    finishIntro();
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByLabelText('Guided lesson')).toHaveClass('wd-coach-highlight');
    // 150 ms lead-in + 1300 ms of coach glow + 150 ms gap, then the market card pulses.
    act(() => { vi.advanceTimersByTime(1450); });
    expect(screen.getByLabelText('Guided lesson')).not.toHaveClass('wd-coach-highlight');
    expect(screen.getByRole('button', { name: 'Draw Lepidoptera', exact: true })).toHaveClass('wd-guide-glow');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByRole('button', { name: 'Draw Lepidoptera', exact: true })).not.toHaveClass('wd-guide-glow');
  });

  it('does not show the introduction in a free practice match', () => {
    renderFlow('/bot-selection?mode=free');
    screen.getAllByRole('button', { name: /^Choose / }).slice(0, 3).forEach(button => fireEvent.click(button));
    click('Start Practice');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bring the bot’s Power to zero.' })).not.toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Turn clock' })).toHaveTextContent('0:30');
  });
});
