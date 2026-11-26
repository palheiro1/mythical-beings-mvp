import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInvitationCall } from '../../src/calls/useInvitationCall.js';
import DuelCallControls from '../../src/components/competition/DuelCallControls.js';

const mock = vi.hoisted(() => ({ change: vi.fn(), start: vi.fn(), close: vi.fn(), choose: vi.fn(), created: vi.fn() }));
vi.mock('../../src/services/invitationCall.js', () => ({ changeCall: mock.change }));
vi.mock('../../src/calls/DuelPeer.js', () => ({
  devicesOff: () => ({ video: false, audio: false }),
  DuelPeer: class {
    constructor(...args: unknown[]) { mock.created(...args); }
    start = mock.start;
    close = mock.close;
    setDevice = mock.choose;
  },
}));

let mutual = false;
let mine = false;
let epoch = 'original';
const exposed = () => ({ epoch, mine, peer: mutual, otherTab: false, seat: 1 });
function Pilot({ id = 'match' }: { id?: string | null }) {
  const call = useInvitationCall(id, 'player');
  return <>{call && <DuelCallControls {...call} />}<button>Draw a card</button></>;
}
beforeEach(() => {
  vi.stubGlobal('RTCPeerConnection', class {});
  mine = mutual = false;
  epoch = 'original';
  mock.change.mockImplementation(async (_id, _client, action) => {
    if (action === 'accept') mine = true;
    if (action === 'leave' || action === 'decline') { epoch = 'new'; mine = mutual = false; }
    return exposed();
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('waits for both acceptances, carries independent choices into the call, and stops on leave', async () => {
  render(<Pilot />);
  fireEvent.click(await screen.findByRole('button', { name: 'Voice & video' }));
  expect(screen.getByLabelText('Camera')).not.toBeChecked();
  expect(screen.getByLabelText('Microphone')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Camera'));
  fireEvent.click(screen.getByRole('button', { name: 'Invite to call' }));
  await screen.findByText('Waiting for your opponent to accept.');
  expect(mock.start).not.toHaveBeenCalled();
  mutual = true;
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(mock.start).toHaveBeenCalledOnce());
  expect(mock.created.mock.calls[0][3]).toEqual({ audio: false, video: true });
  fireEvent.click(screen.getByLabelText('Microphone'));
  expect(mock.choose).toHaveBeenCalledWith('audio', true);
  fireEvent.click(screen.getByRole('button', { name: 'Leave call' }));
  expect(mock.close).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Draw a card' })).toBeEnabled();
});

it('lets the recipient decline without constructing a peer or asking for devices', async () => {
  mutual = true;
  render(<Pilot />);
  fireEvent.click(await screen.findByRole('button', { name: 'Call invitation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
  await screen.findByRole('button', { name: 'Invite to call' });
  expect(mock.created).not.toHaveBeenCalled();
});

it('withdraws an invitation on navigation, including a pending acceptance', async () => {
  const { rerender } = render(<Pilot />);
  fireEvent.click(await screen.findByRole('button', { name: 'Voice & video' }));
  fireEvent.click(screen.getByRole('button', { name: 'Invite to call' }));
  rerender(<Pilot id={null} />);
  await waitFor(() => expect(mock.change).toHaveBeenCalledWith('match', expect.any(String), 'leave', 'original'));
  expect(mock.start).not.toHaveBeenCalled();
});

it('renders only the game for ineligible matches', async () => {
  mock.change.mockResolvedValue(null);
  render(<Pilot />);
  await waitFor(() => expect(mock.change).toHaveBeenCalled());
  expect(screen.queryByLabelText('Private duel call')).toBeNull();
  expect(screen.getByRole('button', { name: 'Draw a card' })).toBeEnabled();
});
