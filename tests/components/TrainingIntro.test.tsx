import { act, fireEvent, render, screen } from '@testing-library/react';
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

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('training introduction', () => {
  it('walks a guided lesson through three steps before the practice starts', () => {
    renderFlow();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Your goal');
    expect(screen.getByText('Bring the bot’s Power to zero before it brings yours down. Both teams start at 20 Power.')).toBeInTheDocument();
    expect(screen.getByLabelText('Introduction step 1 of 3')).toHaveTextContent('1 / 3');
    expect(screen.queryByRole('complementary', { name: 'Guided lesson' })).not.toBeInTheDocument();
    click('Next');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Key principles');
    expect(screen.getByText('You get two actions per turn: draw Knowledge from the market, rotate a creature to raise its Wisdom, or play Knowledge onto a creature.')).toBeInTheDocument();
    expect(screen.getByLabelText('Introduction step 2 of 3')).toHaveTextContent('2 / 3');
    click('Next');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Getting around');
    expect(screen.getByText('Creatures and Power sit on the board, the market and your hand below it, the coach banner above and the turn clock in the header.')).toBeInTheDocument();
    expect(screen.getByLabelText('Introduction step 3 of 3')).toHaveTextContent('3 / 3');
    expect(screen.getByRole('button', { name: 'Ok, let’s start the practice' })).toBeInTheDocument();
  });

  it('announces each step body politely as it changes', () => {
    renderFlow();
    const body = screen.getByText(/Bring the bot’s Power to zero/).parentElement!;
    expect(body).toHaveAttribute('aria-live', 'polite');
    expect(body).toHaveTextContent('Your goal');
    click('Next');
    expect(screen.getByText(/You get two actions per turn/).parentElement).toBe(body);
    expect(body).toHaveTextContent('Key principles');
  });

  it('cannot be dismissed with Escape or a backdrop click', () => {
    renderFlow();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Your goal');
    fireEvent.mouseDown(document.querySelector('.wd-dialog-backdrop')!);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Your goal');
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
  });

  it('closes on the last step and reveals the first guided lesson step', () => {
    renderFlow();
    click('Next');
    click('Next');
    click('Ok, let’s start the practice');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Gather knowledge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Gather knowledge' })).toHaveFocus();
    expect(screen.getByText('Clock paused')).toBeInTheDocument();
  });

  it('pulses the coach frame for about a second after the introduction closes', () => {
    renderFlow();
    click('Next');
    click('Next');
    click('Ok, let’s start the practice');
    expect(screen.getByLabelText('Guided lesson')).not.toHaveClass('wd-coach-highlight');
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByLabelText('Guided lesson')).toHaveClass('wd-coach-highlight');
    act(() => { vi.advanceTimersByTime(1200); });
    expect(screen.getByLabelText('Guided lesson')).not.toHaveClass('wd-coach-highlight');
  });

  it('does not show the introduction in a free practice match', () => {
    renderFlow('/bot-selection?mode=free');
    screen.getAllByRole('button', { name: /^Choose / }).slice(0, 3).forEach(button => fireEvent.click(button));
    click('Start Practice');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your goal' })).not.toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Turn clock' })).toHaveTextContent('0:30');
  });
});
