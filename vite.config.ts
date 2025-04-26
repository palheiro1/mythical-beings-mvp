/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // or 'node' depending on your tests
    setupFiles: [], // Add setup files if needed, e.g., './tests/setup.ts'
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'], // Ensure it finds TS test files
  },
})
