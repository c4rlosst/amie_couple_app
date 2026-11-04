const CACHE='amie-shell-v3';
const scoped=(path)=>new URL(path,self.registration.scope).href;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([scoped('offline.html'),scoped('icon-192.png')])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('amie-shell-')&&k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'&&event.request.url.startsWith(self.registration.scope)){event.respondWith(fetch(event.request).catch(()=>caches.match(scoped('offline.html'))));}});
