import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages project site: https://<user>.github.io/truemafia/
  // GITHUB_PAGES=1 yoki VITE_BASE env bilan build qilinsa shu base ishlatiladi.
  base: process.env.VITE_BASE || (process.env.GITHUB_PAGES === '1' ? '/truemafia/' : '/'),
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
});
