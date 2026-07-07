import React from 'react';
import { render, screen } from '@testing-library/react';
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
  image: '/images/beings/adaro.jpg',
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
});
