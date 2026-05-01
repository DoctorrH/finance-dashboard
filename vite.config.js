import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api/dchart': {
        target: 'https://dchart-api.vndirect.com.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dchart/, '/dchart')
      },
      '/api/giavang-now': {
        target: 'https://giavang.now',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/giavang-now/, '')
      },
      '/api/sjc': {
        target: 'https://sjc.com.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sjc/, '')
      },
      '/api/tygia': {
        target: 'https://tygia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tygia/, '')
      },
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, '')
      }
    }
  }
})
