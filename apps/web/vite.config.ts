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
        manualChunks: (id) => {
          if (id.includes('node_modules/.pnpm/')) {
            const match = id.match(/node_modules\/\.pnpm\/([^/]+)/);
            const pkgFolder = match?.[1] || '';
            if (pkgFolder.startsWith('gsap@')) return 'vendor-gsap';
            if (pkgFolder.startsWith('@sentry')) return 'vendor-sentry';
            if (pkgFolder.startsWith('@sentry-internal')) return 'vendor-sentry';
            if (pkgFolder.startsWith('react@') || pkgFolder.startsWith('react-dom@') ||
                pkgFolder.startsWith('react-router-dom@') ||
                pkgFolder.startsWith('@tanstack+react-query') ||
                pkgFolder.startsWith('@tanstack+react-virtual')) return 'vendor-react';
            if (pkgFolder.startsWith('socket.io-client')) return 'vendor-socket';
            if (pkgFolder.startsWith('livekit-client')) return 'vendor-livekit';
            if (pkgFolder.startsWith('lucide-react')) return 'vendor-icons';
            if (pkgFolder.startsWith('framer-motion')) return 'vendor-motion';
            if (pkgFolder.startsWith('dompurify')) return 'vendor-code';
          }
          return undefined;
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
