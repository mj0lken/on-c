import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    target: 'esnext',
  },
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      // Required because the macOS workspace folder name `on:c` ("on/c" in Finder) contains `:`
      strict: false,
    },
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
