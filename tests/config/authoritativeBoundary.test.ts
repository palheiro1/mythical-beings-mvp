import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readAuthoritativeEngineSources(): string {
  const directory = resolve(process.cwd(), 'src/game');
  return readdirSync(directory)
    // Transport request IDs may use crypto.randomUUID; gameplay state may not.
    .filter((name) => name.endsWith('.ts') && !name.includes('Http'))
    .map((name) => readFileSync(resolve(directory, name), 'utf8'))
    .join('\n');
}

describe('authoritative boundary policy', () => {
  it('keeps gameplay randomness on the versioned private stream', () => {
    const sources = readAuthoritativeEngineSources();
    expect(sources).not.toMatch(/Math\.random\s*\(/);
    expect(sources).not.toMatch(/crypto\.randomUUID\s*\(/);
    expect(sources).toContain("GAME_RANDOM_ALGORITHM = 'chacha20-v1'");
  });

  it('does not serialize the private RNG or deck order in projections', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/projections.ts'), 'utf8');
    expect(source).not.toContain('privateRandom');
    expect(source).toContain('deckCount: state.knowledgeDeck.length');
    expect(source).not.toMatch(/knowledgeDeck:\s*structuredClone/);
  });

  it('does not generate a new damage-animation identity during GameScreen render', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/GameScreen.tsx'), 'utf8');
    expect(source).not.toMatch(/Math\.random\s*\(/);
    expect(source).toContain('damageEventSequenceRef.current += 1');
    expect(source).toContain('<CombatFloaters event={damageEvent}');
  });
});
