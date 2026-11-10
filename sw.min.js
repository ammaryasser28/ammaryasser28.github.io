// The old site (Jekyll + Chirpy) installed a service worker that keeps showing its saved pages.
// This one replaces it: it deletes every saved copy, removes itself, and reloads open tabs onto the new site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: 'window' });
    tabs.forEach((tab) => tab.navigate(tab.url));
  })());
});
