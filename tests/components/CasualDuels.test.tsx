import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CasualDuels from '../../src/pages/CasualDuels.js';
import DuelInvitation from '../../src/components/competition/DuelInvitation.js';
import { duelAccountPath, duelLobbyPath, playHubRedirectUrl, signedInDuelPath } from '../../src/game/duelInvitation.js';

const code = 'd7f4857e-18de-462e-86c9-c59e37fe5832';
vi.unmock('react-router-dom');
const mock = vi.hoisted(() => ({ auth: vi.fn(), queue: vi.fn(), createCasual: vi.fn(), joinCasual: vi.fn(), openDuels: vi.fn(), publishDuel: vi.fn() }));
vi.mock('../../src/hooks/useAuth.js', () => ({ useAuth: mock.auth }));
vi.mock('../../src/services/competitiveService.js', () => ({ competitive: mock, competitiveError: () => 'Cannot enter.', OPEN_DUELS_PER_PAGE: 12, openDuels: mock.openDuels, publishDuel: mock.publishDuel }));
function Destination() {
  const { pathname, search, hash } = useLocation();
  return <output>{pathname}{search}{hash}</output>;
}
function lobby(path = '/duels') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/duels" element={<CasualDuels />} />
    <Route path="/duels/public" element={<CasualDuels publicLobby />} />
    <Route path="*" element={<Destination />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  mock.auth.mockReturnValue({ user: { id: 'player' }, loading: false });
  mock.queue.mockResolvedValue({ match: null });
  mock.createCasual.mockResolvedValue({ matchId: code });
  mock.joinCasual.mockResolvedValue({ matchId: code });
  mock.openDuels.mockResolvedValue([]);
  mock.publishDuel.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
  localStorage.clear();
});

describe('private duels', () => {
  it('creates a free duel with a signed-in account', async () => {
    lobby();
    await userEvent.click(screen.getByRole('button', {name: 'Create duel'}));
    expect(mock.createCasual).toHaveBeenCalledOnce();
    expect(mock.publishDuel).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('/duel/' + code);
  });
  it('accepts a legacy link pasted into the room field', async () => {
    lobby();
    await userEvent.type(screen.getByRole('textbox'), window.location.origin + '/wagers?mode=casual&join=' + code);
    await userEvent.click(screen.getByRole('button', {name: 'Join duel'}));
    expect(mock.joinCasual).toHaveBeenCalledWith(code);
  });
  it('carries a guest invitation through sign-in and waits for explicit acceptance', async () => {
    mock.auth.mockReturnValue({user: null, loading: false});
    lobby(duelLobbyPath(code));
    await userEvent.click(screen.getByRole('button', {name: 'Sign in to join duel'}));
    expect(await screen.findByRole('status')).toHaveTextContent(duelAccountPath(code));
    expect(mock.joinCasual).not.toHaveBeenCalled();
    window.history.replaceState(null, '', duelAccountPath(code));
    const callback = new URL(playHubRedirectUrl());
    expect(callback.origin).toBe(window.location.origin);
    expect(signedInDuelPath(callback.search)).toBe(duelLobbyPath(code));
  });
  it('offers the existing match after the host returns', async () => {
    mock.queue.mockResolvedValue({match: {matchId: code}});
    lobby();
    expect(await screen.findByRole('link', {name: 'Return to your duel'})).toHaveAttribute('href', '/duel/' + code);
    expect(screen.getByRole('button', {name: 'Create duel'})).toBeDisabled();
  });
  it('copies a public join link that a second player can open', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><DuelInvitation matchId={code}/></MemoryRouter>);
    await user.click(screen.getByRole('button', {name: 'Copy invitation'}));
    expect(await navigator.clipboard.readText()).toBe(window.location.origin + duelLobbyPath(code));
    expect(screen.getByRole('status')).toHaveTextContent('copied');
  });
});

describe('public duels', () => {
  const openRoom = () => ({ match_id: code, expires_at: new Date(Date.now() + 60000).toISOString() });
  it('creates and lists the exact room the host just opened', async () => {
    lobby('/duels/public');
    expect(await screen.findByText(/No public duels are open/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name:'Create public duel'}));
    expect(mock.publishDuel).toHaveBeenCalledWith(code);
    expect(await screen.findByText('/duel/' + code)).toBeVisible();
  });
  it('joins a listed room without requiring its invitation link', async () => {
    mock.openDuels.mockResolvedValue([openRoom()]);
    lobby('/duels/public');
    await userEvent.click(await screen.findByRole('button', {name:'Join Duel D7F4857E'}));
    expect(mock.joinCasual).toHaveBeenCalledWith(code);
    expect(mock.createCasual).not.toHaveBeenCalled();
  });
  it('returns a signed-out visitor to the public room they picked', async () => {
    mock.auth.mockReturnValue({user:null, loading:false});
    mock.openDuels.mockResolvedValue([openRoom()]);
    lobby('/duels/public');
    await userEvent.click(await screen.findByRole('button', {name:'Sign in to join Duel D7F4857E'}));
    expect(await screen.findByText(duelAccountPath(code, true))).toBeVisible();
    expect(signedInDuelPath('?duel=public-' + code)).toBe('/duels/public?join=' + code);
    expect(signedInDuelPath('?duel=public')).toBe('/duels/public');
    expect(mock.joinCasual).not.toHaveBeenCalled();
  });
  it('lets the host retry publication in the existing room', async () => {
    render(<MemoryRouter><DuelInvitation matchId={code} retryListing /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your room was created');
    await userEvent.click(screen.getByRole('button', {name:'List this duel publicly'}));
    expect(mock.publishDuel).toHaveBeenCalledWith(code);
    expect(await screen.findByRole('heading', {name:'Waiting for a public opponent'})).toBeVisible();
    expect(mock.createCasual).not.toHaveBeenCalled();
  });
  it('makes rooms beyond the first page discoverable', async () => {
    const rooms = Array.from({length: 13}, (_, n) => ({
      ...openRoom(), match_id: n.toString(16).padStart(8, '0') + code.slice(8),
    }));
    mock.openDuels.mockImplementation((_id?: string, offset = 0) => Promise.resolve(rooms.slice(offset)));
    lobby('/duels/public');
    await userEvent.click(await screen.findByRole('button', {name:'More rooms'}));
    expect(await screen.findByRole('button', {name:'Join Duel 0000000C'})).toBeVisible();
    expect(mock.openDuels).toHaveBeenCalledWith(undefined, 12);
  });
});
