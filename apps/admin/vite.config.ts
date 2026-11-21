import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Admin app runs on a separate port from the marketing site (8791) to avoid
// collisions when both are running simultaneously.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    host: '127.0.0.1', // local-only; don't bind to 0.0.0.0
  },
});
