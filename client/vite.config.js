import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app (port 5173) forwards /api calls to the Express server (port 5000),
// so there are no CORS problems and no URLs to configure.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:5001', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 700 },
});
