/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  root: './',
  esbuild: command === 'build'
    ? { drop: ['console', 'debugger'] }
    : undefined,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(process.env.COMMIT_REF ?? process.env.GITHUB_SHA ?? process.env.VITE_BUILD_SHA ?? 'local'),
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@mythical/ardor-core': '@mythicalb/ardor-core',
    },
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
            return 'vendor-react'
          }

          if (id.includes('/@supabase/') || id.includes('/supabase/')) {
            return 'vendor-supabase'
          }

          if (id.includes('/viem/') || id.includes('/ox/')) {
            return 'vendor-web3'
          }

          if (id.includes('/@noble/') || id.includes('/@scure/')) {
            return 'vendor-crypto'
          }

          if (id.includes('/@mythicalb/')) {
            return 'vendor-mythical'
          }

          if (id.includes('/lucide-react/')) {
            return 'vendor-icons'
          }

          return 'vendor'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/utils/testHelpers.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
}))
