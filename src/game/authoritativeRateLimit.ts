export interface AuthoritativeRateLimitWindow {
  durationMs: number;
  maxRequests: number;
}

export interface AuthoritativeRateLimitPolicy {
  windows: readonly AuthoritativeRateLimitWindow[];
}

export interface AuthoritativeRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface AuthoritativeRateLimitStore {
  consume(
    hashedKey: string,
    nowMs: number,
    policy: AuthoritativeRateLimitPolicy,
  ): Promise<AuthoritativeRateLimitDecision>;
}

export interface AuthoritativeRateLimitCheckOptions {
  store: AuthoritativeRateLimitStore;
  policy: AuthoritativeRateLimitPolicy;
  keySalt: string;
  now?: () => number;
  resolveTrustedNetworkIdentity?: (request: Request) => string | null;
}

const validatePolicy = (policy: AuthoritativeRateLimitPolicy): AuthoritativeRateLimitPolicy => {
  if (!Array.isArray(policy.windows) || policy.windows.length < 1 || policy.windows.length > 4) {
    throw new Error('Rate-limit policy must contain between one and four windows.');
  }
  const normalized = policy.windows.map((window) => {
    if (
      !Number.isSafeInteger(window.durationMs)
      || window.durationMs < 100
      || window.durationMs > 24 * 60 * 60 * 1_000
      || !Number.isSafeInteger(window.maxRequests)
      || window.maxRequests < 1
      || window.maxRequests > 10_000
    ) {
      throw new Error('Rate-limit windows contain unsafe values.');
    }
    return { durationMs: window.durationMs, maxRequests: window.maxRequests };
  }).sort((left, right) => left.durationMs - right.durationMs);

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].durationMs === normalized[index - 1].durationMs) {
      throw new Error('Rate-limit window durations must be unique.');
    }
  }
  return { windows: normalized };
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export class TransactionalInMemoryRateLimitStore implements AuthoritativeRateLimitStore {
  private readonly buckets = new Map<string, number[]>();
  private readonly lockQueues = new Map<string, Promise<void>>();
  private readonly maxKeys: number;

  constructor(options: { maxKeys?: number } = {}) {
    this.maxKeys = options.maxKeys ?? 10_000;
    if (!Number.isSafeInteger(this.maxKeys) || this.maxKeys < 1 || this.maxKeys > 1_000_000) {
      throw new Error('Rate-limit store capacity must be between 1 and 1000000 keys.');
    }
  }

  async consume(
    hashedKey: string,
    nowMs: number,
    policy: AuthoritativeRateLimitPolicy,
  ): Promise<AuthoritativeRateLimitDecision> {
    if (!/^[0-9a-f]{64}$/i.test(hashedKey)) throw new Error('Rate-limit key must be hashed.');
    if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error('Rate-limit clock is invalid.');
    const validatedPolicy = validatePolicy(policy);

    return this.withKeyLock(hashedKey, () => {
      const maximumWindow = Math.max(...validatedPolicy.windows.map((window) => window.durationMs));
      if (!this.buckets.has(hashedKey) && this.buckets.size >= this.maxKeys) {
        for (const [key, entries] of this.buckets) {
          const active = entries.filter((timestamp) => nowMs - timestamp < maximumWindow);
          if (active.length === 0) this.buckets.delete(key);
          else this.buckets.set(key, active);
        }
        if (this.buckets.size >= this.maxKeys) {
          throw new Error('Rate-limit store capacity is exhausted.');
        }
      }
      const timestamps = (this.buckets.get(hashedKey) ?? [])
        .filter((timestamp) => nowMs - timestamp < maximumWindow);

      let retryAfterMs = 0;
      for (const window of validatedPolicy.windows) {
        const inWindow = timestamps.filter((timestamp) => nowMs - timestamp < window.durationMs);
        if (inWindow.length >= window.maxRequests) {
          retryAfterMs = Math.max(
            retryAfterMs,
            window.durationMs - (nowMs - inWindow[0]),
          );
        }
      }
      if (retryAfterMs > 0) {
        this.buckets.set(hashedKey, timestamps);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)),
        };
      }

      timestamps.push(nowMs);
      this.buckets.set(hashedKey, timestamps);
      return { allowed: true };
    });
  }

  readHashedKeysForTest(): string[] {
    return [...this.buckets.keys()];
  }

  readBucketCountForTest(): number {
    return this.buckets.size;
  }

  private async withKeyLock<T>(key: string, operation: () => T): Promise<T> {
    const previous = this.lockQueues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => gate);
    this.lockQueues.set(key, queued);

    await previous;
    try {
      return operation();
    } finally {
      release();
      if (this.lockQueues.get(key) === queued) this.lockQueues.delete(key);
    }
  }
}

export function createFailClosedAuthoritativeRateLimitCheck(
  options: AuthoritativeRateLimitCheckOptions,
) {
  const policy = validatePolicy(options.policy);
  if (options.keySalt.length < 16) {
    throw new Error('Rate-limit key salt must contain at least 16 characters.');
  }
  const now = options.now ?? Date.now;

  return async (actorId: string, request: Request): Promise<AuthoritativeRateLimitDecision> => {
    try {
      const nowMs = now();
      const actorKey = await sha256Hex(`wisdom-duel:actor:${options.keySalt}:${actorId}`);
      const actorDecision = await options.store.consume(actorKey, nowMs, policy);
      if (!actorDecision.allowed) return actorDecision;

      const networkIdentity = options.resolveTrustedNetworkIdentity?.(request);
      if (!networkIdentity) return { allowed: true };
      const networkKey = await sha256Hex(
        `wisdom-duel:network:${options.keySalt}:${networkIdentity}`,
      );
      return await options.store.consume(networkKey, nowMs, policy);
    } catch {
      return { allowed: false, retryAfterSeconds: 1 };
    }
  };
}
