import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5200,
    open: true,
    proxy: {
      '/api/gdelt': {
        target: 'https://api.gdeltproject.org',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/gdelt/, '/api/v2/doc/doc'),
      },
    },
  },
});
