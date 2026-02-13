import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173,
    },
    proxy: {
      '/bible-api': {
        target: 'https://bible.helloao.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/bible-api/, ''),
      },
    },
  },
})
