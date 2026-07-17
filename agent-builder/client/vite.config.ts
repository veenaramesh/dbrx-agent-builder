import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // Base path: GitHub Pages serves under /dbrx-agent-builder/, but the
  // Databricks App serves the client at the root. Override with VITE_BASE
  // (the App build sets VITE_BASE=/ — see scripts/build.sh).
  const base =
    process.env.VITE_BASE ??
    (process.env.NODE_ENV === 'production' ? '/dbrx-agent-builder/' : '/');
  return {
    base,
    server: {
      port: 3001,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
