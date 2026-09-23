const CACHE="bg-v12";
const STATIC=["/chat.html","/kundli-form.html","/tools.html","/my-kundlis.html","/index.html","/style.css","/supabase-client.js","/auth-guard.js","/performance-boost.js"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC).catch(()=>{})))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
 if(e.request.mode==="navigate"){
   e.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(e.request)||await cache.match(new URL(u.origin+u.pathname));
     const network=fetch(e.request,{cache:"no-store"}).then(r=>{if(r.ok)cache.put(e.request,r.clone());return r}).catch(()=>null);
     if(cached){network.catch(()=>{});return cached;}
     const r=await network;
     if(r)return r;
     return new Response("Offline",{status:503,headers:{"Content-Type":"text/plain"}});
   })());
   return;
 }
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&u.pathname!="/sw.js")caches.open(CACHE).then(c=>c.put(e.request,r.clone())).catch(()=>{});return r}).catch(()=>caches.match(e.request)));
});
