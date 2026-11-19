import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 0.0.0.0 + allowedHosts so the Arena live-preview proxy can reach the server.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
