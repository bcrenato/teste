/* ============ CONFIG ============ */
const firebaseConfig={
  apiKey:"AIzaSyCQipZjlc86GtZGx3_aoyCT-jDrZ1oYyYM",
  authDomain:"monitor-caixa-agua-ff63a.firebaseapp.com",
  databaseURL:"https://monitor-caixa-agua-ff63a-default-rtdb.firebaseio.com",
  projectId:"monitor-caixa-agua-ff63a",
  storageBucket:"monitor-caixa-agua-ff63a.firebasestorage.app",
  messagingSenderId:"176234978770",
  appId:"1:176234978770:web:e193d8242f4f111abd3c0b"
};
// Firebase Console > Configurações do projeto > Cloud Messaging > Certificados push da Web > Gerar par de chaves
const VAPID_KEY="COLE_AQUI_SUA_CHAVE_VAPID";

firebase.initializeApp(firebaseConfig);
const db=firebase.database();
const $=id=>document.getElementById(id);
const AREA_UTIL=49,H_UTIL=75,R_BASE=58,R_TOPO=75.5;
let cfg={margem_queda:5,nivel_ligar:40,nivel_desligar:80};
let bombaLigada=false,alturaAtual=0;
function atualizarStream(){const y=862*(1-alturaAtual/100),s=$('stream');s.style.display=(bombaLigada&&y>400)?'':'none';s.setAttribute('y2',Math.max(y,400))}

/* ============ UI: toast, confirmação, abas ============ */
let tt;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2600)}
function confirmar(msg){return new Promise(r=>{$('sheetMsg').textContent=msg;$('sheet').hidden=false;
  const f=v=>{$('sheet').hidden=true;$('sheetOk').onclick=$('sheetNo').onclick=null;r(v)};$('sheetOk').onclick=()=>f(true);$('sheetNo').onclick=()=>f(false)})}
function aba(n){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+n));
  document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===n));scrollTo(0,0)}
document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.onclick=()=>{aba(b.dataset.tab);history.replaceState(null,'','#'+b.dataset.tab)});
if(location.hash==='#ajustes')aba('ajustes');

/* ============ Água ============ */
function litrosTronco(n){if(n<=0)return 0;const h=n/100*H_UTIL,r=R_BASE+(R_TOPO-R_BASE)*(h/H_UTIL);return Math.PI*h/3*(r*r+r*R_BASE+R_BASE*R_BASE)/1000}
function alturaVisual(n){
  const p=[0,20,40,60,80,100].map(x=>[x,cfg['tela'+x]??x]);
  if(n<=0)return p[0][1];if(n>=100)return p[5][1];
  for(let i=1;i<p.length;i++){const[a,va]=p[i-1],[b,vb]=p[i];if(n<=b)return va+(n-a)*(vb-va)/(b-a)}return 100}
function desenharMarcas(boias={}){
  $('marks').innerHTML=[20,40,60,80].map(x=>`<span class="mk ${boias[x]?'on':''}" style="bottom:${alturaVisual(x)}%">${x}%</span>`).join('')}

let nivelMostrado=0,anim;
function contar(para){cancelAnimationFrame(anim);const de=nivelMostrado,t0=performance.now();
  const f=t=>{const k=Math.min(1,(t-t0)/900);nivelMostrado=de+(para-de)*k;$('percent').textContent=Math.round(nivelMostrado)+'%';if(k<1)anim=requestAnimationFrame(f)};anim=requestAnimationFrame(f)}

function atualizarNivel(nivel,litros){
  $('water').style.height=Math.max(0,Math.min(100,alturaVisual(nivel)))+'%';
  alturaAtual=alturaVisual(nivel);atualizarStream();
  contar(nivel);$('litros').textContent=Math.round(litros)+' L';
  const lig=cfg.nivel_ligar??40,des=cfg.nivel_desligar??80;
  let cls='',st='Normal',bd='',al='';
  if(nivel<=20){cls='crit';st='Muito crítico';bd='bad';al='🚨 Perigo: caixa muito baixa!'}
  else if(nivel<=lig){cls='low';st='Nível baixo';bd='warn';al='⚠️ Nível para ligar a bomba'}
  else if(nivel>=des){st='Caixa cheia';bd='full'}
  $('water').className='water '+cls;$('status').textContent=st;$('status').className='badge '+bd;
  $('alerta').hidden=!al;$('alerta').textContent=al;
  processarConsumo(litros);
}

