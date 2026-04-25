import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '0.0.0'),
  },
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: { name: `gratonite-web@${process.env.npm_package_version || '0.0.0'}` },
        })]
      : []),
  ],
  base: '/app/',
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: mode === 'analyze' ? true : 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', '@tanstack/react-virtual'],
          'vendor-socket': ['socket.io-client'],
          'vendor-livekit': ['livekit-client'],
          'vendor-icons': ['lucide-react'],
          'vendor-motion': ['framer-motion'],
          'vendor-code': ['dompurify'],
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
