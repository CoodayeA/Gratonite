import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/app/',
  build: {
    // Enable source maps in analyze mode for bundle visualizer
    sourcemap: mode === 'analyze',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', '@tanstack/react-virtual'],
          'vendor-socket': ['socket.io-client'],
          'vendor-livekit': ['livekit-client'],
          'vendor-icons': ['lucide-react'],
          'vendor-motion': ['framer-motion'],
          'vendor-code': ['highlight.js', 'dompurify'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api.gratonite.chat',
        changeOrigin: true,
        secure: true,
      },
      '/socket.io': {
        target: 'https://api.gratonite.chat',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
}))
