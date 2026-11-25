import { describe, expect, it } from 'vitest';
import {
  createFailClosedAuthoritativeRateLimitCheck,
  type AuthoritativeRateLimitPolicy,
  type AuthoritativeRateLimitStore,
  TransactionalInMemoryRateLimitStore,
} from '../../src/game/authoritativeRateLimit.js';

const policy: AuthoritativeRateLimitPolicy = {
  windows: [
    { durationMs: 1_000, maxRequests: 2 },
    { durationMs: 60_000, maxRequests: 4 },
  ],
};

const request = () => new Request('https://example.test/command', { method: 'POST' });

describe('authoritative rate limiting', () => {
  it('atomically enforces concurrent requests against a shared actor quota', async () => {
    const store = new TransactionalInMemoryRateLimitStore();
    const check = createFailClosedAuthoritativeRateLimitCheck({
      store,
      policy,
      keySalt: 'test-salt-at-least-16-characters',
      now: () => 10_000,
    });

    const decisions = await Promise.all(Array.from({ length: 6 }, () => (
      check('actor-1', request())
    )));
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(2);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(4);
  });

  it('honours burst and sustained windows with a usable retry-after', async () => {
    const store = new TransactionalInMemoryRateLimitStore();
    let nowMs = 10_000;
    const check = createFailClosedAuthoritativeRateLimitCheck({
      store,
      policy,
      keySalt: 'test-salt-at-least-16-characters',
      now: () => nowMs,
    });

    expect((await check('actor-1', request())).allowed).toBe(true);
    expect((await check('actor-1', request())).allowed).toBe(true);
    expect(await check('actor-1', request())).toEqual({ allowed: false, retryAfterSeconds: 1 });
    nowMs += 1_001;
    expect((await check('actor-1', request())).allowed).toBe(true);
    expect((await check('actor-1', request())).allowed).toBe(true);
    expect(await check('actor-1', request())).toEqual({ allowed: false, retryAfterSeconds: 59 });
  });

  it('stores only salted hashes and isolates actor identities', async () => {
    const store = new TransactionalInMemoryRateLimitStore();
    const check = createFailClosedAuthoritativeRateLimitCheck({
      store,
      policy: { windows: [{ durationMs: 1_000, maxRequests: 1 }] },
      keySalt: 'test-salt-at-least-16-characters',
      now: () => 10_000,
    });

    expect((await check('private-actor-a', request())).allowed).toBe(true);
    expect((await check('private-actor-b', request())).allowed).toBe(true);
    const keys = store.readHashedKeysForTest();
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => /^[0-9a-f]{64}$/.test(key))).toBe(true);
    expect(JSON.stringify(keys)).not.toMatch(/private-actor/);
  });

  it('can add a trusted shared-network quota without reading spoofable headers itself', async () => {
    const store = new TransactionalInMemoryRateLimitStore();
    const check = createFailClosedAuthoritativeRateLimitCheck({
      store,
      policy: { windows: [{ durationMs: 1_000, maxRequests: 2 }] },
      keySalt: 'test-salt-at-least-16-characters',
      now: () => 10_000,
      resolveTrustedNetworkIdentity: () => 'trusted-gateway-network-1',
    });

    expect((await check('actor-a', request())).allowed).toBe(true);
    expect((await check('actor-b', request())).allowed).toBe(true);
    expect(await check('actor-c', request())).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('fails closed if the shared quota store is unavailable', async () => {
    const unavailable: AuthoritativeRateLimitStore = {
      consume: async () => { throw new Error('quota store unavailable'); },
    };
    const check = createFailClosedAuthoritativeRateLimitCheck({
      store: unavailable,
      policy,
      keySalt: 'test-salt-at-least-16-characters',
    });

    await expect(check('actor-1', request())).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it('bounds key cardinality and reclaims only fully expired buckets', async () => {
    const store = new TransactionalInMemoryRateLimitStore({ maxKeys: 2 });
    let nowMs = 10_000;
    const check = createFailClosedAuthoritativeRateLimitCheck({
      store,
      policy: { windows: [{ durationMs: 1_000, maxRequests: 2 }] },
      keySalt: 'test-salt-at-least-16-characters',
      now: () => nowMs,
    });

    expect((await check('actor-a', request())).allowed).toBe(true);
    expect((await check('actor-b', request())).allowed).toBe(true);
    expect(await check('actor-c', request())).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(store.readBucketCountForTest()).toBe(2);

    nowMs += 1_001;
    expect((await check('actor-c', request())).allowed).toBe(true);
    expect(store.readBucketCountForTest()).toBe(1);
  });
});
