import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        redirect: './public/redirect.html',
      },
    },
  },
});
