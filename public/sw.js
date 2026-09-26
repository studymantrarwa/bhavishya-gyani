// V61 cleanup: remove the V59 performance service worker and its caches.
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    try { const keys=await caches.keys(); await Promise.all(keys.filter(k=>String(k).startsWith('bg-v')).map(k=>caches.delete(k))); } catch(e) {}
    try { await self.registration.unregister(); } catch(e) {}
    try { const clients=await self.clients.matchAll({type:'window'}); clients.forEach(c=>c.postMessage({type:'BG_SW_CLEANED'})); } catch(e) {}
  })());
});
