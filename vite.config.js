import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api/chart': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api/broker': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api/nse': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api/fno-agent': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api/config': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
