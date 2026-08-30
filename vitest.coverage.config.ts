import { defineConfig, mergeConfig } from 'vitest/config';
import vitestConfig from './vitest.config.js';
import { criticalCoverageFiles } from './scripts/critical-coverage-policy.mjs';

export default defineConfig(() => (
  mergeConfig(vitestConfig, {
    test: {
      coverage: {
        provider: 'v8',
        reportsDirectory: 'coverage',
        include: criticalCoverageFiles,
        thresholds: {
          statements: 86,
          branches: 80,
          functions: 95,
          lines: 86,
          'src/config/release.ts': {
            100: true,
          },
        },
      },
    },
  })
));
