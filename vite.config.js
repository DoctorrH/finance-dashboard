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
      '/api/finfo': {
        target: 'https://finfo-api.vndirect.com.vn',
        changeOrigin: true,
        headers: {
          'Referer': 'https://dchart.vndirect.com.vn/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/api\/finfo/, '/v4')
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
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://finance.yahoo.com/'
        },
        rewrite: (path) => path.replace(/^\/api\/yahoo/, '')
      }
    }
  }
})
