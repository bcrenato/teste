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
// Firebase Console > Configurações do projeto > Cloud Messaging > Certificados push da Web
const VAPID_KEY="COLE_AQUI_SUA_CHAVE_VAPID";

firebase.initializeApp(firebaseConfig);
const db=firebase.database(),auth=firebase.auth();
const $=id=>document.getElementById(id);
const esc=v=>String(v??'–').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cfg={nivel_ligar:40,nivel_desligar:80},usuario=null,ligados=[],bombaLigada=false,alturaAtual=0;
const est={bloqOff:false,ts:0,tsReal:false,lastTs:null,ping:null,viva:false,alertaBomba:false,bloqAgora:false};

/* ============ Tema ============ */
const lerTema=()=>{try{return localStorage.getItem('tema')||'auto'}catch(_){return'auto'}};
function aplicarTema(){const t=lerTema(),claro=t==='claro'||(t==='auto'&&matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.tema=claro?'claro':'escuro';
  document.querySelector('meta[name=theme-color]').content=claro?'#eef2f7':'#0b1220';
  document.querySelectorAll('[data-tema-btn]').forEach(b=>b.classList.toggle('on',b.dataset.temaBtn===t))}
document.querySelectorAll('[data-tema-btn]').forEach(b=>b.onclick=()=>{try{localStorage.setItem('tema',b.dataset.temaBtn)}catch(_){}aplicarTema()});
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',aplicarTema);aplicarTema();

/* ============ UI ============ */
let tt;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2600)}
function confirmar(msg){return new Promise(r=>{$('sheetMsg').textContent=msg;$('sheet').hidden=false;
  const f=v=>{$('sheet').hidden=true;$('sheetOk').onclick=$('sheetNo').onclick=null;r(v)};$('sheetOk').onclick=()=>f(true);$('sheetNo').onclick=()=>f(false)})}
function aba(n){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+n));
  document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===n));scrollTo(0,0)}
document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.onclick=()=>{aba(b.dataset.tab);history.replaceState(null,'','#'+b.dataset.tab)});
if(['#ajustes','#atividade'].includes(location.hash))aba(location.hash.slice(1));
const ha=ms=>{const s=Math.max(0,Math.round(ms/1000));if(s<60)return s+' s';const m=Math.floor(s/60);if(m<60)return m+' min';return Math.floor(m/60)+' h '+(m%60)+' min'};
const hhmm=m=>isNaN(m)?'–':String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const toMin=t=>{const m=/^(\d{2}):(\d{2})$/.exec(t||'');return m?+m[1]*60+ +m[2]:NaN};
const quando=ts=>new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

/* ============ Login ============ */
const ERROS={'auth/invalid-email':'E-mail inválido.','auth/user-not-found':'Usuário não encontrado.','auth/wrong-password':'Senha incorreta.','auth/invalid-credential':'E-mail ou senha incorretos.','auth/too-many-requests':'Muitas tentativas. Aguarde um pouco.','auth/network-request-failed':'Sem conexão com a internet.','auth/user-disabled':'Usuário desativado.'};
$('btnEntrar').onclick=()=>{const e=$('lEmail').value.trim(),s=$('lSenha').value;$('lErro').textContent='';
  if(!e||!s)return $('lErro').textContent='Informe e-mail e senha.';
  auth.signInWithEmailAndPassword(e,s).catch(x=>$('lErro').textContent=ERROS[x.code]||x.message)};
$('lSenha').onkeydown=e=>{if(e.key==='Enter')$('btnEntrar').click()};
$('btnEsqueci').onclick=()=>{const e=$('lEmail').value.trim();if(!e)return $('lErro').textContent='Digite seu e-mail acima.';
  auth.sendPasswordResetEmail(e).then(()=>$('lErro').textContent='Enviamos um link de redefinição para o seu e-mail.').catch(x=>$('lErro').textContent=ERROS[x.code]||x.message)};
$('btnSair').onclick=()=>auth.signOut();
const nomeUsuario=()=>usuario?(usuario.displayName||usuario.email.split('@')[0]):'?';
$('btnNome').onclick=()=>{const n=$('contaNome').value.trim().slice(0,30);usuario.updateProfile({displayName:n||null}).then(()=>toast('Nome salvo'))};
auth.onAuthStateChanged(u=>{usuario=u;
  if(u){$('login').hidden=true;$('contaEmail').textContent=u.email;$('contaNome').value=u.displayName||'';iniciar();if(swReg)iniciarPush()}
  else{parar();$('login').hidden=false}});

/* ============ Registro de quem comandou ============ */
const registrar=acao=>db.ref('log_comandos').push({uid:usuario.uid,usuario:nomeUsuario(),acao,ts:firebase.database.ServerValue.TIMESTAMP});

