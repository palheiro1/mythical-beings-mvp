import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Card from '../../src/components/Card.js';
import { CardRegistryProvider } from '../../src/context/CardRegistry.js';
import { Creature } from '../../src/game/types.js';

const adaro: Creature = {
  id: 'adaro',
  name: 'Adaro',
  element: 'water',
  passiveAbility: 'Draw a card when aquatic knowledge is summoned.',
  image: '/images/beings/adaro.webp',
  wisdomCycle: [0, 1, 4, 5],
};

function renderCard(ui: React.ReactElement) {
  return render(<CardRegistryProvider>{ui}</CardRegistryProvider>);
}

describe('Card', () => {
  it('runs the primary action from the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderCard(<Card card={adaro} onClick={onClick} ariaLabel="Select Adaro" />);

    const button = screen.getByRole('button', { name: 'Select Adaro' });
    button.focus();
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledWith('adaro');
  });

  it('opens accessible card details from the inspect control', async () => {
    const user = userEvent.setup();

    renderCard(<Card card={adaro} />);

    await user.click(screen.getByRole('button', { name: /inspect adaro/i }));

    expect(screen.getByRole('dialog', { name: /adaro/i })).toBeInTheDocument();
    expect(screen.getByText(/draw a card/i)).toBeInTheDocument();
  });

  it('traps focus in card details and returns it to the inspect control', async () => {
    const user = userEvent.setup();

    renderCard(<Card card={adaro} />);

    const inspect = screen.getByRole('button', { name: /inspect adaro/i });
    await user.click(inspect);

    const close = screen.getByRole('button', { name: /close card details/i });
    await waitFor(() => expect(close).toHaveFocus());
    await user.tab();
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(inspect).toHaveFocus());
  });

  it('shows a named fallback when artwork cannot be loaded', () => {
    renderCard(<Card card={{ ...adaro, image: '/missing.webp' }} />);

    fireEvent.error(screen.getByRole('img', { name: 'Adaro' }));

    expect(screen.getByRole('img', { name: /adaro\. artwork unavailable/i })).toBeInTheDocument();
  });

  it('uses the dark card back for hidden cards', () => {
    const { container } = renderCard(<Card card={adaro} showBack isDisabled />);

    expect(screen.getByRole('button', { name: /hidden card/i })).toBeInTheDocument();
    expect(container.querySelector('.card-back-face')).toBeInTheDocument();
    expect(container.querySelector('img[alt="Hidden card"]')).not.toBeInTheDocument();
  });
});
