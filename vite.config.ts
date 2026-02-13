import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
