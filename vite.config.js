import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // path relatif: aman untuk GitHub Pages / Netlify
  build: { outDir: 'dist', chunkSizeWarningLimit: 1000 },
  server: { host: true },
});
