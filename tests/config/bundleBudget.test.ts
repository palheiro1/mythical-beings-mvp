import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bundleBudgets,
  evaluateBundleMeasurements,
  findForbiddenInitialJavaScript,
  type BundleMeasurements,
} from '../../scripts/bundle-budget-policy.mjs';

const rootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const withinBudget: BundleMeasurements = {
  initialJavaScriptGzipBytes: 110 * 1024,
  largestJavaScriptChunkGzipBytes: 80 * 1024,
  initialCssGzipBytes: 20 * 1024,
  initialJavaScriptFiles: 1,
  initialCssFiles: 1,
};

describe('bundle budget', () => {
  it('keeps an explicit initial-load baseline', () => {
    expect(bundleBudgets).toEqual({
      initialJavaScriptGzipBytes: 110 * 1024,
      largestJavaScriptChunkGzipBytes: 80 * 1024,
      initialCssGzipBytes: 20 * 1024,
    });
    expect(evaluateBundleMeasurements(withinBudget)).toEqual([]);
  });

  it('keeps auth, wallet, and blockchain SDK chunks out of the initial path', () => {
    expect(findForbiddenInitialJavaScript([
      '/assets/index-abc.js',
      '/assets/vendor-react-def.js',
    ])).toEqual([]);
    expect(findForbiddenInitialJavaScript([
      '/assets/vendor-supabase-one.js',
      '/assets/vendor-web3-two.js',
      '/assets/mythicalClient-three.js',
    ])).toEqual([
      '/assets/vendor-supabase-one.js',
      '/assets/vendor-web3-two.js',
      '/assets/mythicalClient-three.js',
    ]);
  });

  it('rejects regressions and missing entry assets', () => {
    expect(evaluateBundleMeasurements({
      ...withinBudget,
      initialJavaScriptGzipBytes: bundleBudgets.initialJavaScriptGzipBytes + 1,
      largestJavaScriptChunkGzipBytes: bundleBudgets.largestJavaScriptChunkGzipBytes + 1,
      initialCssGzipBytes: bundleBudgets.initialCssGzipBytes + 1,
      initialJavaScriptFiles: 0,
      initialCssFiles: 0,
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'initial_javascript_gzip' }),
      expect.objectContaining({ metric: 'largest_javascript_chunk_gzip' }),
      expect.objectContaining({ metric: 'initial_css_gzip' }),
      expect.objectContaining({ metric: 'initial_javascript_files' }),
      expect.objectContaining({ metric: 'initial_css_files' }),
    ]));
  });

  it('runs immediately after the production build in CI', () => {
    const packageJson = JSON.parse(rootFile('package.json'));
    const workflow = rootFile('.github/workflows/ci.yml');
    const buildPosition = workflow.indexOf('run: npm run build');
    const budgetPosition = workflow.indexOf('run: npm run verify:bundle-budget');
    const artifactPosition = workflow.indexOf('run: npm run verify:public-artifact');

    expect(packageJson.scripts['verify:bundle-budget']).toBe(
      'node scripts/verify-bundle-budget.mjs',
    );
    expect(budgetPosition).toBeGreaterThan(buildPosition);
    expect(artifactPosition).toBeGreaterThan(budgetPosition);
  });
});
