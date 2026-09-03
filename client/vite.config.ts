import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
      '@shared': path.resolve(here, '../shared'),
    },
  },
  // Rubicon-Assets liegen ausserhalb von /client und werden unveraendert
  // unter /rubicon/... ausgeliefert — genau wie spaeter durch Express.
  publicDir: path.resolve(here, '../assets'),
  server: {
    port: 5173,
    // Damit das Dashboard im LAN auch vom Handy erreichbar ist.
    host: process.env.VITE_HOST ?? '127.0.0.1',
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.API_PORT ?? 4000}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Der Pi-Browser laedt lokal — Sourcemaps kosten nur Platz.
    sourcemap: false,
  },
});
