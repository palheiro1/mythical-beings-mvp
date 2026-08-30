import type { PropsWithChildren } from 'react';
import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthoritativeGameClient,
  type AuthoritativeClientCommandResponse,
  type AuthoritativeClientProjectionResponse,
  type AuthoritativeClientTransport,
} from '../../src/game/authoritativeClient.js';
import { buildGameProjection } from '../../src/game/projections.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';
import { useAuthoritativeGameClient } from '../../src/hooks/useAuthoritativeGameClient.js';

const MATCH_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const PLAYER_1_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120003';
const PLAYER_2_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120004';
const COMMAND_ID = '018f2f9a-4e1c-7b8a-8f2c-0242ac120010';

const gameState = initializeGame({
  gameId: MATCH_ID,
  player1Id: PLAYER_1_ID,
  player2Id: PLAYER_2_ID,
  player1SelectedIds: ['lafaic', 'adaro', 'kappa'],
  player2SelectedIds: ['pele', 'tulpar', 'tarasca'],
}, createGameRandomState('de'.repeat(32)));

const projection = (version: number) => buildGameProjection(
  gameState,
  { kind: 'player', playerId: PLAYER_1_ID },
  { stateVersion: version, eventSequence: version, seedCommitment: 'fa'.repeat(32) },
);

const createClient = (overrides: Partial<AuthoritativeClientTransport> = {}) => {
  const transport: AuthoritativeClientTransport = {
    readProjection: vi.fn(async () => ({ status: 'ok', projection: projection(0) })),
    sendCommand: vi.fn(async (envelope) => ({
      status: 'accepted',
      commandId: envelope.commandId,
      stateVersion: 1,
      eventSequence: 1,
      projection: projection(1),
    })),
    ...overrides,
  };
  const createCommandId = vi.fn(() => COMMAND_ID);
  return {
    client: new AuthoritativeGameClient({ matchId: MATCH_ID, transport, createCommandId }),
    transport,
    createCommandId,
  };
};

const strictWrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;

describe('useAuthoritativeGameClient', () => {
  it('is disabled by default and does not touch the controller transport', async () => {
    const harness = createClient();
    const { result } = renderHook(() => useAuthoritativeGameClient({ client: harness.client }));

    expect(result.current.state).toBeNull();
    expect(harness.transport.readProjection).not.toHaveBeenCalled();
    await expect(result.current.send({ type: 'end_turn' })).rejects.toThrow('hook is disabled');
    expect(harness.transport.sendCommand).not.toHaveBeenCalled();
  });

  it('supports late opt-in and exposes the authenticated projection', async () => {
    const harness = createClient();
    const { result, rerender } = renderHook(
      ({ enabled }) => useAuthoritativeGameClient({ client: harness.client, enabled }),
      { initialProps: { enabled: false } },
    );
    expect(result.current.state).toBeNull();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.state).toMatchObject({
      status: 'ready',
      projection: { stateVersion: 0 },
    }));
    expect(harness.transport.readProjection).toHaveBeenCalledTimes(1);
  });

  it('aborts automatic reconnect and unsubscribes on unmount', async () => {
    let receivedSignal: AbortSignal | undefined;
    const readProjection = vi.fn((_matchId: string, signal?: AbortSignal) => {
      receivedSignal = signal;
      return new Promise<AuthoritativeClientProjectionResponse>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    const harness = createClient({ readProjection });
    const { unmount } = renderHook(
      () => useAuthoritativeGameClient({ client: harness.client, enabled: true }),
    );
    await waitFor(() => expect(receivedSignal).toBeDefined());

    unmount();
    expect(receivedSignal?.aborted).toBe(true);
    expect(receivedSignal?.reason).toMatchObject({ name: 'AbortError' });
  });

  it('does not expose emissions from a controller after it has been replaced', async () => {
    let clientAVersion = 1;
    const harnessA = createClient({
      readProjection: vi.fn(async () => ({
        status: 'ok',
        projection: projection(clientAVersion),
      })),
    });
    const harnessB = createClient({
      readProjection: vi.fn(async () => ({ status: 'ok', projection: projection(2) })),
    });
    const { result, rerender } = renderHook(
      ({ client }) => useAuthoritativeGameClient({ client, enabled: true }),
      { initialProps: { client: harnessA.client } },
    );
    await waitFor(() => expect(result.current.state?.projection?.stateVersion).toBe(1));

    rerender({ client: harnessB.client });
    await waitFor(() => expect(result.current.state?.projection?.stateVersion).toBe(2));
    clientAVersion = 3;
    await act(() => harnessA.client.reconnect());

    expect(result.current.state?.projection?.stateVersion).toBe(2);
  });

  it('keeps action callbacks stable through retryable and duplicate states', async () => {
    let attempt = 0;
    const sendCommand = vi.fn(async (envelope): Promise<AuthoritativeClientCommandResponse> => {
      attempt += 1;
      if (attempt === 1) throw new Error('response lost');
      return {
        status: 'duplicate',
        commandId: envelope.commandId,
        stateVersion: 1,
        eventSequence: 1,
        projection: projection(1),
      };
    });
    const harness = createClient({ sendCommand });
    const { result } = renderHook(
      () => useAuthoritativeGameClient({ client: harness.client, enabled: true }),
      { wrapper: strictWrapper },
    );
    await waitFor(() => expect(result.current.state?.status).toBe('ready'));
    const initialActions = {
      reconnect: result.current.reconnect,
      send: result.current.send,
      retry: result.current.retry,
    };

    await act(() => result.current.send({ type: 'rotate_creature', creatureId: 'lafaic' }));
    expect(result.current.state).toMatchObject({
      status: 'retryable',
      pendingCommand: { attempts: 1 },
    });
    expect(result.current.send).toBe(initialActions.send);
    await act(() => result.current.retry());

    expect(result.current.state).toMatchObject({
      status: 'ready',
      projection: { stateVersion: 1 },
      lastOutcome: 'duplicate',
    });
    expect(result.current.reconnect).toBe(initialActions.reconnect);
    expect(result.current.retry).toBe(initialActions.retry);
    expect(harness.createCommandId).toHaveBeenCalledTimes(1);
  });
});