/* ============ Água ============ */
const H_UTIL=75,R_BASE=58,R_TOPO=75.5;
function litrosTronco(n){if(n<=0)return 0;const h=n/100*H_UTIL,r=R_BASE+(R_TOPO-R_BASE)*(h/H_UTIL);return Math.PI*h/3*(r*r+r*R_BASE+R_BASE*R_BASE)/1000}
// Quando a água desce, a boia desliga e o nível mostrado é (marca - margem de queda): 80→75, 60→55, 40→35, 20→15.
// O ESP já faz isso; aqui garantimos o mesmo resultado caso o valor chegue como a marca "real".
function nivelComMargem(n,boias){
  const margem=cfg.margem_queda??5;
  for(const m of [80,60,40,20]){const marca=cfg['boia'+m]??m;if(boias&&boias[m]===false&&n>=marca)return marca-margem}
  return n}
function alturaVisual(n){
  const p=[0,20,40,60,80,100].map(x=>[x,cfg['tela'+x]??x]);
  if(n<=0)return p[0][1];if(n>=100)return p[5][1];
  for(let i=1;i<p.length;i++){const[a,va]=p[i-1],[b,vb]=p[i];if(n<=b)return va+(n-a)*(vb-va)/(b-a)}return 100}
function desenharMarcas(boias={}){
  $('marks').innerHTML=[20,40,60,80].map(x=>`<span class="mk ${boias[x]?'on':''}" style="bottom:${alturaVisual(x)}%">${x}%</span>`).join('')}
function atualizarStream(){const y=862*(1-alturaAtual/100),s=$('stream');s.style.display=(bombaLigada&&y>400)?'':'none';s.setAttribute('y2',Math.max(y,400))}
let nivelMostrado=0,anim;
function contar(para){cancelAnimationFrame(anim);const de=nivelMostrado,t0=performance.now();
  const f=t=>{const k=Math.min(1,(t-t0)/900);nivelMostrado=de+(para-de)*k;$('percent').textContent=Math.round(nivelMostrado)+'%';if(k<1)anim=requestAnimationFrame(f)};anim=requestAnimationFrame(f)}
function atualizarNivel(nivel,litros){
  $('water').style.height=Math.max(0,Math.min(100,alturaVisual(nivel)))+'%';
  alturaAtual=alturaVisual(nivel);atualizarStream();
  contar(nivel);$('litros').textContent=Math.round(litros)+' L';
  const lig=cfg.nivel_ligar??40,des=Math.min(cfg.nivel_desligar??80,cfg.boia80??80);
  let cls='',st='Normal',bd='',al='';
  if(nivel<=20){cls='crit';st='Muito crítico';bd='bad';al='🚨 Perigo: caixa muito baixa!'}
  else if(nivel<=lig){cls='low';st='Nível baixo';bd='warn';al='⚠️ Nível para ligar a bomba'}
  else if(nivel>=des){st='Caixa cheia';bd='full'}
  $('water').className='water '+cls;$('status').textContent=st;$('status').className='badge '+bd;
  $('alerta').hidden=!al;$('alerta').textContent=al;
}

/* ============ Avisos e “atualizado há” ============ */
function renderAvisos(){
  const a=[],idade=Date.now()-est.ts;
  if(est.ts&&!est.viva)a.push(['warn',`📡 Sem dados do ESP há ${ha(idade)}. Os valores mostrados são os últimos recebidos.`]);
  if(est.alertaBomba)a.push(['bad','⚠️ A bomba está ligada há muito tempo e o nível não subiu. Verifique a bomba e o registro.']);
  if(est.bloqOff)a.push(['warn','⛔ Automação pausada (bomba desligada pelo painel ou pelo tempo máximo). Toque em “Automático” para liberar.']);
  if(est.bloqAgora)a.push(['info',`🌙 Bomba bloqueada por horário até ${hhmm(cfg.bloqueio_fim_min)}.`]);
  $('avisos').innerHTML=a.map(([c,t])=>`<div class="alert ${c}">${t}</div>`).join('');
}
function tick(){
  const limite=est.tsReal?40000:75000,idade=Date.now()-est.ts;
  est.viva=navigator.onLine&&est.ts>0&&idade<limite;
  const p=$('conn');p.className='pill'+(est.viva?'':' off');
  p.querySelector('span').textContent=!navigator.onLine?'Sem internet':!est.ts?'Conectando':est.viva?'Ao vivo':'ESP sem sinal';
  $('atual').textContent=!est.ts?'Aguardando dados…':(est.viva?'Atualizado há ':'Último dado há ')+ha(idade);
  renderAvisos();
}
setInterval(tick,1000);addEventListener('online',tick);addEventListener('offline',tick);

