import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'نظمني',
        short_name: 'نظمني',
        description: 'نظام شخصي لإدارة الدراسة الجامعية',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#1f4f78',
        background_color: '#f7f7f5',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  build: { outDir: '../../dist', emptyOutDir: true, sourcemap: true },
});
