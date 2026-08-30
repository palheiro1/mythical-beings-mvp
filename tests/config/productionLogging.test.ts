import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production logging policy', () => {
  it('removes console calls and debugger statements only from production builds', () => {
    const source = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(source).toContain("command === 'build'");
    expect(source).toContain("drop: ['console', 'debugger']");
  });

  it('keeps observability explicitly opt-in', () => {
    const example = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    expect(example).toContain('VITE_OBSERVABILITY_ENABLED=false');
    expect(example).toContain('VITE_OBSERVABILITY_ENDPOINT=');
  });

  it('gates first-party production chunks in CI', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    expect(packageJson.scripts['verify:production-logging']).toBe('node scripts/verify-production-logging.mjs');
    expect(workflow).toContain('npm run verify:production-logging');
  });
});
