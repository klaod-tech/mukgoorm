import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/webhook': 'https://n8n-production-9774.up.railway.app',
      '/webhook-test': 'https://n8n-production-9774.up.railway.app',
    },
  },
})
