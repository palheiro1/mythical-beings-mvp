import { describe, expect, it, vi } from 'vitest';
import {
  AuthoritativeClientHttpTransport,
} from '../../src/game/authoritativeClientHttpTransport.js';
import { buildGameProjection } from '../../src/game/projections.js';
import { GAME_COMMAND_PROTOCOL_VERSION, type GameCommandEnvelope } from '../../src/game/protocol.js';
import { createGameRandomState } from '../../src/game/random.js';
import { initializeGame } from '../../src/game/state.js';

const ORIGIN = 'https://example.supabase.co';
const COMMAND_URL = `${ORIGIN}/functions/v1/wisdom-duel-command`;
const PROJECTION_URL = `${ORIGIN}/functions/v1/wisdom-duel-projection`;
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
}, createGameRandomState('12'.repeat(32)));

const projection = (version: number) => buildGameProjection(
  gameState,
  { kind: 'player', playerId: PLAYER_1_ID },
  { stateVersion: version, eventSequence: version, seedCommitment: '34'.repeat(32) },
);

const command: GameCommandEnvelope = {
  protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
  matchId: MATCH_ID,
  commandId: COMMAND_ID,
  expectedVersion: 4,
  command: { type: 'rotate_creature', creatureId: 'lafaic' },
};

const jsonResponse = (
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});

const asFetcher = (mock: ReturnType<typeof vi.fn>): typeof fetch => mock as unknown as typeof fetch;

const createTransport = (options: {
  fetchMock?: ReturnType<typeof vi.fn>;
  getAccessToken?: (signal?: AbortSignal) => Promise<string | null>;
  maxResponseBytes?: number;
} = {}) => {
  const fetchMock = options.fetchMock ?? vi.fn(async () => jsonResponse({
    status: 'ok',
    projection: projection(4),
    requestId: 'request-1',
  }));
  const getAccessToken = options.getAccessToken ?? vi.fn(async () => 'fresh-token');
  const transport = new AuthoritativeClientHttpTransport({
    commandUrl: COMMAND_URL,
    projectionUrl: PROJECTION_URL,
    getAccessToken,
    fetcher: asFetcher(fetchMock),
    maxResponseBytes: options.maxResponseBytes,
  });
  return { transport, fetchMock, getAccessToken };
};

