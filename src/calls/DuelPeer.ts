import { callSignaling, turnServers, type CallGrant, type CallSignal } from '../services/invitationCall.js';

export type Devices = { audio: boolean; video: boolean };
export const devicesOff = (): Devices => ({ audio: false, video: false });
type Kind = keyof Devices;
const kinds: Kind[] = ['audio', 'video'];
type PeerEvents = {
  connected: () => void;
  remote: (stream: MediaStream) => void;
  devices: (devices: Devices) => void;
  denied: (kind: Kind) => void;
  ended: (message: string) => void;
};

// Negotiated send/receive slots let either player enable a device later without a second offer.
export class DuelPeer {
  private pc?: RTCPeerConnection;
  private wire?: ReturnType<typeof callSignaling>;
  private closed = false;
  private connected = false;
  private negotiating = false;
  private localDescription?: CallSignal;
  private tracks: Partial<Record<Kind, MediaStreamTrack>> = {};
  private revisions = { audio: 0, video: 0 };
  private retry?: ReturnType<typeof setInterval>;
  private renewal?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private disconnected?: ReturnType<typeof setTimeout>;
  private cancelGathering?: () => void;

  constructor(private matchId: string, private clientId: string, private grant: CallGrant,
    private choices: Devices, private events: PeerEvents) {}

  async start() {
    try {
      const iceServers = await turnServers(this.matchId, this.clientId, this.grant.epoch);
      if (this.closed) return;
      const pc = this.pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' });
      const remote = new MediaStream();
      pc.ontrack = ({ track }) => { remote.addTrack(track); this.events.remote(remote); };
      pc.onconnectionstatechange = () => {
        if (this.closed) return;
        clearTimeout(this.disconnected);
        if (pc.connectionState === 'connected') {
          if (!this.renewal) this.renewal = setInterval(() => void this.renewRelay(pc), 45 * 60 * 1000);
          this.connected = true;
          clearTimeout(this.timeout);
          this.events.connected();
          this.sendDevices();
        } else if (pc.connectionState === 'failed') {
          this.events.ended('Connection lost. You can start a new call.');
        } else if (pc.connectionState === 'disconnected') {
          this.disconnected = setTimeout(() => this.events.ended('Connection lost. You can start a new call.'), 8000);
        }
      };
      if (this.grant.seat === 1) {
        for (const kind of kinds) pc.addTransceiver(kind, { direction: 'sendrecv' });
      }
      this.wire = callSignaling(this.grant, signal => this.receive(signal), () => this.announce());
      this.retry = setInterval(() => { if (!this.connected) this.announce(); }, 2000);
      this.timeout = setTimeout(() => this.events.ended('Could not connect the call. You can try again.'), 35000);
      for (const kind of kinds) if (this.choices[kind]) void this.setDevice(kind, true);
    } catch {
      if (!this.closed) this.events.ended('The call service is unavailable. You can keep playing.');
    }
  }

  private async renewRelay(pc: RTCPeerConnection) {
    try {
      const iceServers = await turnServers(this.matchId, this.clientId, this.grant.epoch);
      if (!this.closed) pc.setConfiguration({ ...pc.getConfiguration(), iceServers });
    } catch {
      if (!this.closed) this.events.ended('Could not renew the private relay. You can start a new call.');
    }
  }

  private announce() {
    if (this.closed) return;
    if (this.localDescription && !this.connected) this.wire?.send(this.localDescription);
    else this.wire?.send({ kind: 'ready' });
    this.sendDevices();
  }

  private sendDevices() {
    this.wire?.send({ kind: 'devices', audio: !!this.tracks.audio, video: !!this.tracks.video });
  }

