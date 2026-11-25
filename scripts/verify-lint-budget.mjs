import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budgetPath = resolve(projectRoot, '.lint-warning-budget.json');
const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
const eslint = new ESLint({
  cwd: projectRoot,
  overrideConfig: {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
});
const results = await eslint.lintFiles([
  'src/**/*.{ts,tsx}',
  'tests/**/*.{ts,tsx}',
  'supabase/functions/**/*.{ts,tsx}',
  'scripts/**/*.{ts,tsx}',
  'vite.config.ts',
]);

const errors = [];
const warningCounts = new Map();

for (const result of results) {
  for (const message of result.messages) {
    if (message.severity === 2) {
      errors.push({ filePath: result.filePath, ...message });
      continue;
    }

    if (message.severity === 1) {
      const ruleId = message.ruleId ?? '<unclassified>';
      warningCounts.set(ruleId, (warningCounts.get(ruleId) ?? 0) + 1);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(`ESLint reported ${errors.length} error(s):\n`);
  for (const error of errors) {
    const filePath = relative(projectRoot, error.filePath);
    process.stderr.write(
      `- ${filePath}:${error.line}:${error.column} ${error.message} (${error.ruleId ?? 'fatal'})\n`,
    );
  }
  process.exitCode = 1;
}

const configuredRules = budget.rules ?? {};
const configuredTotal = Object.values(configuredRules).reduce((sum, count) => sum + count, 0);
const actualTotal = [...warningCounts.values()].reduce((sum, count) => sum + count, 0);
const allRules = new Set([...Object.keys(configuredRules), ...warningCounts.keys()]);
const mismatches = [];

if (budget.version !== 1) {
  mismatches.push(`unsupported budget version ${String(budget.version)}`);
}
if (budget.total !== configuredTotal) {
  mismatches.push(
    `configured total ${String(budget.total)} does not equal the rule sum ${configuredTotal}`,
  );
}
if (actualTotal !== budget.total) {
  const direction = actualTotal > budget.total ? 'regression' : 'budget can be lowered';
  mismatches.push(`total: expected ${budget.total}, found ${actualTotal} (${direction})`);
}

for (const ruleId of [...allRules].sort()) {
  const expected = configuredRules[ruleId] ?? 0;
  const actual = warningCounts.get(ruleId) ?? 0;
  if (actual !== expected) {
    const direction = actual > expected ? 'regression' : 'budget can be lowered';
    mismatches.push(`${ruleId}: expected ${expected}, found ${actual} (${direction})`);
  }
}

if (mismatches.length > 0) {
  process.stderr.write('Lint warning budget mismatch:\n');
  for (const mismatch of mismatches) {
    process.stderr.write(`- ${mismatch}\n`);
  }
  process.stderr.write(
    'Update .lint-warning-budget.json only after reviewing the warning changes.\n',
  );
  process.exitCode = 1;
} else if (errors.length === 0) {
  const summary = [...warningCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ruleId, count]) => `${ruleId}=${count}`)
    .join(', ');
  const detail = summary ? ` (${summary})` : '';
  process.stdout.write(`Lint budget verified: ${actualTotal} warnings${detail}.\n`);
}
