export const GAME_RANDOM_ALGORITHM = 'chacha20-v1' as const;

export interface GameRandomState {
  algorithm: typeof GAME_RANDOM_ALGORITHM;
  /** Secret server-side seed. Never include this object in a player projection. */
  seedHex: string;
  /** Number of bytes already consumed from the deterministic stream. */
  cursor: number;
}

const SEED_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const UINT32_RANGE = 0x1_0000_0000;

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function quarterRound(state: Uint32Array, a: number, b: number, c: number, d: number): void {
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotateLeft(state[d] ^ state[a], 16);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotateLeft(state[b] ^ state[c], 12);
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotateLeft(state[d] ^ state[a], 8);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotateLeft(state[b] ^ state[c], 7);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0;
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function hexToBytes(seedHex: string): Uint8Array {
  if (!SEED_HEX_PATTERN.test(seedHex)) {
    throw new Error('A game seed must be exactly 32 bytes encoded as hexadecimal.');
  }
  return Uint8Array.from({ length: 32 }, (_, index) => (
    Number.parseInt(seedHex.slice(index * 2, index * 2 + 2), 16)
  ));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** RFC 8439 ChaCha20 block with a per-match key and a zero nonce. */
function createStreamBlock(seed: Uint8Array, blockCounter: number): Uint8Array {
  const initial = new Uint32Array(16);
  initial.set([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574], 0);
  for (let index = 0; index < 8; index += 1) {
    initial[4 + index] = readUint32LE(seed, index * 4);
  }
  initial[12] = blockCounter >>> 0;
  // Words 13-15 are a zero nonce. A fresh 256-bit seed is unique per match.

  const working = new Uint32Array(initial);
  for (let round = 0; round < 10; round += 1) {
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }

  const block = new Uint8Array(64);
  for (let index = 0; index < 16; index += 1) {
    writeUint32LE(block, index * 4, (working[index] + initial[index]) >>> 0);
  }
  return block;
}

export function isValidGameRandomState(value: unknown): value is GameRandomState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GameRandomState>;
  return candidate.algorithm === GAME_RANDOM_ALGORITHM
    && typeof candidate.seedHex === 'string'
    && SEED_HEX_PATTERN.test(candidate.seedHex)
    && Number.isSafeInteger(candidate.cursor)
    && Number(candidate.cursor) >= 0;
}

export function generateGameSeedHex(): string {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return bytesToHex(seed);
}

export function createGameRandomState(seedHex = generateGameSeedHex()): GameRandomState {
  hexToBytes(seedHex);
  return {
    algorithm: GAME_RANDOM_ALGORITHM,
    seedHex: seedHex.toLowerCase(),
    cursor: 0,
  };
}

export function takeGameRandomBytes(state: GameRandomState, length: number): Uint8Array {
  if (!isValidGameRandomState(state)) throw new Error('Invalid game random state.');
  if (!Number.isSafeInteger(length) || length < 0) throw new Error('Random byte length must be a non-negative safe integer.');
  if (state.cursor + length > 64 * UINT32_RANGE) throw new Error('The game random stream is exhausted.');

  const seed = hexToBytes(state.seedHex);
  const output = new Uint8Array(length);
  for (let outputOffset = 0; outputOffset < length;) {
    const blockCounter = Math.floor(state.cursor / 64);
    const blockOffset = state.cursor % 64;
    const block = createStreamBlock(seed, blockCounter);
    const available = Math.min(length - outputOffset, 64 - blockOffset);
    output.set(block.subarray(blockOffset, blockOffset + available), outputOffset);
    outputOffset += available;
    state.cursor += available;
  }
  return output;
}

export function takeGameRandomUint32(state: GameRandomState): number {
  return readUint32LE(takeGameRandomBytes(state, 4), 0);
}

export function takeGameRandomInt(state: GameRandomState, maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new Error('Random integer bound must be between 1 and 2^32.');
  }
  const rejectionLimit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let value: number;
  do {
    value = takeGameRandomUint32(state);
  } while (value >= rejectionLimit);
  return value % maxExclusive;
}

export function takeGameRandomUuid(state: GameRandomState): string {
  const bytes = takeGameRandomBytes(state, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function shuffleWithGameRandom<T>(values: T[], state: GameRandomState): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = takeGameRandomInt(state, index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export async function computeGameSeedCommitment(seedHex: string): Promise<string> {
  const seed = hexToBytes(seedHex);
  const domain = new TextEncoder().encode(`${GAME_RANDOM_ALGORITHM}:`);
  const input = new Uint8Array(domain.length + seed.length);
  input.set(domain);
  input.set(seed, domain.length);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', input)));
}

export async function verifyGameSeedCommitment(seedHex: string, commitment: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(commitment)) return false;
  return (await computeGameSeedCommitment(seedHex)) === commitment.toLowerCase();
}