/* ============ Consumo de hoje (mesma lógica de antes, data local) ============ */
const hojeStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
let dataAtual=hojeStr(),consumoHoje=0,menorNivel=null,ultimoL=null,ultimoT=0;
const LIMIAR=.5,MAX_QUEDA=60;
function processarConsumo(l){
  if(l==null||l<0||l>1100)return;const now=Date.now();
  if(ultimoL!==null&&Math.abs(l-ultimoL)>100&&now-ultimoT<5000)return;
  ultimoL=l;ultimoT=now;
  if(menorNivel===null){menorNivel=l;return}
  if(l<menorNivel){const dif=menorNivel-l;if(dif>MAX_QUEDA)return;
    if(dif>LIMIAR){consumoHoje+=dif;$('gasto').textContent=consumoHoje.toFixed(1)+' L'}
    menorNivel=l;db.ref('consumo/'+dataAtual).set({total:+consumoHoje.toFixed(2),menorNivel:+menorNivel.toFixed(2),ultimaAtualizacao:Date.now()})}
}
db.ref('consumo/'+dataAtual).once('value').then(s=>{if(s.exists()){const d=s.val();consumoHoje=d.total||0;menorNivel=d.menorNivel??null;$('gasto').textContent=consumoHoje.toFixed(1)+' L'}});
setInterval(()=>{const n=hojeStr();if(n!==dataAtual){dataAtual=n;consumoHoje=0;menorNivel=null;ultimoL=null;$('gasto').textContent='0 L'}},60000);

/* ============ Dados em tempo real ============ */
let ultimoPing=null,ultimoPingT=Date.now(),espOk=false;
db.ref('/').on('value',s=>{
  const d=s.val();if(!d)return;
  if(d.configuracao){cfg=Object.assign(cfg,d.configuracao)}
  if(d.nivel!==undefined)atualizarNivel(+d.nivel,+d.litros||litrosTronco(+d.nivel));
  desenharMarcas(d.boias);
  $('boias').textContent=[20,40,60,80].map(x=>d.boias?.[x]?'🟢':'⚪').join('');
  bombaLigada=!!d.status_bomba;$('scene').classList.toggle('on',bombaLigada);atualizarStream();
  $('sBomba').textContent=bombaLigada?'🟢 Ligada':'🔴 Desligada';
  $('sModo').textContent=d.modo_manual?'Manual':'Automático';
  $('mAuto').classList.toggle('on',!d.modo_manual);$('mMan').classList.toggle('on',!!d.modo_manual);
  $('sSonoff').textContent=d.sonoff_online?'🟢 Online':'🔴 Offline';
  $('sWifi').textContent=d.dispositivo?.rssi!=null?d.dispositivo.rssi+' dBm':'–';
  $('sSeg').textContent=d.sistema_seguro?'🟢 Normal':'🚨 Falha';
  $('evento').textContent='Último evento: '+(d.ultimo_evento||'–');
  $('btnBomba').textContent=bombaLigada?'Desligar bomba':'Ligar bomba';
  $('btnBomba').className='big'+(bombaLigada?' stop':'');$('btnBomba').dataset.cmd=bombaLigada?'OFF':'ON';
  $('fw').textContent=d.dispositivo?.firmware||'–';$('fwIni').textContent=d.dispositivo?.inicio_firmware||'–';
  if(d.ultimo_ping!==ultimoPing){ultimoPing=d.ultimo_ping;ultimoPingT=Date.now()}
  statusConexao();
});
function statusConexao(){
  const p=$('conn'),viva=Date.now()-ultimoPingT<45000;
  p.className='pill'+(viva&&navigator.onLine?'':' off');
  p.querySelector('span').textContent=!navigator.onLine?'Sem internet':viva?'Ao vivo':'ESP sem sinal';
}
setInterval(statusConexao,5000);addEventListener('online',statusConexao);addEventListener('offline',statusConexao);

/* ============ Comandos ============ */
$('btnBomba').onclick=async e=>{const c=e.currentTarget.dataset.cmd;
  if(await confirmar(c==='ON'?'Ligar a bomba?':'Desligar a bomba?'))db.ref('comandos/bomba').set(c).then(()=>toast('Comando enviado ao ESP8266'))};
document.querySelectorAll('[data-modo]').forEach(b=>b.onclick=()=>db.ref('comandos/modo').set(b.dataset.modo).then(()=>toast('Modo '+(b.dataset.modo==='AUTO'?'automático':'manual')+' enviado')));

