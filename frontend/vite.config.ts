import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // allow access from other devices on the LAN (e.g. phone)
    port: 5173,
    proxy: {
      // Proxy API calls to the Django backend in dev (avoids CORS).
      // Frontend calls same-origin /api/... and Vite forwards to the backend.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Static/media served by Django in DEBUG mode.
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
