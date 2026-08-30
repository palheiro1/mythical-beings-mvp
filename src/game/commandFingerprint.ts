import type { GameCommandEnvelope } from './protocol.js';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function canonicalizeCommandEnvelope(envelope: GameCommandEnvelope): string {
  return stableStringify(envelope);
}

export async function computeCommandEnvelopeFingerprint(
  envelope: GameCommandEnvelope,
): Promise<string> {
  const canonical = canonicalizeCommandEnvelope(envelope);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

