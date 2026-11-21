import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le même build sert au navigateur et à l'application de bureau.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