/* ============ Histórico da bomba ============ */
function parseData(s){const m=/(\d{2})\/(\d{2})\/(\d{4})[ ,]*(\d{2})?:?(\d{2})?:?(\d{2})?/.exec(s||'');return m?new Date(+m[3],m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),+(m[6]||0)).getTime():0}
const dur=s=>{s=Number(s)||0;const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}h ${m}min`:m?`${m}min ${s%60}s`:`${s}s`};
const esc=v=>String(v??'–').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
db.ref('historico_bomba').on('value',s=>{
  const d=s.val(),el=$('hist');
  if(!d){el.innerHTML='<p class="muted">Nenhum ciclo registrado.</p>';return}
  el.innerHTML=Object.values(d).sort((a,b)=>parseData(b.data_inicio)-parseData(a.data_inicio)).slice(0,30).map(r=>`
   <div class="it"><div class="l"><b>${esc(r.nivel_inicio)}% → ${esc(r.nivel_fim)}%</b><span>${esc(r.motivo)}</span></div>
   <div class="r"><b>${dur(r.duracao_segundos)}</b><span>${esc(r.data_inicio)} · ${r.modo==='AUTOMATICO'?'Auto':esc(r.modo)}</span></div></div>`).join('');
});

/* ============ Ajustes ============ */
const CAMPOS={margem_queda:5,nivel_ligar:40,nivel_desligar:80,timeout_bomba:90,debounce:5,boia20:20,boia40:40,boia60:60,boia80:80,tela0:0,tela20:20,tela40:40,tela60:60,tela80:80,tela100:100};
db.ref('configuracao').on('value',s=>{const c=s.val()||{};cfg=Object.assign(cfg,c);
  for(const k in CAMPOS){if(document.activeElement!==$(k))$(k).value=c[k]??CAMPOS[k]}});
$('btnSalvar').onclick=()=>{
  const v={};for(const k in CAMPOS)v[k]=+$(k).value;
  const r=(k,a,b)=>v[k]>=a&&v[k]<=b;
  let erro='';
  if(!r('nivel_ligar',20,70))erro='Nível para ligar: entre 20% e 70%.';
  else if(!r('nivel_desligar',20,100)||v.nivel_desligar<=v.nivel_ligar)erro='Nível para desligar deve ser maior que o de ligar.';
  else if(!r('margem_queda',1,20)||!r('timeout_bomba',5,180)||!r('debounce',1,30))erro='Verifique os valores da automação.';
  else if(!(v.boia20<v.boia40&&v.boia40<v.boia60&&v.boia60<v.boia80)||v.boia20<1||v.boia80>100)erro='As boias devem estar em ordem crescente (1–100%).';
  else if(['tela0','tela20','tela40','tela60','tela80','tela100'].some(k=>!r(k,0,100)))erro='Calibração visual: valores entre 0 e 100%.';
  if(erro)return toast('❌ '+erro);
  db.ref('configuracao').update(v).then(()=>toast('✅ Configuração salva')).catch(e=>toast('❌ '+e.message));
};

/* ============ Push (FCM) ============ */
const msgOk=firebase.messaging.isSupported&&firebase.messaging.isSupported();
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
let swReg=null,tokenKey=null;
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').then(r=>{swReg=r;iniciarPush()}).catch(()=>{});
const prefs=()=>{const p={};document.querySelectorAll('[data-pref]').forEach(i=>p[i.dataset.pref]=i.checked);return p};
async function iniciarPush(){
  if(!msgOk){$('btnPush').hidden=true;$('pushInfo').textContent=ios&&!standalone?'No iPhone: toque em Compartilhar › “Adicionar à Tela de Início”, abra o app pela tela inicial e ative aqui.':'Este navegador não suporta notificações push.';return}
  if(Notification.permission==='granted')await registrarToken(false);
}
async function registrarToken(pedir){
  try{
    if(pedir&&await Notification.requestPermission()!=='granted')return toast('Permissão negada');
    if(VAPID_KEY.startsWith('COLE'))return toast('Falta configurar a chave VAPID no app.js');
    const token=await firebase.messaging().getToken({vapidKey:VAPID_KEY,serviceWorkerRegistration:swReg});
    if(!token)return;tokenKey=token.slice(-40).replace(/[.#$\[\]\/]/g,'_');
    const ref=db.ref('push_tokens/'+tokenKey),s=await ref.once('value');
    if(s.exists()&&s.val().prefs)document.querySelectorAll('[data-pref]').forEach(i=>i.checked=s.val().prefs[i.dataset.pref]!==false);
    await ref.update({token,prefs:prefs(),plataforma:ios?'ios':'outro',atualizado:Date.now()});
    $('btnPush').textContent='✅ Notificações ativas';$('prefs').hidden=false;if(pedir)toast('Notificações ativadas');
  }catch(e){toast('Erro: '+(e.message||e))}
}
$('btnPush').onclick=()=>registrarToken(true);
document.querySelectorAll('[data-pref]').forEach(i=>i.onchange=()=>tokenKey&&db.ref('push_tokens/'+tokenKey+'/prefs').set(prefs()));
