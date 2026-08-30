import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isMultiplayerReleaseEnabled,
  MULTIPLAYER_DISABLED_CODE,
  MULTIPLAYER_DISABLED_MESSAGE,
  MULTIPLAYER_RELEASE_FLAG,
} from '../../supabase/functions/_shared/releaseGate.js';

describe('server-side multiplayer release gate', () => {
  it.each([undefined, null, '', 'false', '0', 'yes'])('defaults %s to disabled', (value) => {
    expect(isMultiplayerReleaseEnabled(value)).toBe(false);
  });

  it('only accepts an explicit true value', () => {
    expect(isMultiplayerReleaseEnabled('true')).toBe(true);
    expect(isMultiplayerReleaseEnabled(' TRUE ')).toBe(true);
  });

  it('uses the stable release contract expected by the client', () => {
    expect(MULTIPLAYER_RELEASE_FLAG).toBe('WISDOM_DUEL_PVP_ENABLED');
    expect(MULTIPLAYER_DISABLED_CODE).toBe('multiplayer_disabled');
    expect(MULTIPLAYER_DISABLED_MESSAGE).toContain('Training Preview');
  });

  it('checks the gate before reading the service-role credential', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/deal-cards/index.ts'),
      'utf8',
    );
    const gatePosition = source.indexOf('isMultiplayerReleaseEnabled(Deno.env.get(MULTIPLAYER_RELEASE_FLAG))');
    const serviceRolePosition = source.indexOf('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');

    expect(gatePosition).toBeGreaterThan(-1);
    expect(serviceRolePosition).toBeGreaterThan(gatePosition);
  });

  it('keeps platform JWT verification enabled for the user-authenticated function', () => {
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    expect(config).toMatch(/\[functions\.deal-cards\][\s\S]*?verify_jwt\s*=\s*true/);
  });
});
