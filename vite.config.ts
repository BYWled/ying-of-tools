import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// 跨源隔离头：解锁 SharedArrayBuffer → ffmpeg core-mt 多线程可用。
// 部署到 Cloudflare Pages 时使用 public/_headers 中同样的配置。
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: {
    exclude: ['@jsquash/avif', '@jsquash/webp', '@jsquash/jpeg', '@jsquash/oxipng', '@jsquash/png', '@jsquash/jxl'],
  },
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
})
