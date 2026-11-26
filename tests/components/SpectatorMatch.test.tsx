import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LiveDuels from '../../src/pages/LiveDuels.js';
import SpectatorMatch from '../../src/pages/SpectatorMatch.js';
import type { WatchedDuel } from '../../src/services/spectatorService.js';

vi.unmock('react-router-dom');
const service = vi.hoisted(() => ({
  list: vi.fn(), read: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock('../../src/services/spectatorService.js', () => ({
  LIVE_PAGE_SIZE: 12, duelKindNames: { casual: 'Casual duel' },
  listLiveDuels: service.list, readWatchedDuel: service.read, subscribeToSpectators: service.subscribe,
}));

const id = '00000000-0000-4000-8000-000000000001';
const now = '2026-11-26T12:00:00Z';
const frame: WatchedDuel = {
  matchId: id, kind: 'casual', version: 1, status: 'playing', turn: 1, currentSeat: 0,
  choosing: false, phase: 'action', actionsLeft: 2, actionsPerTurn: 2, serverNow: now,
  clock: { remainingMs: [600000, 600000], runningSeat: 0, updatedAt: now },
  players: ['adaro', 'tulpar'].map((card, index) => ({
    power: 20, handCount: index + 1, creatures: [{ id: card, rotation: 0, wisdom: 2 }],
    field: [{ creatureId: card, knowledge: null }],
  })) as WatchedDuel['players'],
  market: [], discard: [], deckCount: 12, outcome: null,
  events: [{ sequence: 0, seat: null, kind: 'initialize', creatureId: null }],
};

function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/watch" element={<LiveDuels/>} />
    <Route path="/watch/:matchId" element={<SpectatorMatch/>} />
  </Routes></MemoryRouter>);
}

describe('watching a duel', () => {
  let notify: () => void;
  beforeEach(() => {
    vi.resetAllMocks();
    service.subscribe.mockImplementation((_topic, callback) => {
      notify = callback;
      return service.unsubscribe;
    });
  });

  it('opens a listed duel as a guest and follows public plays through to the result', async () => {
    service.list.mockResolvedValue([{ match_id: id, kind: 'casual', turn_number: 1, paused: false }]);
    service.read.mockResolvedValue(frame);
    open('/watch');
    fireEvent.click(await screen.findByRole('link', { name: /Watch duel / }));
    expect(await screen.findByText('Player 1’s turn')).toBeInTheDocument();
    expect(document.querySelector('.wd-kai .wd-motion-layer')).toBeInTheDocument();
    expect(service.subscribe).toHaveBeenCalledWith('wisdom-watch:' + id, expect.any(Function));
    expect(screen.getByText('1 in hand')).toBeInTheDocument();
    expect(screen.getByText('2 in hand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect Adaro' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /rotate|end turn|concede/i })).toBeNull();

    service.read.mockResolvedValue({ ...frame, version: 2, currentSeat: 1, turn: 2,
      events: [{ sequence: 2, seat: 0, kind: 'end_turn', creatureId: null }] });
    act(() => notify());
    expect(await screen.findByText('Player 2’s turn')).toBeInTheDocument();
    expect(screen.getByText('Player 1 ended the turn.')).toBeInTheDocument();
    service.read.mockResolvedValue({ ...frame, version: 3, status: 'finished',
      clock: { ...frame.clock, runningSeat: null }, outcome: { winner: 0, reason: 'resign' } });
    act(() => notify());
    expect(await screen.findByRole('dialog', { name: 'Player 1 wins' })).toBeInTheDocument();
  });

  it('keeps a duel in preparation hidden and reopens the board once it starts', async () => {
    service.read.mockResolvedValueOnce(null).mockResolvedValue(frame);
    open('/watch/' + id);
    expect(await screen.findByText(/has not started yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inspect/ })).toBeNull();
    act(() => notify());
    await waitFor(() => expect(screen.getByText('Player 1’s turn')).toBeInTheDocument());
  });
});
