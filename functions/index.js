// Cloud Functions (Firebase, plano Blaze): envia push quando o ESP8266 grava mudanças no Realtime Database.
const {onValueWritten}=require('firebase-functions/v2/database');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const {getMessaging}=require('firebase-admin/messaging');
initializeApp();
const REGION='us-central1'; // ajuste se seu RTDB estiver em outra região
const opt=ref=>({ref,region:REGION,instance:'monitor-caixa-agua-ff63a-default-rtdb'});

async function enviar(pref,title,body,tag){
  const snap=await getDatabase().ref('push_tokens').get();
  if(!snap.exists())return;
  const alvos=Object.entries(snap.val()).filter(([,v])=>v.token&&v.prefs?.[pref]!==false);
  if(!alvos.length)return;
  const r=await getMessaging().sendEachForMulticast({
    tokens:alvos.map(([,v])=>v.token),
    data:{title,body,tag},               // só "data": o sw.js monta a notificação
    android:{priority:'high'},
    webpush:{headers:{Urgency:'high',TTL:'3600'}}
  });
  // remove tokens inválidos
  await Promise.all(r.responses.map((x,i)=>!x.success&&/not-registered|invalid/.test(x.error?.code||'')?getDatabase().ref('push_tokens/'+alvos[i][0]).remove():null));
}

exports.nivel=onValueWritten(opt('/nivel'),async e=>{
  const a=Number(e.data.before.val()),d=Number(e.data.after.val());
  if(isNaN(d)||a===d)return;
  if(d<=20&&a>20)await enviar('baixo','🚨 Caixa muito baixa',`Nível em ${d}%.`,'nivel');
  else if(d<=40&&d>20&&a>40)await enviar('baixo','⚠️ Nível baixo',`Nível em ${d}%.`,'nivel');
  else if(d>=80&&a<80)await enviar('cheia','✅ Caixa cheia',`Nível em ${d}%.`,'nivel');
});
exports.bomba=onValueWritten(opt('/status_bomba'),async e=>{
  const a=e.data.before.val(),d=e.data.after.val();
  if(a===null||a===d)return;
  await enviar('bomba',d?'🟢 Bomba ligada':'🔴 Bomba desligada',d?'A bomba foi ligada.':'A bomba foi desligada.','bomba');
});
exports.seguranca=onValueWritten(opt('/sistema_seguro'),async e=>{
  if(e.data.before.val()===true&&e.data.after.val()===false)await enviar('falha','🚨 Falha no sistema',(await getDatabase().ref('ultimo_evento').get()).val()||'Verifique as boias e a bomba.','falha');
});
exports.sonoff=onValueWritten(opt('/sonoff_online'),async e=>{
  if(e.data.before.val()===true&&e.data.after.val()===false)await enviar('falha','🔌 Sonoff offline','O relé da bomba parou de responder.','sonoff');
});

exports.alertaBomba=onValueWritten(opt('/alerta_bomba'),async e=>{
  if(e.data.before.val()!==true&&e.data.after.val()===true)await enviar('falha','⚠️ Bomba sem subir o nível','A bomba está ligada há muito tempo e o nível não subiu. Verifique a bomba e o registro.','alerta-bomba');
});
