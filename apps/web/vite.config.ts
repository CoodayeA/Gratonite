import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const devPort = Number(process.env.VITE_DEV_PORT ?? process.env.PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: devPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        redirect: './public/redirect.html',
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          state: ['zustand', '@tanstack/react-query'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
});
