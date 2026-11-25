import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { SITE_URL } from './site.config.js';
import { landingHtml, landingCss, publicFiles } from './site/build.js';
const site = new URL(SITE_URL);
const BASE = site.pathname.endsWith('/') ? site.pathname : site.pathname + '/';
// on your own domain, GitHub Pages needs a CNAME file naming it
const cname = () => ({ name: 'cname', apply: 'build', generateBundle() { if (!/github\.io$/.test(site.hostname)) this.emitFile({ type: 'asset', fileName: 'CNAME', source: site.hostname + '\n' }); } });
// AdSense's site check looks for its script in the page <head> (web only: ads inside the phone app are AdMob's job)
const adsense = () => ({ name: 'adsense', transformIndexHtml: () => (ADSENSE_CLIENT ? [{ tag: 'script', attrs: { async: true, src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`, crossorigin: 'anonymous', 'data-adsense': '1' }, injectTo: 'head' }] : []) });
// ads.txt: tells ad buyers this publisher ID is allowed to sell ads on this site
const adsTxt = () => ({ name: 'ads-txt', apply: 'build', generateBundle() { if (ADSENSE_CLIENT) this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${ADSENSE_CLIENT.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` }); } });
const ADSENSE_CLIENT = (readFileSync(new URL('./src/lib/config.js', import.meta.url), 'utf8').match(/ADSENSE_CLIENT = '([^']*)'/) || [])[1] || '';
const ADSENSE_SLOT = (readFileSync(new URL('./src/lib/config.js', import.meta.url), 'utf8').match(/ADSENSE_SLOT = '([^']*)'/) || [])[1] || '';
// the public website: a home page in index.html (shown until you sign in or start as a guest), plus recipe, guide and about pages
const publicSite = () => ({
  name: 'public-site',
  transformIndexHtml: (html) => html
    .replace('<meta name="robots" content="noindex" />', `<meta name="description" content="Plan the week, shop it in the fewest, cheapest stops, and cook it all at once. Free meal planner with shopping lists priced across your stores." />\n    <link rel="canonical" href="${SITE_URL}" />`)
    .replace('<div id="app"></div>', `<style>${landingCss()}</style>\n    ${landingHtml()}\n    <div id="app"></div>`),
  generateBundle() { for (const [fileName, source] of publicFiles({ site: SITE_URL, ads: { client: ADSENSE_CLIENT, slot: ADSENSE_SLOT } })) this.emitFile({ type: 'asset', fileName, source }); },
});
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const built = new Date().toISOString().slice(0, 10);
// the newest changelog entries, for the in-app "What's new" screen
const changelog = readFileSync(new URL('./CHANGELOG.md', import.meta.url), 'utf8').split(/^## /m).slice(1, 9).map((sec) => {
  const [head, ...rest] = sec.split('\n');
  const [version, date] = head.split(' — ');
  return { version: version.trim(), date: (date || '').trim(), notes: rest.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()) };
});

// `vite build --mode native` makes the copy that ships inside the iPhone/Android app (no service worker, relative paths)
export default defineConfig(({ mode }) => ({
  base: mode === 'native' ? './' : BASE,
  build: mode === 'native' ? { outDir: 'dist-native' } : {},
  define: { __NATIVE__: JSON.stringify(mode === 'native'), __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(built), __CHANGELOG__: JSON.stringify(changelog), __SITE_URL__: JSON.stringify(SITE_URL) },
  plugins: [
    svelte(),
    mode !== 'native' && cname(),
    mode !== 'native' && adsense(),
    mode !== 'native' && adsTxt(),
    mode !== 'native' && publicSite(),
    mode !== 'native' && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: "WFD — What's for Dinner", short_name: 'WFD', description: 'Plan the week, shop it in the fewest, cheapest stops, and cook it all at once.',
        theme_color: '#1f5fd1', background_color: '#f6f4ee', display: 'standalone', start_url: BASE, scope: BASE,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: BASE + 'index.html',
        runtimeCaching: [{ urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//, handler: 'CacheFirst', options: { cacheName: 'map-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 30 * 864e2 } } }]
      }
    })
  ].filter(Boolean)
}));
