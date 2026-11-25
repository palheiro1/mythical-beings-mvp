import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TrainingTutorial from '../../src/components/game/TrainingTutorial.js';
import { CardRegistryProvider } from '../../src/context/CardRegistry.js';
import { useCardRegistry } from '../../src/hooks/useCardRegistry.js';

const TutorialTargets = () => {
  const registry = useCardRegistry();
  return (
    <div>
      <div data-testid="market" ref={(element) => registry.register('market:anchor', element)}>Market</div>
      <div data-testid="hand" ref={(element) => registry.register('hand:anchor', element)}>Hand</div>
      <div data-testid="table" ref={(element) => registry.register('table:anchor', element)}>Table</div>
      <div data-testid="action" ref={(element) => registry.register('action:anchor', element)}>Actions</div>
    </div>
  );
};

describe('TrainingTutorial', () => {
  it('guides the player through registered controls and completes explicitly', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CardRegistryProvider>
        <TutorialTargets />
        <TrainingTutorial open onClose={onClose} />
      </CardRegistryProvider>,
    );

    expect(screen.getByRole('dialog', { name: /welcome to your training duel/i })).toBeInTheDocument();
    expect(screen.getByText(/guided training · 1\/5/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByTestId('market')).toHaveAttribute('data-training-highlight', 'true'));

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByTestId('hand')).toHaveAttribute('data-training-highlight', 'true'));

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByTestId('table')).toHaveAttribute('data-training-highlight', 'true'));

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByTestId('action')).toHaveAttribute('data-training-highlight', 'true'));
    await user.click(screen.getByRole('button', { name: /start playing/i }));

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('reports an intentional skip separately from completion', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CardRegistryProvider>
        <TrainingTutorial open onClose={onClose} />
      </CardRegistryProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('can be dismissed with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CardRegistryProvider>
        <TrainingTutorial open onClose={onClose} />
      </CardRegistryProvider>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
