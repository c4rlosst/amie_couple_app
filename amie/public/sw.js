const CACHE='amie-shell-v4';
const scoped=(path)=>new URL(path,self.registration.scope).href;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([scoped('offline.html'),scoped('icon-192.png')])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('amie-shell-')&&k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'&&event.request.url.startsWith(self.registration.scope)){event.respondWith(fetch(event.request).catch(()=>caches.match(scoped('offline.html'))));}});

self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  const options={body:typeof data.body==='string'?data.body:'You have a new update from your person.',icon:scoped('icon-192.png'),badge:scoped('icon-192.png'),tag:typeof data.tag==='string'?data.tag:'amie-update',data:{tab:'messages'}};
  event.waitUntil(self.registration.showNotification('Amie',options).then(async()=>{for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(client.url.startsWith(self.registration.scope))client.postMessage({type:'AMIE_PUSH'});}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=scoped('#messages');
    for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
      if(client.url.startsWith(self.registration.scope)){client.postMessage({type:'AMIE_OPEN_MESSAGES'});await client.focus();return;}
    }
    await self.clients.openWindow(target);
  })());
});
