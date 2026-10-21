import { defineConfig, mergeConfig } from 'vitest/config';
import vitestConfig from './vitest.config.js';
import { criticalCoverageFiles } from './scripts/critical-coverage-policy.mjs';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

// V8's provider deliberately discards every node_modules URL. Measure an exact
// copy of the installed release bytes so the original engine coverage gate is
// preserved after extraction. This alias is used only by the coverage suite.
const engineCoverageRoot = resolve('.coverage-engine');
cpSync(resolve('node_modules/@mythicalb/wisdom-duel-engine/dist'), engineCoverageRoot, { recursive: true });

export default defineConfig(() => (
  mergeConfig(vitestConfig, {
    resolve: {
      alias: [
        { find: /^@mythicalb\/wisdom-duel-engine\/(.+)$/, replacement: `${engineCoverageRoot}/game/$1.js` },
        { find: /^@mythicalb\/wisdom-duel-engine$/, replacement: `${engineCoverageRoot}/index.js` },
      ],
    },
    test: {
      coverage: {
        provider: 'v8',
        // The extracted package is exercised by the original tactical and authority tests.
        exclude: [],
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
