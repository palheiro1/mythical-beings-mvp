/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import nodePolyfillsPlugin from 'rollup-plugin-polyfill-node'

// https://vite.dev/config/
export default defineConfig({
  root: './',
  plugins: [
    react(),
    nodePolyfillsPlugin({
      include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto']
    })
  ],
  define: {
    'global': 'globalThis',
    'process.env': {}
  },
  resolve: {
    alias: {
      process: 'process/browser',
      stream: 'stream-browserify',
      util: 'util'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/utils/testHelpers.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
