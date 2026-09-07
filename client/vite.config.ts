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
  // Cindralux-Assets liegen ausserhalb von /client und werden unveraendert
  // unter /cindralux/... ausgeliefert — genau wie spaeter durch Express.
  publicDir: path.resolve(here, '../assets'),
  server: {
    port: 5173,
    // Entwicklung nur lokal; LAN-Zugriff über den geschützten Produktionsserver.
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.API_PORT ?? 4000}`,
        changeOrigin: false,
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