describe('authoritative client HTTP transport', () => {
  it('requires same-origin HTTPS endpoints without embedded URL state', () => {
    const base = {
      commandUrl: COMMAND_URL,
      projectionUrl: PROJECTION_URL,
      getAccessToken: async () => 'token',
    };
    expect(() => new AuthoritativeClientHttpTransport({
      ...base,
      commandUrl: 'http://example.supabase.co/command',
    })).toThrow('HTTPS URL');
    expect(() => new AuthoritativeClientHttpTransport({
      ...base,
      commandUrl: `${COMMAND_URL}?redirect=attacker`,
    })).toThrow('without credentials, query, or hash');
    expect(() => new AuthoritativeClientHttpTransport({
      ...base,
      projectionUrl: 'https://attacker.example/projection',
    })).toThrow('must share one origin');
  });

  it('gets a fresh token for POST and GET and uses non-leaking fetch options', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        status: 'accepted',
        commandId: COMMAND_ID,
        stateVersion: 5,
        eventSequence: 5,
        projection: projection(5),
        requestId: 'command-request',
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'ok',
        projection: projection(5),
        requestId: 'projection-request',
      }));
    const getAccessToken = vi.fn()
      .mockResolvedValueOnce('fresh-token-one')
      .mockResolvedValueOnce('fresh-token-two');
    const { transport } = createTransport({ fetchMock, getAccessToken });
    const controller = new AbortController();

    await expect(transport.sendCommand(command, controller.signal)).resolves.toMatchObject({
      status: 'accepted',
      commandId: COMMAND_ID,
      stateVersion: 5,
    });
    await expect(transport.readProjection(MATCH_ID, controller.signal)).resolves.toMatchObject({
      status: 'ok',
      projection: { stateVersion: 5 },
    });

    expect(getAccessToken).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(postUrl.toString()).toBe(COMMAND_URL);
    expect(postInit).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    expect(postInit.headers).toMatchObject({ Authorization: 'Bearer fresh-token-one' });
    expect(JSON.parse(String(postInit.body))).toEqual(command);

    const [getUrl, getInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect([...getUrl.searchParams.entries()]).toEqual([['matchId', MATCH_ID]]);
    expect(getInit).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    expect(getInit.headers).toMatchObject({ Authorization: 'Bearer fresh-token-two' });
    expect(JSON.stringify(transport)).not.toMatch(/fresh-token-one|fresh-token-two/);
  });

  it('does not call fetch when the current session token is absent or malformed', async () => {
    const fetchMock = vi.fn();
    const noToken = createTransport({ fetchMock, getAccessToken: async () => null }).transport;
    const malformed = createTransport({
      fetchMock,
      getAccessToken: async () => 'token with whitespace',
    }).transport;

    await expect(noToken.readProjection(MATCH_ID)).resolves.toMatchObject({
      status: 'rejected',
      code: 'unauthorized',
    });
    await expect(malformed.sendCommand(command)).resolves.toMatchObject({
      status: 'rejected',
      code: 'unauthorized',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes 401, 429, and 504 without exposing request IDs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        status: 'rejected',
        code: 'unauthorized',
        message: 'A valid bearer token is required.',
        requestId: 'server-private-correlation-1',
      }, 401))
      .mockResolvedValueOnce(jsonResponse({
        status: 'rejected',
        code: 'rate_limited',
        message: 'Too many commands. Retry later.',
        requestId: 'server-private-correlation-2',
      }, 429, { 'Retry-After': '7' }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'rejected',
        code: 'operation_timeout',
        message: 'Retry with the same commandId.',
        requestId: 'server-private-correlation-3',
      }, 504));
    const { transport } = createTransport({ fetchMock });

    const unauthorized = await transport.readProjection(MATCH_ID);
    const limited = await transport.sendCommand(command);
    const timeout = await transport.sendCommand(command);

    expect(unauthorized).toEqual({
      status: 'rejected',
      code: 'unauthorized',
      message: 'A valid bearer token is required.',
    });
    expect(limited).toEqual({
      status: 'rejected',
      code: 'rate_limited',
      message: 'Too many commands. Retry later.',
      retryAfterSeconds: 7,
    });
    expect(timeout).toEqual({
      status: 'rejected',
      code: 'operation_timeout',
      message: 'Retry with the same commandId.',
    });
    expect(JSON.stringify([unauthorized, limited, timeout])).not.toContain('server-private-correlation');
  });

  it('fails closed on wrong content type, malformed JSON, and declared oversized bodies', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<html>error</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }))
      .mockResolvedValueOnce(new Response('{broken', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('{}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '5000',
        },
      }));
    const { transport } = createTransport({ fetchMock, maxResponseBytes: 1_024 });

    for (let index = 0; index < 3; index += 1) {
      await expect(transport.sendCommand(command)).resolves.toMatchObject({
        status: 'rejected',
        code: 'invalid_response',
      });
    }
  });

  it('rejects projections with unknown private fields before exposing them', async () => {
    const poisoned = { ...projection(4), privateRandom: { seedHex: 'secret-seed' } };
    const { transport } = createTransport({
      fetchMock: vi.fn(async () => jsonResponse({
        status: 'ok',
        projection: poisoned,
        requestId: 'request-1',
      })),
    });

    const result = await transport.readProjection(MATCH_ID);
    expect(result).toMatchObject({ status: 'rejected', code: 'invalid_response' });
    expect(JSON.stringify(result)).not.toContain('secret-seed');
  });

  it('propagates fetch and abort failures for the controller to classify as retryable', async () => {
    const networkFailure = new TypeError('network unavailable');
    const fetchMock = vi.fn(async () => { throw networkFailure; });
    const { transport } = createTransport({ fetchMock });
    await expect(transport.sendCommand(command)).rejects.toBe(networkFailure);

    const controller = new AbortController();
    controller.abort(new DOMException('cancelled', 'AbortError'));
    const aborted = createTransport({
      fetchMock,
      getAccessToken: async (signal) => {
        if (signal?.aborted) throw signal.reason;
        return 'unused';
      },
    }).transport;
    await expect(aborted.readProjection(MATCH_ID, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
