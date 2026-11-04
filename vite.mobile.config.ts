import { defineConfig } from 'vite';

export default defineConfig({
  root: 'mobile',
  base: './',
  publicDir: 'public',
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  build: { outDir: '../dist-mobile', emptyOutDir: true },
});
