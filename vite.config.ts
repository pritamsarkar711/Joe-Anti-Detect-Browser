import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Build targets
 * -------------
 * `npm run build`          → dist/          web (absolute base) — Vercel/static
 * `npm run build:desktop`  → apps/desktop/web-dist   (base './') — file:// in Electron
 * `npm run build:android-ui` → dist-android (base './') — file:///android_asset
 *
 * A relative base is mandatory for the native shells: with the default '/'
 * base every <script src="/assets/..."> resolves to the filesystem root under
 * file://, the bundle never loads and the window stays blank white.
 *
 * `manualChunks` keeps the heavy, rarely-changing libraries in their own files
 * so a cold start parses the app shell first and the vendor files afterwards.
 */
const isDesktop = process.env.JOE_TARGET === 'desktop';
const isAndroid = process.env.JOE_TARGET === 'android';
const relativeBase = isDesktop || isAndroid;

export default defineConfig({
  plugins: [react()],
  base: relativeBase ? './' : '/',
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
  build: {
    outDir: isDesktop ? 'apps/desktop/web-dist' : isAndroid ? 'dist-android' : 'dist',
    emptyOutDir: true,
    target: 'chrome110',
    cssCodeSplit: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Generated data tables are large and never change at runtime: keep
          // them out of the app chunk so the shell parses fast on weak machines.
          if (id.includes('src/ui/flagData')) return 'flags';
          if (id.includes('packages/core/src/realFingerprints')) return 'fpdata';
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@mui/icons-material')) return 'icons';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
