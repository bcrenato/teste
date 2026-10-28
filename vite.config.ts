import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Force esbuild instead of Rolldown for minification
    minify: 'esbuild',
    // Reduce memory usage
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
  },
  // Try to use esbuild for more operations
  esbuild: {
    target: 'es2020',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'chart.js', 'react-chartjs-2', 'date-fns'],
  },
})