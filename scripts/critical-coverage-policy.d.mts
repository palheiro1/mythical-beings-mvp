export interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageMetrics {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

export interface CoverageFinding {
  file: string;
  metric: string;
  expected: number;
  actual: number;
}

export const criticalCoverageFiles: readonly string[];
export const perFileCoverageThresholds: Readonly<Record<keyof CoverageMetrics, number>>;
export function evaluateCriticalCoverageSummary(
  summary: Record<string, CoverageMetrics>,
): CoverageFinding[];
