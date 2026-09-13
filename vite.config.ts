import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Metric — Jurnal Nutrițional',
        short_name: 'Metric',
        description: 'Jurnal caloric offline-first, cu TDEE adaptiv',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Adăugare rapidă',
            short_name: 'Adaugă',
            description: 'Înregistrează rapid o masă sau aliment',
            url: '/?action=quicklog',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Căutare alimente',
            short_name: 'Caută',
            description: 'Caută în catalogul de alimente',
            url: '/?action=search',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Înregistrează greutatea',
            short_name: 'Greutate',
            description: 'Introdu greutatea de astăzi și verifică TDEE',
            url: '/?action=weight',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'off-api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
