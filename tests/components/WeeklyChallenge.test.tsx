import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import WeeklyChallenge from '../../src/pages/WeeklyChallenge.js';

const { loadStandings, queue } = vi.hoisted(() => ({ loadStandings: vi.fn(), queue: vi.fn() }));
vi.mock('../../src/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'account-a', isGuest: false }, loading: false }),
}));
vi.mock('../../src/services/competitiveService.js', async (loadOriginal) => ({
  ...await loadOriginal<typeof import('../../src/services/competitiveService.js')>(),
  challengeStandings: loadStandings,
  competitive: { queue },
}));

it('shows English queue, standings and replay controls for a signed-in player', async () => {
  const now = Date.now();
  const stamp = (delta: number) => new Date(now + delta).toISOString();
  loadStandings.mockResolvedValue({
    periods: [{ id: 'edition', name: 'Opening week', startsAt: stamp(-60000), endsAt: stamp(3600000),
      queueClosesAt: stamp(2100000), admissionOpen: true }],
    periodId: 'edition',
    standings: [
      { position: 1, playerName: 'Jogador Azul', rating: '1516.5', games: 1, isMe: false },
      { position: 2, playerName: 'Player B', rating: '1483.5', games: 1, isMe: true },
    ],
    myResults: [{ matchId: 'duel', finishedAt: stamp(-30000), outcome: 'loss', ranked: true }],
  });
  queue.mockResolvedValue({ ticket: null, match: null, cooldownUntil: null });
  render(<MemoryRouter><WeeklyChallenge /></MemoryRouter>);

  expect(await screen.findByRole('button', { name: 'Find an opponent' })).toBeEnabled();
  expect(screen.getByRole('combobox', { name: 'Edition' })).toHaveValue('edition');
  const table = screen.getByRole('table', { name: 'Standings for Opening week' });
  expect(within(table).getByRole('rowheader', { name: 'Jogador Azul' })).toBeVisible();
  expect(within(table).getByRole('cell', { name: '1,516.5' })).toBeVisible();
  expect(within(table).getByRole('rowheader', { name: 'You' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Your recent duels' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'View replay' })).toHaveAttribute('href', '/replay/duel');
});