/* ============ Listeners (só depois do login) ============ */
function ouvir(ref,fn){ref.on('value',fn,e=>{if(e&&e.code==='PERMISSION_DENIED')toast('Sem permissão no banco de dados')});ligados.push([ref,fn])}
function parar(){ligados.forEach(([r,f])=>r.off('value',f));ligados=[]}
function iniciar(){
  if(ligados.length)return;
  function render(d){
    if(d.ultimo_ts!==undefined){if(d.ultimo_ts!==est.lastTs){est.lastTs=d.ultimo_ts;est.ts=d.ultimo_ts*1000}est.tsReal=true}
    else if(d.ultimo_ping!==est.ping){est.ping=d.ultimo_ping;est.ts=Date.now()}
    if(d.nivel!==undefined){const bruto=+d.nivel,n=nivelComMargem(bruto,d.boias);atualizarNivel(n,n!==bruto?litrosTronco(n):(+d.litros||litrosTronco(n)))}
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
    $('fw').textContent=d.dispositivo?.versao||d.dispositivo?.firmware||'–';$('fwIni').textContent=d.dispositivo?.inicio_firmware||'–';
    // previsão para encher (só com a bomba ligada)
    const pv=Number(d.previsao_min);$('rowPrev').hidden=!bombaLigada;
    if(bombaLigada){const f=new Date(Date.now()+pv*60000);$('prev').textContent=pv>0?`~${pv} min (até ${hhmm(f.getHours()*60+f.getMinutes())})`:'calculando…'}
    est.alertaBomba=d.alerta_bomba===true;est.bloqAgora=d.bloqueio_agora===true;est.bloqOff=d.bloqueio_off===true&&!bombaLigada;
    tick();
  }
  const dados={};let raf=0;
  ['nivel','litros','status_bomba','modo_manual','bloqueio_off','sonoff_online','sistema_seguro','ultimo_evento','boias','dispositivo','ultimo_ping','ultimo_ts','previsao_min','alerta_bomba','bloqueio_agora']
    .forEach(n=>ouvir(db.ref(n),s=>{dados[n]=s.val();cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if('nivel' in dados&&'status_bomba' in dados)render(dados)})}));
  ouvir(db.ref('configuracao'),s=>{const c=s.val()||{};cfg=Object.assign(cfg,c);if('nivel' in dados&&'status_bomba' in dados)render(dados);
    for(const k in CAMPOS)if(document.activeElement!==$(k))$(k).value=c[k]??CAMPOS[k];
    if(document.activeElement!==$('alerta_sem_subida'))$('alerta_sem_subida').value=c.alerta_sem_subida??40;
    $('bloq_ativo').checked=!!c.bloqueio_ativo;$('bloq_emerg').checked=c.bloqueio_emergencia!==false;
    if(document.activeElement!==$('bloq_ini'))$('bloq_ini').value=hhmm(c.bloqueio_ini_min??1320);
    if(document.activeElement!==$('bloq_fim'))$('bloq_fim').value=hhmm(c.bloqueio_fim_min??360)});
  ouvir(db.ref('log_comandos').orderByChild('ts').limitToLast(25),s=>{
    const a=[];s.forEach(c=>{a.push(c.val())});a.reverse();
    $('logCmd').innerHTML=a.length?a.map(r=>`<div class="it"><div class="l"><b>${esc(r.usuario)}</b><span>${esc(r.acao)}</span></div><div class="r"><span>${r.ts?quando(r.ts):''}</span></div></div>`).join(''):'<p class="muted">Nenhum comando registrado ainda.</p>'});
  ouvir(db.ref('eventos').orderByChild('ts').limitToLast(25),s=>{
    const a=[];s.forEach(c=>{const v=c.val();if(v.ts>1.6e9)a.push(v)});a.reverse();
    $('logEv').innerHTML=a.length?a.map(r=>`<div class="it"><div class="l"><span style="color:var(--tx)">${esc(r.evento)}</span></div><div class="r"><span>${quando(r.ts*1000)}</span></div></div>`).join(''):'<p class="muted">Nenhum evento com horário (atualize o firmware do ESP).</p>'});
  ouvir(db.ref('historico_bomba'),s=>{
    const d=s.val();$('cardHist').hidden=!d;if(!d)return;
    $('hist').innerHTML=Object.values(d).sort((a,b)=>parseData(b.data_inicio)-parseData(a.data_inicio)).slice(0,30).map(r=>`
     <div class="it"><div class="l"><b>${esc(r.nivel_inicio)}% → ${esc(r.nivel_fim)}%</b><span>${esc(r.motivo)}</span></div>
     <div class="r"><b>${dur(r.duracao_segundos)}</b><span>${esc(r.data_inicio)}</span></div></div>`).join('')});
}
function parseData(s){const m=/(\d{2})\/(\d{2})\/(\d{4})[ ,]*(\d{2})?:?(\d{2})?:?(\d{2})?/.exec(s||'');return m?new Date(+m[3],m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),+(m[6]||0)).getTime():0}
const dur=s=>{s=Number(s)||0;const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}h ${m}min`:m?`${m}min ${s%60}s`:`${s}s`};

/* ============ Comandos ============ */
$('btnBomba').onclick=async e=>{const c=e.currentTarget.dataset.cmd;
  if(await confirmar(c==='ON'?'Ligar a bomba?':'Desligar a bomba?'))
    db.ref('comandos/bomba').set(c).then(()=>{toast('Comando enviado ao ESP8266');registrar(c==='ON'?'Ligou a bomba':'Desligou a bomba')})};
document.querySelectorAll('[data-modo]').forEach(b=>b.onclick=()=>db.ref('comandos/modo').set(b.dataset.modo).then(()=>{
  toast('Modo '+(b.dataset.modo==='AUTO'?'automático':'manual')+' enviado');registrar('Mudou para modo '+(b.dataset.modo==='AUTO'?'automático':'manual'))}));

/* ============ Ajustes ============ */
const CAMPOS={margem_queda:5,nivel_ligar:40,nivel_desligar:80,timeout_bomba:90,debounce:5,boia20:20,boia40:40,boia60:60,boia80:80,tela0:0,tela20:20,tela40:40,tela60:60,tela80:80,tela100:100};
function salvar(){
  const v={};for(const k in CAMPOS)v[k]=+$(k).value;
  const r=(x,a,b)=>x>=a&&x<=b;
  v.alerta_sem_subida=+$('alerta_sem_subida').value;
  v.bloqueio_ativo=$('bloq_ativo').checked;v.bloqueio_emergencia=$('bloq_emerg').checked;
  v.bloqueio_ini_min=toMin($('bloq_ini').value);v.bloqueio_fim_min=toMin($('bloq_fim').value);
  let erro='';
  if(!r(v.nivel_ligar,20,70))erro='Nível para ligar: entre 20% e 70%.';
  else if(!r(v.nivel_desligar,20,100)||v.nivel_desligar<=v.nivel_ligar)erro='Nível para desligar deve ser maior que o de ligar.';
  else if(!r(v.margem_queda,1,20)||!r(v.timeout_bomba,5,180)||!r(v.debounce,1,30))erro='Verifique os valores da automação.';
  else if(!r(v.alerta_sem_subida,5,180))erro='Alerta de bomba sem subir: entre 5 e 180 min.';
  else if(!(v.boia20<v.boia40&&v.boia40<v.boia60&&v.boia60<v.boia80)||v.boia20<1||v.boia80>100)erro='As boias devem estar em ordem crescente (1–100%).';
  else if(['tela0','tela20','tela40','tela60','tela80','tela100'].some(k=>!r(v[k],0,100)))erro='Calibração visual: valores entre 0 e 100%.';
  else if(v.bloqueio_ativo&&(isNaN(v.bloqueio_ini_min)||isNaN(v.bloqueio_fim_min)||v.bloqueio_ini_min===v.bloqueio_fim_min))erro='Defina início e fim do bloqueio (horários diferentes).';
  if(erro)return toast('❌ '+erro);
  if(isNaN(v.bloqueio_ini_min))v.bloqueio_ini_min=1320;if(isNaN(v.bloqueio_fim_min))v.bloqueio_fim_min=360;
  db.ref('configuracao').update(v).then(()=>{toast('✅ Configuração salva');registrar('Alterou as configurações')}).catch(e=>toast('❌ '+e.message));
}
$('btnSalvar').onclick=$('btnSalvar2').onclick=salvar;

/* ============ Push (FCM) ============ */
const msgOk=firebase.messaging.isSupported&&firebase.messaging.isSupported();
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
let swReg=null,tokenKey=null;
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').then(r=>{swReg=r;if(usuario)iniciarPush()}).catch(()=>{});
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
    await ref.update({token,prefs:prefs(),plataforma:ios?'ios':'outro',uid:usuario.uid,atualizado:Date.now()});
    $('btnPush').textContent='✅ Notificações ativas';$('prefs').hidden=false;if(pedir)toast('Notificações ativadas');
  }catch(e){toast('Erro: '+(e.message||e))}
}
$('btnPush').onclick=()=>registrarToken(true);
document.querySelectorAll('[data-pref]').forEach(i=>i.onchange=()=>tokenKey&&db.ref('push_tokens/'+tokenKey+'/prefs').set(prefs()));
