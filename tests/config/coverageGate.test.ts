import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  criticalCoverageFiles,
  evaluateCriticalCoverageSummary,
  perFileCoverageThresholds,
  type CoverageMetrics,
} from '../../scripts/critical-coverage-policy.mjs';

const rootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('critical coverage gate', () => {
  it('uses the pinned V8 provider through the dedicated config', () => {
    const packageJson = JSON.parse(rootFile('package.json'));
    const coverageScript = packageJson.scripts['test:coverage'] as string;

    expect(packageJson.devDependencies['@vitest/coverage-v8']).toBe('3.2.6');
    expect(coverageScript).toContain('--config vitest.coverage.config.ts');
    expect(coverageScript).toContain('--coverage.enabled');
    expect(coverageScript).toContain('--coverage.reporter=text');
    expect(coverageScript).toContain('--coverage.reporter=json-summary');
    expect(coverageScript).toContain('node scripts/verify-critical-coverage.mjs');
  });

  it('covers the release gate and authoritative boundary', () => {
    const requiredFiles = [
      'src/config/release.ts',
      'src/game/authoritativeClient.ts',
      'src/game/authoritativeHttp.ts',
      'src/game/authoritativePersistence.ts',
      'src/game/durableAuthoritativeService.ts',
      'src/game/invariants.ts',
      'src/game/protocol.ts',
      'src/game/replay.ts',
    ];

    for (const file of requiredFiles) {
      expect(criticalCoverageFiles).toContain(file);
    }
    expect(criticalCoverageFiles).toHaveLength(18);
  });

  it('sets global, per-file, and release-specific thresholds', () => {
    const coverageConfig = rootFile('vitest.coverage.config.ts');

    expect(coverageConfig).toMatch(/statements: 86,[\s\S]*branches: 80,[\s\S]*functions: 95,[\s\S]*lines: 86/);
    expect(coverageConfig).toMatch(/'src\/config\/release\.ts': \{\s*100: true/);
    expect(perFileCoverageThresholds).toEqual({
      statements: 70,
      branches: 65,
      functions: 75,
      lines: 70,
    });
  });

  it('rejects a missing critical file and a per-file regression', () => {
    const metric = (pct: number) => ({ total: 100, covered: pct, skipped: 0, pct });
    const metrics = (pct: number): CoverageMetrics => ({
      lines: metric(pct),
      statements: metric(pct),
      functions: metric(pct),
      branches: metric(pct),
    });
    const summary = Object.fromEntries([
      ['total', metrics(100)],
      ...criticalCoverageFiles.map((file) => [`/workspace/${file}`, metrics(100)]),
    ]);

    delete summary['/workspace/src/game/replay.ts'];
    summary['/workspace/src/game/invariants.ts'].branches.pct = 64.99;

    expect(evaluateCriticalCoverageSummary(summary)).toEqual(expect.arrayContaining([
      { file: 'src/game/replay.ts', metric: 'present', expected: 1, actual: 0 },
      { file: 'src/game/invariants.ts', metric: 'branches', expected: 65, actual: 64.99 },
    ]));
  });

  it('runs the coverage gate in CI instead of an unmeasured duplicate suite', () => {
    const workflow = rootFile('.github/workflows/ci.yml');

    expect(workflow).toContain('run: npm run test:coverage');
    expect(workflow).not.toContain('run: npm test -- --run --silent');
  });
});
