import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PATCH_PATH = resolve(
  process.cwd(),
  'docs/tech/patches/WISDOM_DUEL_CONTAINMENT_C32.patch',
);

const COMPETITION_FUNCTIONS = [
  'card-game-card-lock-authorization',
  'card-game-competition-status',
  'card-game-create-competition-session',
  'card-game-join-competition-session',
  'card-game-settlement-signature',
  'card-game-verify-card-lock',
  'card-game-verify-deposit',
] as const;

describe('Wisdom Duel SDK containment patch', () => {
  const patch = readFileSync(PATCH_PATH, 'utf8');

  it('adds a default-off gate with a stable 503 contract', () => {
    expect(patch).toContain('WISDOM_DUEL_PVP_ENABLED');
    expect(patch).toContain('value?.trim().toLowerCase() === "true"');
    expect(patch).toContain('WISDOM_DUEL_DISABLED_CODE');
    expect(patch).toContain('WISDOM_DUEL_DISABLED_MESSAGE, 503');
  });

  it.each(COMPETITION_FUNCTIONS)('gates %s before its existing handler work', (functionName) => {
    const header = `diff --git a/supabase/functions/${functionName}/index.ts`;
    const start = patch.indexOf(header);
    const end = patch.indexOf('\ndiff --git ', start + header.length);
    const section = patch.slice(start, end === -1 ? undefined : end);

    expect(start).toBeGreaterThan(-1);
    expect(section).toContain('getWisdomDuelReleaseBlock');
    expect(section).toContain('if (releaseBlock) return releaseBlock');
  });

  it('includes executable gate tests and the narrow Deno type fix', () => {
    expect(patch).toContain('wisdomDuelRelease.test.ts');
    expect(patch).toContain('Deno.test("Wisdom Duel release gate is default-off"');
    expect(patch).toContain('Deno.env.get("POLYGON_RPC_URL") ?? null');
  });

  it('does not touch shared migrations or other games', () => {
    expect(patch).not.toMatch(/supabase\/migrations\//);
    expect(patch).not.toMatch(/swarm-hunt|mythic-expedition|bestiary-trails/i);
  });

  it('keeps deal-cards protected in this repository too', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/deal-cards/index.ts'),
      'utf8',
    );
    const gatePosition = source.indexOf(
      'isMultiplayerReleaseEnabled(Deno.env.get(MULTIPLAYER_RELEASE_FLAG))',
    );
    const privilegedPosition = source.indexOf('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');

    expect(gatePosition).toBeGreaterThan(-1);
    expect(privilegedPosition).toBeGreaterThan(gatePosition);
  });
});
