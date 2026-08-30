export const bundleBudgets = {
  initialJavaScriptGzipBytes: 110 * 1024,
  largestJavaScriptChunkGzipBytes: 80 * 1024,
  initialCssGzipBytes: 20 * 1024,
};

const forbiddenInitialJavaScriptMarkers = [
  'mythicalClient-',
  'playHubAuthService-',
  'playHubWalletService-',
  'vendor-crypto-',
  'vendor-mythical-',
  'vendor-supabase-',
  'vendor-web3-',
];

export const findForbiddenInitialJavaScript = (paths) => paths.filter((path) => (
  forbiddenInitialJavaScriptMarkers.some((marker) => path.includes(marker))
));

export const evaluateBundleMeasurements = (measurements, budgets = bundleBudgets) => {
  const findings = [];
  const checks = [
    ['initial_javascript_gzip', measurements.initialJavaScriptGzipBytes, budgets.initialJavaScriptGzipBytes],
    ['largest_javascript_chunk_gzip', measurements.largestJavaScriptChunkGzipBytes, budgets.largestJavaScriptChunkGzipBytes],
    ['initial_css_gzip', measurements.initialCssGzipBytes, budgets.initialCssGzipBytes],
  ];

  for (const [metric, actual, expected] of checks) {
    if (!Number.isFinite(actual) || actual < 0 || actual > expected) {
      findings.push({ metric, actual, expected });
    }
  }

  if (!Number.isInteger(measurements.initialJavaScriptFiles) || measurements.initialJavaScriptFiles < 1) {
    findings.push({ metric: 'initial_javascript_files', actual: measurements.initialJavaScriptFiles, expected: 1 });
  }
  if (!Number.isInteger(measurements.initialCssFiles) || measurements.initialCssFiles < 1) {
    findings.push({ metric: 'initial_css_files', actual: measurements.initialCssFiles, expected: 1 });
  }

  return findings;
};
