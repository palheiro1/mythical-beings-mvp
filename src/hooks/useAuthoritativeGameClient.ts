import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AuthoritativeClientState,
  AuthoritativeGameClient,
} from '../game/authoritativeClient.js';
import type { PlayerGameCommand } from '../game/protocol.js';

export interface UseAuthoritativeGameClientOptions {
  client: AuthoritativeGameClient | null;
  /** Explicit opt-in. Omission always leaves the client disconnected. */
  enabled?: boolean;
}

export interface UseAuthoritativeGameClientResult {
  state: AuthoritativeClientState | null;
  reconnect: (signal?: AbortSignal) => Promise<AuthoritativeClientState>;
  send: (
    command: PlayerGameCommand,
    signal?: AbortSignal,
  ) => Promise<AuthoritativeClientState>;
  retry: (signal?: AbortSignal) => Promise<AuthoritativeClientState>;
}

type ObservedClientState = {
  client: AuthoritativeGameClient;
  state: AuthoritativeClientState;
};

const disabledError = () => new Error('Authoritative game client hook is disabled.');

/**
 * React lifecycle adapter only. Construction, URLs, auth and release gates stay outside.
 */
export function useAuthoritativeGameClient(
  options: UseAuthoritativeGameClientOptions,
): UseAuthoritativeGameClientResult {
  const { client } = options;
  const enabled = options.enabled === true;
  const [observed, setObserved] = useState<ObservedClientState | null>(null);

  useEffect(() => {
    if (!enabled || !client) {
      setObserved(null);
      return undefined;
    }

    let active = true;
    const abortController = new AbortController();
    const unsubscribe = client.subscribe((state) => {
      if (active) setObserved({ client, state });
    });
    void client.reconnect(abortController.signal).catch(() => undefined);

    return () => {
      active = false;
      abortController.abort(new DOMException('Authoritative hook disposed.', 'AbortError'));
      unsubscribe();
    };
  }, [client, enabled]);

  const reconnect = useCallback((signal?: AbortSignal) => {
    if (!enabled || !client) return Promise.reject(disabledError());
    return client.reconnect(signal);
  }, [client, enabled]);

  const send = useCallback((command: PlayerGameCommand, signal?: AbortSignal) => {
    if (!enabled || !client) return Promise.reject(disabledError());
    return client.send(command, signal);
  }, [client, enabled]);

  const retry = useCallback((signal?: AbortSignal) => {
    if (!enabled || !client) return Promise.reject(disabledError());
    return client.retry(signal);
  }, [client, enabled]);

  return useMemo(() => ({
    state: enabled && client && observed?.client === client ? observed.state : null,
    reconnect,
    send,
    retry,
  }), [client, enabled, observed, reconnect, retry, send]);
}
