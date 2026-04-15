import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CRITICAL: base MUST be './' (relative). See CONTEXT.md D-06 and
// 01-RESEARCH.md Pitfall 1. An absolute '/' breaks every asset under
// HA ingress because the browser requests from the HA host root, not
// from the ingress token URL.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsDir: 'assets',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
