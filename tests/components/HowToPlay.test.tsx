import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import HowToPlay from '../../src/pages/HowToPlay.js';
import { CardRegistryProvider } from '../../src/context/CardRegistry.js';

const renderPage = () => render(
  <CardRegistryProvider>
    <HowToPlay />
  </CardRegistryProvider>,
);

describe('HowToPlay', () => {
  it('offers a five-step quick start linked to guided training', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /learn one turn, then play/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /five steps to play a turn/i }).children).toHaveLength(5);
    expect(screen.getByRole('link', { name: /start guided training/i })).toHaveAttribute('href', '/bot-selection');
  });

  it('filters the complete compendium by text, card type, and element', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('searchbox', { name: /search the card compendium/i }), 'Lupus');
    expect(screen.getByRole('status')).toHaveTextContent('1 card matches');
    expect(screen.getByRole('button', { name: /Lupus, spell knowledge/i })).toBeInTheDocument();
    expect(screen.getByText(/no creatures match these filters/i)).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: /search the card compendium/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /card type/i }), 'creature');
    await user.selectOptions(screen.getByRole('combobox', { name: /element/i }), 'fire');
    expect(screen.getByRole('status')).toHaveTextContent('3 cards match');
    expect(screen.getByText(/no Knowledge cards match these filters/i)).toBeInTheDocument();
  });
});
