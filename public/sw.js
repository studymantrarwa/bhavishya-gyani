// V60: disable the previous performance service worker.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  try{const keys=await caches.keys();await Promise.all(keys.filter(k=>String(k).startsWith('bg-v')).map(k=>caches.delete(k)))}catch(e){}
  try{await self.registration.unregister()}catch(e){}
})()));
self.addEventListener('fetch',()=>{});
