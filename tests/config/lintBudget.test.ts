import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface LintWarningBudget {
  version: number;
  total: number;
  rules: Record<string, number>;
}

describe('lint warning budget', () => {
  it('has a valid rule-by-rule total', () => {
    const budget = JSON.parse(
      readFileSync(resolve(process.cwd(), '.lint-warning-budget.json'), 'utf8'),
    ) as LintWarningBudget;
    const ruleTotal = Object.values(budget.rules).reduce((sum, count) => sum + count, 0);

    expect(budget.version).toBe(1);
    expect(budget.total).toBe(ruleTotal);
    expect(budget.total).toBeGreaterThanOrEqual(0);
    expect(Object.values(budget.rules).every(Number.isInteger)).toBe(true);
  });

  it('runs the exact budget gate in CI', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

    expect(packageJson.scripts['lint:ci']).toBe('node scripts/verify-lint-budget.mjs');
    expect(workflow).toContain('run: npm run lint:ci');
  });
});
