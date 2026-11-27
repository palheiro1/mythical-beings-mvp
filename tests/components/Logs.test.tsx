import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Logs from '../../src/components/game/Logs.js';
import { formatGameHistoryEntry } from '../../src/utils/gameHistory.js';

describe('Logs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps log scrolling inside the log panel instead of scrolling the page', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const { rerender } = render(<Logs logs={['Turn 1 started.']} />);

    expect(screen.getByText('Turn 1 started.')).toBeInTheDocument();

    rerender(<Logs logs={['Turn 1 started.', 'Player drew a card.']} />);

    expect(screen.getByText('Player drew a card.')).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('keeps a complete numbered history and presents player names instead of identifiers', () => {
    render(
      <Logs
        logs={[
          '[Turn] Player local-player starts the turn.',
          'Combat: local-player absorbs all damage (raw 0 - defense 2).',
          'bot-player draws a card.',
        ]}
        playerLabels={{ 'local-player': 'You', 'bot-player': 'Training Bot' }}
      />,
    );

    expect(screen.getByRole('list', { name: /complete game history/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('You start the turn.')).toBeInTheDocument();
    expect(screen.getByText(/You absorb all damage \(raw 0 - defense 2\)/)).toBeInTheDocument();
    expect(screen.getByText('Training Bot draws a card.')).toBeInTheDocument();
    expect(screen.queryByText(/local-player|bot-player/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Latest event: Training Bot draws a card.');
  });

  it('reads earlier plays and effect timings in the current vocabulary', () => {
    expect(formatGameHistoryEntry('local-player summoned Lepidoptera onto tarasca.', { 'local-player': 'You' }))
      .toBe('You played Lepidoptera on Tarasca.');
    expect(formatGameHistoryEntry('local-player replaced Blue Sky with Lepidoptera onto tarasca.', { 'local-player': 'You' }))
      .toBe('You played Lepidoptera on Tarasca, replacing Blue Sky.');
    expect(formatGameHistoryEntry('[Apparition] Lepidoptera grants +1 Power.'))
      .toBe('On play · Lepidoptera grants +1 Power.');
    expect(formatGameHistoryEntry('[Final] Galapago grants an action.'))
      .toBe('On final rotation · Galapago grants an action.');
  });

  it('formats tagged entries without altering identifiers inside longer words', () => {
    expect(formatGameHistoryEntry('[Action] bot acts after robot.', { bot: 'Bot' }))
      .toBe('Bot acts after robot.');
    expect(formatGameHistoryEntry(
      'Game bot-1787922923048 initialized. Player 1 starts.',
      { 'local-player': 'You', bot: 'Training Bot' },
    )).toBe('Game initialized. You start.');
  });
});
