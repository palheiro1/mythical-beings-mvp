import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  criticalCoverageFiles,
  evaluateCriticalCoverageSummary,
} from './critical-coverage-policy.mjs';

const summaryPath = fileURLToPath(new URL('../coverage/coverage-summary.json', import.meta.url));

let summary;
try {
  summary = JSON.parse(await readFile(summaryPath, 'utf8'));
} catch (error) {
  process.stderr.write(`Critical coverage verification could not read the report: ${error.message}\n`);
  process.exitCode = 1;
}

if (summary) {
  const findings = evaluateCriticalCoverageSummary(summary);
  if (findings.length > 0) {
    process.stderr.write('Critical per-file coverage policy failed:\n');
    for (const finding of findings) {
      process.stderr.write(
        `- ${finding.file}: ${finding.metric} expected >= ${finding.expected}%, found ${finding.actual}%\n`,
      );
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Critical per-file coverage verified: ${criticalCoverageFiles.length} files meet their minimums.\n`,
    );
  }
}
