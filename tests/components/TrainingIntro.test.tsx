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
  click('Next');
  click('Next');
  click('Start lesson');
}

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('training introduction', () => {
  it('shows three illustrated introductions and lets the player revisit the example', () => {
    renderFlow();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Bring the bot’s Power to zero.');
    const team = screen.getByRole('figure', { name: 'Your creatures and their shared Power' });
    expect(team).toHaveTextContent('Tarasca, Adaro, Tulpar');
    expect(team).toHaveTextContent('20Shared team Power');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    click('Next');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('How a turn works');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    const phases = within(screen.getByRole('list', { name: 'Turn order' })).getAllByRole('listitem');
    expect(phases).toHaveLength(2);
    expect(within(phases[0]).getByRole('heading', { name: 'Knowledge Phase' })).toBeInTheDocument();
    expect(phases[0]).toHaveTextContent('the spells on your creatures take effect automatically, then rotate');
    expect(phases[0]).toHaveTextContent('Lepidoptera in play');
    expect(within(phases[1]).getByRole('heading', { name: 'Action Phase' })).toBeInTheDocument();
    expect(phases[1]).toHaveTextContent('two actions unless a card effect changes that number');
    click('Try rotating Tarasca');
    expect(screen.getByText('Tarasca now has 2 Wisdom. Enough to play Lepidoptera!')).toBeInTheDocument();
    click('Next');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Find your first card.');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Map of the practice arena' })).toBeInTheDocument();
    click('Back');
    expect(screen.getByRole('button', { name: 'Reset example' })).toBeInTheDocument();
    click('Back');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Bring the bot’s Power to zero.');
    expect(screen.queryByRole('complementary', { name: 'Guided lesson' })).not.toBeInTheDocument();
    finishIntro();
    expect(screen.getByText('2 / 2 actions left')).toBeInTheDocument();
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

  it('focuses the first real draw control after the third introduction', () => {
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
