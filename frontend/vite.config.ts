import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to the Express backend so the app is same-origin
// in development, exactly as it is behind nginx in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { leaflet: ['leaflet'], react: ['react', 'react-dom'] }
      }
    }
  }
});
