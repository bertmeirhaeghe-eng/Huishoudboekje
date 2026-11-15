import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' zodat de app ook in een submap werkt (bv. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
});
