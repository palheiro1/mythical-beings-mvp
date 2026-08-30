export const criticalCoverageFiles = [
  'src/config/release.ts',
  'src/game/authoritativeClient.ts',
  'src/game/authoritativeClientHttpTransport.ts',
  'src/game/authoritativeExecutor.ts',
  'src/game/authoritativeHttp.ts',
  'src/game/authoritativeHttpShared.ts',
  'src/game/authoritativeInitialization.ts',
  'src/game/authoritativeOperations.ts',
  'src/game/authoritativePersistence.ts',
  'src/game/authoritativeProjectionHttp.ts',
  'src/game/authoritativeRateLimit.ts',
  'src/game/durableAuthoritativeService.ts',
  'src/game/invariants.ts',
  'src/game/projectionWire.ts',
  'src/game/projections.ts',
  'src/game/protocol.ts',
  'src/game/random.ts',
  'src/game/replay.ts',
];

export const perFileCoverageThresholds = {
  statements: 70,
  branches: 65,
  functions: 75,
  lines: 70,
};

const releaseCoverageThresholds = {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
};

const normalizedPath = (path) => path.replaceAll('\\', '/');

const findFileMetrics = (summary, relativePath) => {
  const suffix = `/${normalizedPath(relativePath)}`;
  return Object.entries(summary).find(([path]) => (
    path !== 'total'
    && (normalizedPath(path) === normalizedPath(relativePath) || normalizedPath(path).endsWith(suffix))
  ))?.[1];
};

export const evaluateCriticalCoverageSummary = (summary) => {
  const findings = [];

  if (!summary || typeof summary !== 'object' || !summary.total) {
    return [{ file: '<report>', metric: 'summary', expected: 1, actual: 0 }];
  }

  for (const relativePath of criticalCoverageFiles) {
    const metrics = findFileMetrics(summary, relativePath);
    if (!metrics) {
      findings.push({ file: relativePath, metric: 'present', expected: 1, actual: 0 });
      continue;
    }

    const thresholds = relativePath === 'src/config/release.ts'
      ? releaseCoverageThresholds
      : perFileCoverageThresholds;

    for (const [metric, expected] of Object.entries(thresholds)) {
      const actual = metrics[metric]?.pct;
      if (typeof actual !== 'number' || actual < expected) {
        findings.push({
          file: relativePath,
          metric,
          expected,
          actual: typeof actual === 'number' ? actual : 0,
        });
      }
    }
  }

  return findings;
};
