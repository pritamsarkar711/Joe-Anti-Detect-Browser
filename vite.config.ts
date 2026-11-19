import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@joe/core': r('./packages/core/src/index.ts'),
      '@joe/fingerprint': r('./packages/fingerprint/src/index.ts'),
      '@joe/sync': r('./packages/sync/src/index.ts'),
      '@': r('./src'),
    },
  },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
