import { defineConfig } from 'vite';

export default defineConfig({
  base: '/econ-archipelago/',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
