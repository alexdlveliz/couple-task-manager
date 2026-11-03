import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: false,
    includeAssets: ['manifest.webmanifest', 'icons/*.png', 'icons/*.svg'],
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/__\/auth(?:\/|$)/],
      runtimeCaching: [],
    },
  })],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { outDir: 'dist' },
});
