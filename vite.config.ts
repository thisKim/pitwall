import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the build also loads from file:// inside Electron.
  base: './',
  server: { port: 5173 },
});
