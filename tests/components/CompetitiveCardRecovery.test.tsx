import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CompetitiveMatch from '../../src/pages/CompetitiveMatch.js';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  claim: vi.fn(),
  refresh: vi.fn(),
  config: { chainId: 137 },
}));
vi.mock('@mythicalb/sdk/wisdom-duel-wallet', () => ({
  getWisdomDeferredCards: mocks.read,
  claimWisdomDeferredCard: mocks.claim,
}));
vi.mock('../../src/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'player' }, polygonWallet: { address: '0x1' } }),
}));
vi.mock('../../src/hooks/useCompetitiveMatch.js', () => ({
  useCompetitiveMatch: () => ({
    data: {
      match: {
        matchId: 'match',
        mode: 'wager',
        status: 'finished',
        settlementStatus: 'finalized',
        stakeAtomic: '1',
      },
      projection: null,
      serverNow: new Date().toISOString(),
    },
    refresh: mocks.refresh,
    sending: false,
  }),
}));
vi.mock('../../src/services/competitiveService.js', () => ({
  competitive: {},
  competitiveError: (error: Error) => error.message,
  competitiveWalletConfig: () => mocks.config,
  formatGem: () => '1',
}));
function page() {
  return render(
    <MemoryRouter initialEntries={['/duel/match']}>
      <Routes>
        <Route path="/duel/:matchId" element={<CompetitiveMatch />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
describe('deferred card recovery', () => {
  it('checks credits and submits the chosen destination without treating submission as confirmation', async () => {
    mocks.read.mockResolvedValue([{ cardId: '4', amount: '2' }]);
    mocks.claim.mockResolvedValue('0xsubmitted');
    page();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cartas por receber' }));
    const recipient = await screen.findByLabelText(/Carteira para receber as cartas/);
    fireEvent.change(recipient, { target: { value: '0x0000000000000000000000000000000000000002' } });
    fireEvent.click(screen.getByRole('button', { name: /Levantar uma cópia da carta 4/ }));
    await waitFor(() =>
      expect(mocks.claim).toHaveBeenCalledWith(
        mocks.config,
        '4',
        '0x0000000000000000000000000000000000000002',
      ),
    );
    expect(mocks.read).toHaveBeenCalledWith(mocks.config, 'match');
    expect(await screen.findByText(/Levantamento enviado: 0xsubmitted/)).toBeInTheDocument();
  });
  it('does not offer a withdrawal when no credits remain', async () => {
    mocks.read.mockResolvedValue([]);
    page();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cartas por receber' }));
    expect(await screen.findByText('Não tens cartas pendentes neste duelo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Levantar uma cópia/ })).not.toBeInTheDocument();
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
