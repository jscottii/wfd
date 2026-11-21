import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const built = new Date().toISOString().slice(0, 10);

// `vite build --mode native` makes the copy that ships inside the iPhone/Android app (no service worker, relative paths)
export default defineConfig(({ mode }) => ({
  base: mode === 'native' ? './' : '/wfd/',
  build: mode === 'native' ? { outDir: 'dist-native' } : {},
  define: { __NATIVE__: JSON.stringify(mode === 'native'), __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(built) },
  plugins: [
    svelte(),
    mode !== 'native' && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: "WFD — What's for Dinner", short_name: 'WFD', description: 'Plan the week, shop it in the fewest, cheapest stops, and cook it all at once.',
        theme_color: '#1f5fd1', background_color: '#f6f4ee', display: 'standalone', start_url: '/wfd/', scope: '/wfd/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/wfd/index.html',
        runtimeCaching: [{ urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//, handler: 'CacheFirst', options: { cacheName: 'map-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 30 * 864e2 } } }]
      }
    })
  ].filter(Boolean)
}));
