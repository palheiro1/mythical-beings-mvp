import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DuelPeer } from '../../src/calls/DuelPeer.js';

const mock = vi.hoisted(() => ({ turn: vi.fn(), send: vi.fn(), close: vi.fn() }));
vi.mock('../../src/services/invitationCall.js', () => ({
  turnServers: mock.turn,
  callSignaling: () => ({ send: mock.send, close: mock.close }),
}));
const capture = vi.fn();
const slot = (kind: string) => ({ receiver: { track: { kind } }, sender: { replaceTrack: vi.fn().mockResolvedValue(undefined) } });
class Peer {
  slots: ReturnType<typeof slot>[] = [];
  addTransceiver(kind: string) { this.slots.push(slot(kind)); }
  getTransceivers() { return this.slots; }
  close() {}
}
const callbacks = () => ({ connected: vi.fn(), remote: vi.fn(), devices: vi.fn(), denied: vi.fn(), ended: vi.fn() });
const grant = { epoch: 'call', mine: true, peer: true, seat: 1 as const, otherTab: false };
beforeEach(() => {
  mock.turn.mockResolvedValue([{}]);
  vi.stubGlobal('RTCPeerConnection', Peer);
  vi.stubGlobal('MediaStream', class {});
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('stops a device granted after the user has already left', async () => {
  let resolve!: (stream: unknown) => void;
  const stop = vi.fn();
  capture.mockReturnValue(new Promise(done => { resolve = done; }));
  const peer = new DuelPeer('match','tab',grant,{ audio: false, video: false },callbacks());
  await peer.start();
  const pending = peer.setDevice('video',true);
  peer.close();
  resolve({ getTracks: () => [{ kind: 'video', stop }] });
  await pending;
  expect(stop).toHaveBeenCalledOnce();
});

it('keeps microphone capture when camera permission is refused', async () => {
  const stop = vi.fn();
  capture.mockImplementation(async constraints => {
    if (constraints.video) throw new Error('Camera denied');
    return { getTracks: () => [{ kind: 'audio', stop }] };
  });
  const events = callbacks();
  const peer = new DuelPeer('match','tab',grant,{ audio: false, video: false },events);
  await peer.start();
  await peer.setDevice('audio',true);
  await peer.setDevice('video',true);
  expect(events.denied).toHaveBeenCalledWith('video');
  expect(stop).not.toHaveBeenCalled();
  expect(events.ended).not.toHaveBeenCalled();
  peer.close();
  expect(stop).toHaveBeenCalledOnce();
});

it('does not acquire devices if the user leaves while TURN authorization is in flight', async () => {
  let release!: (servers: unknown[]) => void;
  mock.turn.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const peer = new DuelPeer('match','tab',grant,{ audio: true, video: true },callbacks());
  const pending = peer.start();
  peer.close();
  release([{}]);
  await pending;
  expect(capture).not.toHaveBeenCalled();
});
