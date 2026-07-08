import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Logs from '../../src/components/game/Logs.js';

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
});
