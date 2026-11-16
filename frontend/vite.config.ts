import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react() as any],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: { '/api': { target: 'http://backend:8000', changeOrigin: true } },
  },
  preview: {
    allowedHosts: ['frontend', 'localhost'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/api/client.ts',
        'src/store/useAuthStore.ts',
        'src/routes/index.tsx',
        'src/types/domain.ts',
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 60 },
      exclude: ['src/test/**'],
    },
  },
});
