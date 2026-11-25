import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isForbiddenPublicFile,
  scanPublicText,
} from '../../scripts/public-artifact-policy.mjs';

const jwt = (role: string) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'),
  'signature-for-policy-test',
].join('.');

describe('public artifact policy', () => {
  it('rejects sourcemaps, environment files, and private-key files', () => {
    expect(isForbiddenPublicFile('assets/index.js.map')).toBe(true);
    expect(isForbiddenPublicFile('.env.production')).toBe(true);
    expect(isForbiddenPublicFile('credentials/deploy.pem')).toBe(true);
    expect(isForbiddenPublicFile('images/card.webp')).toBe(false);
  });

  it('detects server-only names, private keys, and source-map references', () => {
    expect(scanPublicText('index.js', 'SUPABASE_SERVICE_ROLE_KEY')).toContainEqual({
      relativePath: 'index.js',
      kind: 'server_secret_name',
    });
    expect(scanPublicText('index.js', '-----BEGIN PRIVATE KEY-----')).toContainEqual({
      relativePath: 'index.js',
      kind: 'private_key_material',
    });
    expect(scanPublicText('index.js', '//# sourceMappingURL=index.js.map')).toContainEqual({
      relativePath: 'index.js',
      kind: 'source_map_reference',
    });
  });

  it('rejects a service-role JWT while allowing an anonymous-role JWT', () => {
    expect(scanPublicText('index.js', jwt('service_role'))).toContainEqual({
      relativePath: 'index.js',
      kind: 'service_role_jwt',
    });
    expect(scanPublicText('index.js', jwt('anon'))).toEqual([]);
  });

  it('runs after the production build in CI', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    const buildPosition = workflow.indexOf('run: npm run build');
    const artifactPosition = workflow.indexOf('run: npm run verify:public-artifact');

    expect(packageJson.scripts['verify:public-artifact']).toBe(
      'node scripts/verify-public-artifact.mjs',
    );
    expect(buildPosition).toBeGreaterThan(-1);
    expect(artifactPosition).toBeGreaterThan(buildPosition);
  });
});
