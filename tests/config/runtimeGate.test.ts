import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  expectedNodeEngine,
  expectedNvmVersion,
  isSupportedNodeVersion,
  parseNodeVersion,
} from '../../scripts/runtime-policy.mjs';

const rootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('runtime policy', () => {
  it('accepts the supported Node 22 and 24 lines', () => {
    expect(isSupportedNodeVersion('22.13.0')).toBe(true);
    expect(isSupportedNodeVersion('v22.22.2')).toBe(true);
    expect(isSupportedNodeVersion('24.0.0')).toBe(true);
    expect(isSupportedNodeVersion('24.99.99')).toBe(true);
  });

  it('rejects old, odd, future, and malformed Node versions', () => {
    expect(isSupportedNodeVersion('22.12.99')).toBe(false);
    expect(isSupportedNodeVersion('23.11.1')).toBe(false);
    expect(isSupportedNodeVersion('25.0.0')).toBe(false);
    expect(isSupportedNodeVersion('not-a-version')).toBe(false);
    expect(parseNodeVersion('22.13')).toBeNull();
  });

  it('keeps package, nvm, and CI pins aligned', () => {
    const packageJson = JSON.parse(rootFile('package.json'));
    const workflow = rootFile('.github/workflows/ci.yml');

    expect(packageJson.engines.node).toBe(expectedNodeEngine);
    expect(rootFile('.nvmrc').trim()).toBe(expectedNvmVersion);
    expect(workflow).toContain('node-version-file: .nvmrc');
    expect(workflow).toContain('run: node scripts/verify-runtime.mjs');
  });

  it('checks runtime before developer entry points', () => {
    const scripts = JSON.parse(rootFile('package.json')).scripts;

    expect(scripts['check:runtime']).toBe('node scripts/verify-runtime.mjs');
    expect(scripts.predev).toBe('npm run check:runtime');
    expect(scripts.prebuild).toBe('npm run check:runtime');
    expect(scripts.pretest).toBe('npm run check:runtime');
    expect(scripts['pretest:coverage']).toBe('npm run check:runtime');
  });
});