  private receive(signal: CallSignal) {
    if (this.closed) return;
    if (signal.kind === 'bye') { this.events.ended('Your opponent left the call.'); return; }
    if (signal.kind === 'devices') {
      this.events.devices({ audio: signal.audio === true, video: signal.video === true });
      return;
    }
    if (signal.kind === 'ready') {
      if (this.localDescription) this.wire?.send(this.localDescription);
      else if (this.grant.seat === 1) void this.negotiate();
      this.sendDevices();
      return;
    }
    if (!('sdp' in signal) || typeof signal.sdp !== 'string' || signal.sdp.length > 65536) return;
    if (signal.kind === 'offer' && this.grant.seat === 2) {
      if (this.localDescription) this.wire?.send(this.localDescription);
      else void this.negotiate({ type: 'offer', sdp: signal.sdp });
    } else if (signal.kind === 'answer' && this.grant.seat === 1 && this.pc?.signalingState === 'have-local-offer') {
      void this.negotiate({ type: 'answer', sdp: signal.sdp });
    }
  }

  private async negotiate(remote?: RTCSessionDescriptionInit) {
    const pc = this.pc;
    if (!pc || this.negotiating || this.closed) return;
    this.negotiating = true;
    try {
      if (remote) await pc.setRemoteDescription(remote);
      if (this.closed || remote?.type === 'answer') return;
      if (remote?.type === 'offer') {
        for (const slot of pc.getTransceivers()) {
          slot.direction = 'sendrecv';
          const kind = slot.receiver.track.kind as Kind;
          await slot.sender.replaceTrack(this.tracks[kind] ?? null);
        }
      }
      await pc.setLocalDescription(remote ? await pc.createAnswer() : await pc.createOffer());
      await this.gather(pc);
      if (this.closed) return;
      const sdp = pc.localDescription?.sdp;
      if (!sdp || !/^a=candidate:.* typ relay\b/m.test(sdp)) throw new Error('Relay unavailable');
      this.localDescription = { kind: remote ? 'answer' : 'offer', sdp };
      this.wire?.send(this.localDescription);
    } catch {
      if (!this.closed) this.events.ended('The private relay could not connect. You can try again.');
    } finally {
      this.negotiating = false;
    }
  }

  private gather(pc: RTCPeerConnection) {
    if (this.closed || pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise<void>(resolve => {
      const finished = () => {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', changed);
        this.cancelGathering = undefined;
        resolve();
      };
      const changed = () => { if (pc.iceGatheringState === 'complete') finished(); };
      const timer = setTimeout(finished, 9000);
      this.cancelGathering = finished;
      pc.addEventListener('icegatheringstatechange', changed);
      changed();
    });
  }

  async setDevice(kind: Kind, enabled: boolean) {
    this.choices = { ...this.choices, [kind]: enabled };
    const revision = ++this.revisions[kind];
    if (!this.pc || this.closed) return;
    const sender = () => this.pc?.getTransceivers().find(slot => slot.receiver.track.kind === kind)?.sender;
    const previous = this.tracks[kind];
    if (!enabled) {
      previous?.stop();
      delete this.tracks[kind];
      this.sendDevices();
      await sender()?.replaceTrack(null).catch(() => {});
      return;
    }
    if (previous) return;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia(kind === 'audio'
        ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
        : { audio: false, video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } } });
      if (this.closed || this.revisions[kind] !== revision) { stream.getTracks().forEach(track => track.stop()); return; }
      const track = stream.getTracks()[0];
      if (!track) throw new Error('Device unavailable');
      this.tracks[kind] = track;
      track.onended = () => {
        if (this.closed || this.tracks[kind] !== track) return;
        void this.setDevice(kind, false);
        this.events.denied(kind);
      };
      await sender()?.replaceTrack(track);
      this.sendDevices();
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      if (this.closed || this.revisions[kind] !== revision) return;
      delete this.tracks[kind];
      this.events.denied(kind);
      this.sendDevices();
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.wire?.send({ kind: 'bye' });
    this.wire?.close();
    clearInterval(this.retry);
    clearInterval(this.renewal);
    clearTimeout(this.timeout);
    clearTimeout(this.disconnected);
    this.cancelGathering?.();
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
    }
    for (const track of Object.values(this.tracks)) track.stop();
    this.tracks = {};
  }
}
