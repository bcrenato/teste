const CACHE='caixa-v11';
const SHELL=['./','index.html','app.css','app.js','manifest.json','caixa.png','caixa-mask.png','icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Abre do cache e atualiza em segundo plano (só arquivos do próprio app)
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(e.request,{ignoreSearch:true});
    const net=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);
    return hit||net;
  }));
});
// Push (FCM): a Cloud Function envia somente "data"
self.addEventListener('push',e=>{
  let p={};try{p=e.data?e.data.json():{}}catch(_){}
  const d=p.data||p;
  e.waitUntil(self.registration.showNotification(d.title||"Caixa d'Água",{
    body:d.body||'',icon:'icons/icon-192.png',badge:'icons/badge-96.png',tag:d.tag||'caixa',renotify:true,data:{url:d.url||'./'}
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    for(const c of l){if('focus' in c)return c.focus()}
    return clients.openWindow(e.notification.data.url||'./');
  }));
});
