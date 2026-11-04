/*
  MONITOR CAIXA D'AGUA - ESP8266 CH340C - V4
  4 boias: 20/40/60/80%
  Sonoff Tasmota: 192.168.1.71
  Firebase RTDB via REST

  IMPORTANTE:
  - Preencha FIREBASE_AUTH com uma credencial RTDB compatível com ?auth=.
  - Não use a API Key (AIza...) como FIREBASE_AUTH.
  - Preencha OTA_PASSWORD se quiser proteger OTA.
  - Telegram/VoiceMonkey são opcionais e ficam apenas no ESP.
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <EEPROM.h>
#include <time.h>

#define FW_VERSION "4.0-ESP8266"
#define FIREBASE_HOST "https://monitor-caixa-agua-ff63a-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "COLOQUE_SUA_CREDENCIAL_RTDB_AQUI"
#define SONOFF_IP "192.168.1.71"
#define OTA_PASSWORD "240210Jr"

// Opcional. Deixe vazio para desativar.
#define TELEGRAM_TOKEN ""
#define TELEGRAM_CHAT ""
#define VOICEMONKEY_TOKEN ""

// NodeMCU ESP8266: boia entre GPIO e GND.
const uint8_t PIN_BOIA_20 = D1; // GPIO5
const uint8_t PIN_BOIA_40 = D2; // GPIO4
const uint8_t PIN_BOIA_60 = D5; // GPIO14
const uint8_t PIN_BOIA_80 = D6; // GPIO12

const float R_BASE = 58.0f;
const float R_TOPO = 75.5f;
const float H_UTIL = 75.0f;

struct ConfigData {
  uint16_t magic;
  uint8_t ligar;
  uint8_t desligar;
  uint16_t timeoutMin;
  uint16_t debounceSeg;
};
ConfigData cfg;
const uint16_t EEPROM_MAGIC = 0xCA40;

int nivelAtual = 0;
int nivelBruto = -1;
bool boia20=false, boia40=false, boia60=false, boia80=false;
bool erroBoias=false;
bool bombaLigada=false;
bool sonoffOnline=false;
bool erroSonoff=false;
bool sistemaSeguro=false;
bool modoManual=false;
bool bloqueioOff=false;
String ultimoEvento="Inicializando";

unsigned long inicioDebounce=0;
unsigned long inicioBomba=0;
unsigned long ultimoSonoff=0;
unsigned long ultimoFirebase=0;
unsigned long ultimoHeartbeat=0;
unsigned long ultimaConfig=0;
unsigned long ultimoComando=0;
unsigned long ultimoAlerta=0;
unsigned long ultimoConsumo=0;

const unsigned long INTERVALO_SONOFF=10000UL;
const unsigned long INTERVALO_FIREBASE=10000UL;
const unsigned long INTERVALO_HEARTBEAT=30000UL;
const unsigned long INTERVALO_CONFIG=15000UL;
const unsigned long INTERVALO_COMANDO=1000UL;
const unsigned long COOLDOWN_ALERTA=600000UL;

String fbUrl(const String &path) {
  String p=path;
  if(!p.startsWith("/")) p="/"+p;
  return String(FIREBASE_HOST)+p+".json";
}

String urlEncode(const String &s){
  String o; const char *hex="0123456789ABCDEF";
  for(size_t i=0;i<s.length();i++){
    uint8_t c=(uint8_t)s[i];
    if(isalnum(c)||c=='-'||c=='_'||c=='.'||c=='~') o+=(char)c;
    else { o+='%'; o+=hex[(c>>4)&15]; o+=hex[c&15]; }
  }
  return o;
}

bool firebaseGET(const String &path, String &out){
  if(WiFi.status()!=WL_CONNECTED) return false;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http; http.setTimeout(5000);
  if(!http.begin(client,fbUrl(path))) return false;
  int code=http.GET(); out=(code==HTTP_CODE_OK)?http.getString():""; http.end();
  return code==HTTP_CODE_OK;
}

bool firebasePUT(const String &path,const String &json){
  if(WiFi.status()!=WL_CONNECTED) return false;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http; http.setTimeout(5000);
  if(!http.begin(client,fbUrl(path))) return false;
  http.addHeader("Content-Type","application/json");
  int code=http.PUT(json); http.end();
  return code>=200 && code<300;
}

bool firebasePATCH(const String &path,const String &json){
  if(WiFi.status()!=WL_CONNECTED) return false;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http; http.setTimeout(5000);
  if(!http.begin(client,fbUrl(path))) return false;
  http.addHeader("Content-Type","application/json");
  int code=http.sendRequest("PATCH",json); http.end();
  return code>=200 && code<300;
}

bool firebaseDELETE(const String &path){
  if(WiFi.status()!=WL_CONNECTED) return false;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http; http.setTimeout(5000);
  if(!http.begin(client,fbUrl(path))) return false;
  int code=http.sendRequest("DELETE"); http.end();
  return code>=200 && code<300;
}

int jsonInt(const String &s,int def){ String x=s; x.trim(); if(x.length()==0||x=="null")return def; return x.toInt(); }
bool jsonBool(const String &s,bool def){ String x=s; x.trim(); if(x=="true")return true; if(x=="false")return false; return def; }
String stripQuotes(String x){x.trim(); if(x.startsWith("\"")&&x.endsWith("\"")) x=x.substring(1,x.length()-1); return x;}

void carregarEEPROM(){
  EEPROM.begin(64); EEPROM.get(0,cfg);
  if(cfg.magic!=EEPROM_MAGIC || cfg.ligar<20 || cfg.ligar>70 || cfg.desligar<80 || cfg.desligar>80 || cfg.ligar>=cfg.desligar || cfg.timeoutMin<5 || cfg.timeoutMin>180 || cfg.debounceSeg<1 || cfg.debounceSeg>30){
    cfg.magic=EEPROM_MAGIC; cfg.ligar=40; cfg.desligar=80; cfg.timeoutMin=90; cfg.debounceSeg=5;
    EEPROM.put(0,cfg); EEPROM.commit();
  }
}
void salvarEEPROM(){ EEPROM.put(0,cfg); EEPROM.commit(); }

float calcularLitros(int nivel){
  if(nivel<=0)return 0; if(nivel>100)nivel=100;
  float h=(nivel/100.0f)*H_UTIL;
  float r=R_BASE+(R_TOPO-R_BASE)*(h/H_UTIL);
  float v=(PI*h/3.0f)*(r*r+r*R_BASE+R_BASE*R_BASE);
  return v/1000.0f;
}

int lerBoias(bool &valida){
  boia20=digitalRead(PIN_BOIA_20)==LOW;
  boia40=digitalRead(PIN_BOIA_40)==LOW;
  boia60=digitalRead(PIN_BOIA_60)==LOW;
  boia80=digitalRead(PIN_BOIA_80)==LOW;
  valida=true;
  if(boia40&&!boia20)valida=false;
  if(boia60&&!boia40)valida=false;
  if(boia80&&!boia60)valida=false;
  if(!valida)return -1;
  if(boia80)return 80;
  if(boia60)return 60;
  if(boia40)return 40;
  if(boia20)return 20;
  return 0;
}

void telegram(const String &msg){
  if(String(TELEGRAM_TOKEN).length()<10 || String(TELEGRAM_CHAT).length()<1 || WiFi.status()!=WL_CONNECTED)return;
  if(millis()-ultimoAlerta<COOLDOWN_ALERTA)return;
  ultimoAlerta=millis();
  WiFiClientSecure client; client.setInsecure(); HTTPClient http;
  String url="https://api.telegram.org/bot"+String(TELEGRAM_TOKEN)+"/sendMessage?chat_id="+String(TELEGRAM_CHAT)+"&text="+urlEncode(msg);
  if(http.begin(client,url)){http.setTimeout(5000);http.GET();http.end();}
}

void alexa(const String &device){
  if(String(VOICEMONKEY_TOKEN).length()<10 || WiFi.status()!=WL_CONNECTED)return;
  WiFiClientSecure client; client.setInsecure(); HTTPClient http;
  String url="https://api-v2.voicemonkey.io/trigger?token="+String(VOICEMONKEY_TOKEN)+"&device="+device+"&monkey="+device;
  if(http.begin(client,url)){http.setTimeout(5000);http.GET();http.end();}
}

void registrarEvento(const String &e){
  ultimoEvento=e; Serial.println("EVENTO: "+e);
  String key=String(millis());
  String json="{\"evento\":\""+urlEncode(e)+"\",\"millis\":"+String(millis())+"}";
  // Para evitar problemas com caracteres, grava também uma versão simples.
  json="{\"evento\":\"";
  for(size_t i=0;i<e.length();i++){char c=e[i]; if(c=='"'||c=='\\')json+='\\'; json+=c;}
  json+="\",\"millis\":"+String(millis())+"}";
  firebasePUT("/eventos/"+key,json);
}

bool consultarSonoff(){
  if(WiFi.status()!=WL_CONNECTED){sonoffOnline=false;erroSonoff=true;sistemaSeguro=false;return false;}
  WiFiClient client; HTTPClient http; http.setTimeout(3000);
  String url="http://"+String(SONOFF_IP)+"/cm?cmnd=Power";
  if(!http.begin(client,url)){sonoffOnline=false;erroSonoff=true;sistemaSeguro=false;return false;}
  int code=http.GET(); String r=(code==HTTP_CODE_OK)?http.getString():""; http.end();
  if(code!=HTTP_CODE_OK){sonoffOnline=false;erroSonoff=true;sistemaSeguro=false;return false;}
  bool achou=false;
  if(r.indexOf("\"ON\"")>=0){bombaLigada=true;achou=true;}
  else if(r.indexOf("\"OFF\"")>=0){bombaLigada=false;achou=true;}
  sonoffOnline=achou; erroSonoff=!achou; sistemaSeguro=!erroBoias&&!erroSonoff;
  if(bombaLigada && inicioBomba==0)inicioBomba=millis();
  if(!bombaLigada)inicioBomba=0;
  return achou;
}

bool comandarSonoff(bool ligar){
  if(WiFi.status()!=WL_CONNECTED)return false;
  String cmd=ligar?"Power%20On":"Power%20Off";
  for(uint8_t tentativa=0;tentativa<2;tentativa++){
    WiFiClient client; HTTPClient http; http.setTimeout(3000);
    String url="http://"+String(SONOFF_IP)+"/cm?cmnd="+cmd;
    if(http.begin(client,url)){
      int code=http.GET(); http.end();
      if(code==HTTP_CODE_OK){delay(200); if(consultarSonoff() && bombaLigada==ligar){erroSonoff=false;sistemaSeguro=!erroBoias;return true;}}
    }
    yield();
  }
  sonoffOnline=false; erroSonoff=true; sistemaSeguro=false;
  return false;
}

void processarBoias(){
  bool valida; int novo=lerBoias(valida);
  if(!valida){
    if(!erroBoias){erroBoias=true;sistemaSeguro=false;registrarEvento("ERRO: combinacao invalida das boias");telegram("ERRO NAS BOIAS - bomba bloqueada por seguranca");alexa("caixamuitocritica");}
    return;
  }
  if(erroBoias){erroBoias=false;sistemaSeguro=!erroSonoff;registrarEvento("Boias normalizadas");}
  if(novo!=nivelBruto){nivelBruto=novo;inicioDebounce=millis();return;}
  if(millis()-inicioDebounce<(unsigned long)cfg.debounceSeg*1000UL)return;
  if(nivelAtual!=novo){int ant=nivelAtual;nivelAtual=novo;registrarEvento("Nivel: "+String(ant)+"% -> "+String(nivelAtual)+"%");}
}

void lerConfiguracoes(){
  String s; int oldL=cfg.ligar, oldT=cfg.timeoutMin, oldD=cfg.debounceSeg;
  if(firebaseGET("/configuracao/nivel_ligar",s)){int v=jsonInt(s,cfg.ligar);if(v>=20&&v<=70&&v<80)cfg.ligar=v;}
  if(firebaseGET("/configuracao/nivel_desligar",s)){int v=jsonInt(s,cfg.desligar);if(v==80)cfg.desligar=80;}
  if(firebaseGET("/configuracao/timeout_bomba",s)){int v=jsonInt(s,cfg.timeoutMin);if(v>=5&&v<=180)cfg.timeoutMin=v;}
  if(firebaseGET("/configuracao/debounce",s)){int v=jsonInt(s,cfg.debounceSeg);if(v>=1&&v<=30)cfg.debounceSeg=v;}
  if(oldL!=cfg.ligar||oldT!=cfg.timeoutMin||oldD!=cfg.debounceSeg)salvarEEPROM();
}

void processarComandos(){
  if(millis()-ultimoComando<INTERVALO_COMANDO)return;
  String s;
  if(firebaseGET("/comandos/bomba",s)){
    String cmd=stripQuotes(s);cmd.toUpperCase();
    if(cmd=="ON"){
      ultimoComando=millis();modoManual=true;bloqueioOff=false;
      if(comandarSonoff(true)){bombaLigada=true;inicioBomba=millis();registrarEvento("Bomba LIGADA pelo painel");}
      firebaseDELETE("/comandos/bomba");
    }else if(cmd=="OFF"){
      ultimoComando=millis();modoManual=true;bloqueioOff=true;
      if(comandarSonoff(false)){bombaLigada=false;inicioBomba=0;registrarEvento("Bomba DESLIGADA pelo painel - bloqueada");}
      firebaseDELETE("/comandos/bomba");
    }
  }
  if(firebaseGET("/comandos/modo",s)){
    String cmd=stripQuotes(s);cmd.toUpperCase();
    if(cmd=="AUTO"){ultimoComando=millis();modoManual=false;bloqueioOff=false;registrarEvento("Modo AUTOMATICO");firebaseDELETE("/comandos/modo");}
    else if(cmd=="MANUAL"){ultimoComando=millis();modoManual=true;bloqueioOff=false;registrarEvento("Modo MANUAL");firebaseDELETE("/comandos/modo");}
  }
}

void controlarAutomatico(){
  if(modoManual||bloqueioOff||erroBoias)return;
  if(nivelAtual<=cfg.ligar && !bombaLigada){
    if(!sonoffOnline && !consultarSonoff())return;
    if(comandarSonoff(true)){bombaLigada=true;inicioBomba=millis();registrarEvento("Bomba LIGADA automaticamente em "+String(nivelAtual)+"%");telegram("Bomba ligada automaticamente. Nivel: "+String(nivelAtual)+"%");alexa("ligarbomba");}
    else registrarEvento("FALHA: nao foi possivel ligar a bomba");
  }
  if(nivelAtual>=cfg.desligar && bombaLigada){
    if(comandarSonoff(false)){bombaLigada=false;inicioBomba=0;registrarEvento("Bomba DESLIGADA: nivel atingiu "+String(nivelAtual)+"%");telegram("Caixa cheia: "+String(nivelAtual)+"%. Bomba desligada.");alexa("caixacheia");}
    else registrarEvento("ERRO: nao foi possivel confirmar desligamento");
  }
}

void verificarTimeout(){
  if(!bombaLigada||inicioBomba==0)return;
  if(millis()-inicioBomba<(unsigned long)cfg.timeoutMin*60000UL)return;
  registrarEvento("TIMEOUT: bomba excedeu "+String(cfg.timeoutMin)+" minutos");
  bool ok=comandarSonoff(false);bombaLigada=false;inicioBomba=0;
  telegram("SEGURANCA: bomba ultrapassou o tempo maximo de "+String(cfg.timeoutMin)+" minutos.");alexa("caixamuitocritica");
  if(!ok){erroSonoff=true;sistemaSeguro=false;registrarEvento("ATENCAO: desligamento nao confirmado no Sonoff");}
}

void publicarEstado(){
  if(WiFi.status()!=WL_CONNECTED)return;
  String json="{";
  json+="\"nivel\":"+String(nivelAtual)+",";
  json+="\"litros\":"+String(calcularLitros(nivelAtual),1)+",";
  json+="\"status_bomba\":"+(bombaLigada?String("true"):String("false"))+",";
  json+="\"modo_manual\":"+(modoManual?String("true"):String("false"))+",";
  json+="\"bloqueio_off\":"+(bloqueioOff?String("true"):String("false"))+",";
  json+="\"sonoff_online\":"+(sonoffOnline?String("true"):String("false"))+",";
  json+="\"erro_boias\":"+(erroBoias?String("true"):String("false"))+",";
  json+="\"erro_sonoff\":"+(erroSonoff?String("true"):String("false"))+",";
  json+="\"sistema_seguro\":"+(sistemaSeguro?String("true"):String("false"))+",";
  json+="\"ultimo_evento\":\"";
  for(size_t i=0;i<ultimoEvento.length();i++){char c=ultimoEvento[i];if(c=='"'||c=='\\')json+='\\';json+=c;}
  json+="\",\"boias\":{";
  json+="\"20\":"+(boia20?String("true"):String("false"))+",";
  json+="\"40\":"+(boia40?String("true"):String("false"))+",";
  json+="\"60\":"+(boia60?String("true"):String("false"))+",";
  json+="\"80\":"+(boia80?String("true"):String("false"))+"},";
  json+="\"configuracao\":{";
  json+="\"nivel_ligar\":"+String(cfg.ligar)+",\"nivel_desligar\":80,\"timeout_bomba\":"+String(cfg.timeoutMin)+",\"debounce\":"+String(cfg.debounceSeg)+"}}";
  firebasePUT("/status",json);
  // Mantem compatibilidade com o painel/estrutura anterior.
  firebasePUT("/nivel",String(nivelAtual));
  firebasePUT("/litros",String(calcularLitros(nivelAtual),1));
  firebasePUT("/status_bomba",bombaLigada?"true":"false");
  firebasePUT("/modo_manual",modoManual?"true":"false");
  firebasePUT("/sonoff_online",sonoffOnline?"true":"false");
  firebasePUT("/erro_boias",erroBoias?"true":"false");
  firebasePUT("/erro_sonoff",erroSonoff?"true":"false");
  firebasePUT("/sistema_seguro",sistemaSeguro?"true":"false");
  firebasePUT("/ultimo_evento",String("\"")+ultimoEvento+String("\""));
  firebasePUT("/boias",String("{\"20\":")+(boia20?"true":"false")+",\"40\":"+(boia40?"true":"false")+",\"60\":"+(boia60?"true":"false")+",\"80\":"+(boia80?"true":"false")+"}");
  firebasePUT("/configuracao/nivel_ligar",String(cfg.ligar));
  firebasePUT("/configuracao/nivel_desligar","80");
  firebasePUT("/configuracao/timeout_bomba",String(cfg.timeoutMin));
  firebasePUT("/configuracao/debounce",String(cfg.debounceSeg));
}

void publicarHeartbeat(){
  String json="{\"status\":\"online\",\"rssi\":"+String(WiFi.RSSI())+",\"ip\":\""+WiFi.localIP().toString()+"\",\"uptime\":"+String(millis()/1000UL)+",\"versao\":\""+FW_VERSION+"\"}";
  firebasePUT("/dispositivo",json);
  firebasePUT("/ultimo_ping",String(millis()));
}

void setup(){
  Serial.begin(115200);delay(300);
  pinMode(PIN_BOIA_20,INPUT_PULLUP);pinMode(PIN_BOIA_40,INPUT_PULLUP);pinMode(PIN_BOIA_60,INPUT_PULLUP);pinMode(PIN_BOIA_80,INPUT_PULLUP);
  carregarEEPROM();
  WiFi.mode(WIFI_STA);
  WiFiManager wm;
  if(!wm.autoConnect("Caixa_Agua_Boias","Config123")){delay(2000);ESP.restart();}
  Serial.println();Serial.println("=== CAIXA D'AGUA V4 ESP8266 ===");Serial.println(WiFi.localIP());
  ArduinoOTA.setHostname("Monitor-Boias-ESP8266");
  if(String(OTA_PASSWORD).length()>0)ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.begin();
  configTime(-3*3600,0,"pool.ntp.org","a.st1.ntp.br","time.nist.gov");
  consultarSonoff();
  processarBoias();
  publicarEstado();publicarHeartbeat();
  registrarEvento("ESP8266 V4 iniciado");
  if(bombaLigada)inicioBomba=millis();
}

void loop(){
  ArduinoOTA.handle();
  unsigned long agora=millis();
  processarBoias();
  if(agora-ultimaConfig>=INTERVALO_CONFIG){ultimaConfig=agora;lerConfiguracoes();}
  processarComandos();
  if(agora-ultimoSonoff>=INTERVALO_SONOFF){ultimoSonoff=agora;consultarSonoff();}
  controlarAutomatico();
  verificarTimeout();
  if(agora-ultimoFirebase>=INTERVALO_FIREBASE){ultimoFirebase=agora;publicarEstado();}
  if(agora-ultimoHeartbeat>=INTERVALO_HEARTBEAT){ultimoHeartbeat=agora;publicarHeartbeat();}
  delay(20);
}
