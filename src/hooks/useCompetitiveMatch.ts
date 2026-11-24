import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COMMAND_PROTOCOL_V2,
  validateCompetitiveEnvelope,
  type CompetitiveCommand,
  type CompetitiveCommandEnvelope,
  type CompetitiveProjection,
} from '@mythicalb/wisdom-duel-engine';
import { competitive, competitiveError, type WisdomMatchResponse } from '../services/competitiveService.js';
import { playHubSupabase } from '../services/mythicalClient.js';

export function useCompetitiveMatch(matchId: string, playerId: string) {
  const [data, setData] = useState<WisdomMatchResponse | null>(null),
    [error, setError] = useState(''),
    [sending, setSending] = useState(false),
    [retryable, setRetryable] = useState(false);
  const current = useRef<WisdomMatchResponse | null>(null),
    pending = useRef<CompetitiveCommandEnvelope | null>(null),
    alive = useRef(false),
    epoch = useRef(0),
    busy = useRef(false);
  const storageKey = `wisdom-command-v2:${playerId}:${matchId}`;
  const accept = useCallback((next: WisdomMatchResponse) => {
    if (!alive.current) return;
    const old = current.current;
    if (old && Date.parse(next.serverNow) < Date.parse(old.serverNow)) return;
    if (old?.projection && next.projection && next.projection.stateVersion < old.projection.stateVersion)
      return;
    current.current = next;
    setData(next);
  }, []);
  const refresh = useCallback(async () => {
    const generation = epoch.current;
    try {
      const next = await competitive.projection(matchId);
      if (generation !== epoch.current || !alive.current) return;
      accept(next);
      if (!pending.current) setError('');
    } catch (cause) {
      if (alive.current && generation === epoch.current) setError(competitiveError(cause));
    }
  }, [matchId, accept]);
  useEffect(() => {
    const generation = epoch.current + 1;
    epoch.current = generation;
    alive.current = true;
    busy.current = false;
    setSending(false);
    current.current = null;
    setData(null);
    pending.current = null;
    setRetryable(false);
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        pending.current = validateCompetitiveEnvelope(JSON.parse(saved));
        setRetryable(true);
      }
    } catch {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Optional storage. */
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    const reconnect = () => void refresh();
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', reconnect);
    const channel = playHubSupabase
      .channel(`wisdom-projection:${matchId}:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wisdom_duel_player_projections',
          filter: `player_id=eq.${playerId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      epoch.current = generation + 1;
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', reconnect);
      void playHubSupabase.removeChannel(channel);
    };
  }, [matchId, playerId, storageKey, refresh]);
  const submit = useCallback(
    async (command?: CompetitiveCommand) => {
      if (busy.current || !alive.current) return;
      const generation = epoch.current;
      const projection = current.current?.projection;
      if (!pending.current) {
        if (!projection || !command) return;
        pending.current = {
          protocolVersion: COMMAND_PROTOCOL_V2,
          matchId,
          commandId: crypto.randomUUID(),
          expectedVersion: projection.stateVersion,
          command,
        };
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(pending.current));
        } catch {
          /* Retain the same command in memory when storage is unavailable. */
        }
      }
      busy.current = true;
      setSending(true);
      setError('');
      try {
        const response = await competitive.command(pending.current);
        if (generation !== epoch.current || !alive.current) return;
        if (current.current && response.projection)
          accept({
            ...current.current,
            projection: response.projection,
            serverNow: response.projection.serverNow,
          });
        pending.current = null;
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* No persistent copy was written. */
        }
        if (alive.current) {
          setRetryable(false);
          if (response.status === 'version_conflict')
            setError(competitiveError({ code: 'version_conflict' }));
        }
        await refresh();
        return response.status;
      } catch (cause) {
        if (generation !== epoch.current || !alive.current) return;
        const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
        const uncertain = ['connection_failed', 'retry_command', 'internal_error'].includes(code) || !code;
        if (!uncertain) {
          pending.current = null;
          try {
            sessionStorage.removeItem(storageKey);
          } catch {
            /* optional storage */
          }
        }
        if (alive.current) {
          setRetryable(uncertain);
          setError(competitiveError(cause));
        }
      } finally {
        if (generation === epoch.current) {
          busy.current = false;
          if (alive.current) setSending(false);
        }
      }
    },
    [matchId, storageKey, accept, refresh],
  );
  return { data, error, sending, retryable, refresh, submit };
}

export function useMatchClock(projection: CompetitiveProjection | null) {
  const anchor = useRef(performance.now()),
    [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    anchor.current = performance.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(performance.now() - anchor.current), 250);
    return () => clearInterval(timer);
  }, [projection?.clock.updatedAt]);
  return (id: string) =>
    Math.max(
      0,
      (projection?.clock.remainingMs[id] ?? 0) -
        (projection?.clock.runningPlayerId === id && !projection.clock.suspendedAt ? elapsed : 0),
    );
}
