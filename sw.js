const CACHE = 'daurela-20261002-almacen-clientes-formatos';
const ASSETS = ['/Daurela/'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push',event=>{
  let data={};try{data=event.data.json();}catch(e){}
  event.waitUntil(self.registration.showNotification(data.title||'Daurela · Materiales',{body:data.body||'Revisa los materiales que necesitan reposición.',tag:data.tag||'materiales-bajos',data:{url:'/Daurela/#materiales'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const current=clients.find(c=>new URL(c.url).origin===self.location.origin&&new URL(c.url).pathname.startsWith('/Daurela/'));
    if(current){await current.focus();current.postMessage({type:'abrir-materiales'});}else await self.clients.openWindow('/Daurela/#materiales');
  }));
});
