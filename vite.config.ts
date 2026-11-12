/// <reference types="vitest" />
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss(),],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        proComparisonPreview: resolve(__dirname, 'pro-comparison-preview.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
  },
})
