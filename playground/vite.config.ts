import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    // Don't pre-bundle WASM package to avoid issues with binary loading
    exclude: ['@picoruby/wasm-wasi'],
  },
  worker: {
    format: 'es',
  },
});
