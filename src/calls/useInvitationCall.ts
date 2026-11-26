import { useEffect, useState } from 'react';
import { changeCall, type CallAction, type CallGrant } from '../services/invitationCall.js';
import { DuelPeer, devicesOff, type Devices } from './DuelPeer.js';

export interface CallView {
  grant: CallGrant | null;
  choices: Devices;
  remoteDevices: Devices;
  stream: MediaStream | null;
  phase: 'idle' | 'waiting' | 'connecting' | 'connected';
  notice: string;
}

export class InvitationCall {
  view: CallView = { grant: null, choices: devicesOff(), remoteDevices: devicesOff(), stream: null, phase: 'idle', notice: '' };
  private clientId = crypto.randomUUID();
  private consent: string | null = null;
  private peer?: DuelPeer;
  private queue = Promise.resolve();
  private polling = false;
  private disposed = false;
  private lastConfirmed = 0;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private matchId: string, private changed: (view: CallView) => void) {}

  private update(patch: Partial<CallView>) {
    this.view = { ...this.view, ...patch };
    if (!this.disposed) this.changed(this.view);
  }

  start() {
    void this.sync('state');
    this.timer = setInterval(this.poll, 3500);
    window.addEventListener('online', this.poll);
    window.addEventListener('focus', this.poll);
    window.addEventListener('pagehide', this.pageHide);
  }

  private poll = () => {
    if (this.consent && Date.now() - this.lastConfirmed > 30000) {
      this.leave('The call timed out. You can start a new call.');
      return;
    }
    if (!this.polling) void this.sync('state');
  };

  private pageHide = () => { if (this.consent) this.leave(); };

  private sync(action: CallAction, epoch = this.view.grant?.epoch ?? null) {
    if (action === 'state') this.polling = true;
    this.queue = this.queue.then(async () => {
      if (this.disposed && action !== 'leave') return;
      try {
        const grant = await changeCall(this.matchId, this.clientId, action, epoch);
        if (this.disposed) return;
        if (action === 'state' && !grant && !this.view.grant) clearInterval(this.timer);
        const ended = this.consent && (!grant || this.consent !== grant.epoch);
        if (ended) this.reset('The invitation or call has ended.');
        this.update({ grant });
        if (this.consent && grant?.mine && grant.peer) {
          this.lastConfirmed = Date.now();
          if (!this.peer) this.connect(grant);
        } else if (this.consent && grant?.mine) {
          this.lastConfirmed = Date.now();
          this.update({ phase: 'waiting' });
        } else if (action === 'accept' && this.consent) {
          this.reset('Could not join this call. Try again.');
        }
      } catch {
        if (this.disposed) return;
        if (action === 'accept') this.leave('Could not confirm your invitation. Try again.');
        else if (action === 'decline') this.update({ notice: 'Could not decline the invitation. Try again.' });
      }
    }).finally(() => { if (action === 'state') this.polling = false; });
    return this.queue;
  }

  accept = () => {
    const grant = this.view.grant;
    if (!grant || grant.otherTab || this.consent) return;
    this.consent = grant.epoch;
    this.lastConfirmed = Date.now();
    this.update({ phase: 'waiting', notice: '' });
    void this.sync('accept', grant.epoch);
  };

  decline = () => { void this.sync('decline'); };

  private connect(grant: CallGrant) {
    this.update({ phase: 'connecting', notice: '' });
    this.peer = new DuelPeer(this.matchId, this.clientId, grant, this.view.choices, {
      connected: () => this.update({ phase: 'connected' }),
      remote: stream => this.update({ stream }),
      devices: remoteDevices => this.update({ remoteDevices }),
      denied: kind => this.update({
        choices: { ...this.view.choices, [kind]: false },
        notice: (kind === 'video' ? 'Camera' : 'Microphone') + ' unavailable. Check your browser permissions.',
      }),
      ended: notice => this.leave(notice),
    });
    void this.peer.start();
  }

  choose = (kind: keyof Devices, enabled: boolean) => {
    this.update({ choices: { ...this.view.choices, [kind]: enabled }, notice: '' });
    void this.peer?.setDevice(kind, enabled);
  };

  private reset(notice: string) {
    this.consent = null;
    this.peer?.close();
    this.peer = undefined;
    this.update({ stream: null, remoteDevices: devicesOff(), choices: devicesOff(), phase: 'idle', notice });
  }

  leave = (notice = '') => {
    const epoch = this.consent;
    this.reset(notice);
    if (epoch) void this.sync('leave', epoch);
  };

  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    window.removeEventListener('focus', this.poll);
    window.removeEventListener('online', this.poll);
    window.removeEventListener('pagehide', this.pageHide);
    this.leave();
  }
}

export function useInvitationCall(matchId: string | null, playerId?: string) {
  const [bound, setBound] = useState<{ model: InvitationCall; view: CallView; matchId: string; playerId: string } | null>(null);
  useEffect(() => {
    setBound(null);
    if (!matchId || !playerId || typeof RTCPeerConnection === 'undefined' || !globalThis.crypto?.randomUUID) return;
    const model = new InvitationCall(matchId, view => setBound({ model, view, matchId, playerId }));
    model.start();
    return () => model.dispose();
  }, [matchId, playerId]);
  return bound?.matchId === matchId && bound?.playerId === playerId && bound?.view.grant ? bound : null;
}
