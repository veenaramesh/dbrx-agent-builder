import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: process.env.NODE_ENV === 'production' ? '/dbrx-agent-builder/' : '/',
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:8001',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
