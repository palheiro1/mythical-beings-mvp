import type { Database } from '@mythicalb/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { playHubSupabase } from './mythicalClient.js';

export type CallAction = 'state' | 'accept' | 'leave' | 'decline';
export type CallGrant = { epoch: string; seat: 1 | 2; mine: boolean; otherTab: boolean; peer: boolean };
type CallDatabase = Database & { public: { Functions: { wisdom_duel_invitation_call: {
  Args: { p_match: string; p_client: string; p_action: CallAction; p_epoch: string | null };
  Returns: CallGrant | null;
} } } };
const client = playHubSupabase as SupabaseClient<CallDatabase>;

export async function changeCall(matchId: string, clientId: string, action: CallAction, epoch: string | null) {
  if (action === 'state' && !epoch) {
    const { data, error } = await client.functions.invoke('wisdom-duel-turn', {
      body: { action: 'availability', matchId, clientId }, timeout: 8000,
    });
    if (error) throw error;
    return (data?.grant ?? null) as CallGrant | null;
  }
  const { data, error } = await client.rpc('wisdom_duel_invitation_call', {
    p_match: matchId, p_client: clientId, p_action: action, p_epoch: epoch,
  }).abortSignal(AbortSignal.timeout(8000));
  if (error) throw error;
  return data;
}

export async function turnServers(matchId: string, clientId: string, epoch: string): Promise<RTCIceServer[]> {
  const { data, error } = await client.functions.invoke('wisdom-duel-turn', { body: { matchId, clientId, epoch }, timeout: 12000 });
  if (error || !data?.iceServers?.length) throw new Error('Relay unavailable');
  return data.iceServers;
}

export type CallSignal = { kind: 'ready' | 'bye' } | { kind: 'offer' | 'answer'; sdp: string }
  | { kind: 'devices'; video: boolean; audio: boolean };

export function callSignaling(grant: CallGrant, receive: (signal: CallSignal) => void, ready: () => void) {
  const channel = (seat: number) => client.channel('wd-call:' + grant.epoch + ':' + seat, { config: { private: true } });
  const outbox = channel(grant.seat);
  const inbox = channel(3 - grant.seat);
  let incoming = false, outgoing = false, closed = false;
  function checkReady() { if (incoming && outgoing && !closed) ready(); }
  inbox.on('broadcast', { event: 'signal' }, ({ payload }) => {
    if (!closed && payload && typeof payload.kind === 'string') receive(payload as CallSignal);
  }).subscribe(status => { incoming = status === 'SUBSCRIBED'; checkReady(); });
  outbox.subscribe(status => { outgoing = status === 'SUBSCRIBED'; checkReady(); });
  return {
    send(signal: CallSignal) {
      if (!closed && outgoing) void outbox.send({ type: 'broadcast', event: 'signal', payload: signal }).catch(() => {});
    },
    close() {
      closed = true;
      void client.removeChannel(outbox).catch(() => {});
      void client.removeChannel(inbox).catch(() => {});
    },
  };
}
