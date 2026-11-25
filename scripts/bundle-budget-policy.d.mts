export interface BundleMeasurements {
  initialJavaScriptGzipBytes: number;
  largestJavaScriptChunkGzipBytes: number;
  initialCssGzipBytes: number;
  initialJavaScriptFiles: number;
  initialCssFiles: number;
}

export interface BundleBudgets {
  initialJavaScriptGzipBytes: number;
  largestJavaScriptChunkGzipBytes: number;
  initialCssGzipBytes: number;
}

export interface BundleBudgetFinding {
  metric: string;
  actual: number;
  expected: number;
}

export const bundleBudgets: Readonly<BundleBudgets>;
export function findForbiddenInitialJavaScript(paths: readonly string[]): string[];
export function evaluateBundleMeasurements(
  measurements: BundleMeasurements,
  budgets?: BundleBudgets,
): BundleBudgetFinding[];
