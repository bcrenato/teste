/*
  MONITOR CAIXA D'AGUA - ESP32-C3 SUPER MINI - V4.1
  4 boias: 20/40/60/80%
  Sonoff Tasmota: 192.168.1.64
  Firebase RTDB via REST

  CONVERSAO:
  ESP8266 -> ESP32-C3 Super Mini

  GPIO 2 = Boia 20%
  GPIO 3 = Boia 40%
  GPIO 4 = Boia 60%
  GPIO 5 = Boia 80%

  IMPORTANTE:
  - Preencha FIREBASE_AUTH com uma credencial RTDB compatível com ?auth=.
  - Não use a API Key (AIza...) como FIREBASE_AUTH.
  - Preencha OTA_PASSWORD se quiser proteger OTA.
  - Telegram/VoiceMonkey são opcionais e ficam apenas no ESP.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <EEPROM.h>
#include <time.h>

// ======================================================
// V4.2: SAIDA SERIAL (Monitor Serial)
// 0 = desligada (economiza espaco de programa; use quando a placa nao esta ao alcance)
// 1 = ligada (mensagens de depuracao no Monitor Serial)
// ======================================================
#define SERIAL_DEBUG 0

#if !SERIAL_DEBUG
struct NullSerial_ {
  template<typename... A> void begin(A&&...) {}
  template<typename... A> size_t print(A&&...) { return 0; }
  template<typename... A> size_t println(A&&...) { return 0; }
};
static NullSerial_ NullSerial;
#define Serial NullSerial
#endif



#define FW_VERSION "4.2-ESP32-C3"

#define FIREBASE_HOST "https://monitor-caixa-agua-ff63a-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "AXXCVoIB4QFkYUrcpyQJPsxDHGCcODIdyQPPANKD"

#define SONOFF_IP "192.168.1.68"

#define OTA_PASSWORD "240210Jr"

// Opcional. Deixe vazio para desativar.
#define TELEGRAM_TOKEN "8533439908:AAFtykn10UsOEz_NTMPU6pFcptyg0KlYpeI"   // cole aqui o NOVO token (BotFather /revoke)
#define TELEGRAM_CHAT "554870921"
#define VOICEMONKEY_TOKEN "9ed63e20213795a3af8393dcab767373_8ca1d0a8f948bcc2ce71d8eb5c58d622"   // cole aqui o NOVO token do VoiceMonkey

// ======================================================
// CLIENTES HTTP
// ======================================================

WiFiClientSecure firebaseClient;

HTTPClient firebaseHttp;
HTTPClient firebaseGetHttp;
HTTPClient firebaseDeleteHttp;



// ======================================================
// PINOS ESP32-C3 SUPER MINI
// ======================================================

// Boia entre GPIO e GND.
// INPUT_PULLUP = boia aberta HIGH / boia fechada LOW.

const uint8_t PIN_BOIA_20 = 2;
const uint8_t PIN_BOIA_40 = 3;
const uint8_t PIN_BOIA_60 = 4;
const uint8_t PIN_BOIA_80 = 5;


// ======================================================
// DIMENSOES DA CAIXA
// ======================================================

const float R_BASE = 58.0f;
const float R_TOPO = 75.5f;
const float H_UTIL = 75.0f;


// ======================================================
// CONFIGURACAO
// ======================================================

struct ConfigData {

  uint16_t magic;

  uint8_t ligar;
  uint8_t desligar;

  uint16_t timeoutMin;
  uint16_t debounceSeg;

  uint8_t margemQueda;

  uint8_t boia20;
  uint8_t boia40;
  uint8_t boia60;
  uint8_t boia80;

  uint8_t tela0;
  uint8_t tela20;
  uint8_t tela40;
  uint8_t tela60;
  uint8_t tela80;
  uint8_t tela100;
};

ConfigData cfg;

const uint16_t EEPROM_MAGIC = 0xCA43;


// ======================================================
// ESTADOS
// ======================================================

int nivelAtual = 0;
int nivelBruto = -1;

unsigned long tempoNivel60 = 0;

bool boia20 = false;
bool boia40 = false;
bool boia60 = false;
bool boia80 = false;

bool erroBoias = false;
bool bombaLigada = false;
bool sonoffOnline = false;
bool erroSonoff = false;
bool sistemaSeguro = false;

bool modoManual = false;
bool bloqueioOff = false;

String ultimoEvento = "Inicializando";
String inicioFirmware = "";

// ======================================================
// V4.2: PREVISAO DE ENCHIMENTO, ALERTA DE BOMBA E BLOQUEIO POR HORARIO
// ======================================================
unsigned long tDegrau = 0;
unsigned long tUltimaSubida = 0;
float litrosDegrau = 0;
float taxaLmin = 0;
bool degrauValido = false;
bool alertaBomba = false;
bool cicloAnterior = false;
bool emergenciaAtiva = false;
int nivelCiclo = 0;
int previsaoMin = -1;
uint16_t alertaSemSubidaMin = 40;
bool bloqAtivo = false;
bool bloqEmerg = true;
int bloqIni = 1320;   // 22:00
int bloqFim = 360;    // 06:00

unsigned long epochAgora() {
  time_t t = time(nullptr);
  return (t > 100000) ? (unsigned long)t : 0;
}

bool extrairJsonBool(const String &json, const String &chave, bool padrao) {
  String busca = "\"" + chave + "\":";
  int i = json.indexOf(busca);
  if (i < 0) return padrao;
  i += busca.length();
  if (json.startsWith("true", i)) return true;
  if (json.startsWith("false", i)) return false;
  return padrao;
}


// ======================================================
// TEMPORIZADORES
// ======================================================

unsigned long inicioDebounce = 0;
unsigned long inicioBomba = 0;

// ======================================================
// HISTÓRICO DA BOMBA
// ======================================================

int nivelBombaInicio = 0;
int nivelBombaFim = 0;

String boiasBombaInicio = "";
String boiasBombaFim = "";

String dataHoraBombaInicio = "";

bool cicloBombaManual = false;
unsigned long ultimoSonoff = 0;
unsigned long ultimoFirebase = 0;
unsigned long ultimoHeartbeat = 0;
unsigned long ultimaConfig = 0;
unsigned long ultimoComando = 0;
unsigned long ultimoAlerta = 0;
unsigned long ultimoConsumo = 0;


// ======================================================
// INTERVALOS
// ======================================================

const unsigned long INTERVALO_SONOFF = 10000UL;
const unsigned long INTERVALO_FIREBASE = 2000UL;
const unsigned long INTERVALO_HEARTBEAT = 30000UL;
const unsigned long INTERVALO_CONFIG = 15000UL;
const unsigned long INTERVALO_COMANDO = 200UL;
const unsigned long COOLDOWN_ALERTA = 600000UL;


// ======================================================
// FIREBASE URL
// ======================================================

String fbUrl(const String &path) {

  String p = path;

  if (!p.startsWith("/"))
    p = "/" + p;

  String url = String(FIREBASE_HOST) + p + ".json";

  // V4.2: envia a credencial se ela foi preenchida (necessario quando as regras do banco exigem login).
  if (String(FIREBASE_AUTH).length() > 10 &&
      String(FIREBASE_AUTH) != "COLOQUE_SUA_CREDENCIAL_RTDB_AQUI") {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  return url;
}


// ======================================================
// URL ENCODE
// ======================================================

String urlEncode(const String &s) {

  String o;

  const char *hex = "0123456789ABCDEF";

  for (size_t i = 0; i < s.length(); i++) {

    uint8_t c = (uint8_t)s[i];

    if (
      isalnum(c) ||
      c == '-' ||
      c == '_' ||
      c == '.' ||
      c == '~'
    ) {

      o += (char)c;

    } else {

      o += '%';
      o += hex[(c >> 4) & 15];
      o += hex[c & 15];
    }
  }

  return o;
}


// ======================================================
// FIREBASE GET
// ======================================================

bool firebaseGET(const String &path, String &out) {

  if (WiFi.status() != WL_CONNECTED)
    return false;

  firebaseGetHttp.end();

  firebaseGetHttp.setTimeout(1500);

  if (!firebaseGetHttp.begin(firebaseClient, fbUrl(path))) {

    return false;
  }

  firebaseGetHttp.addHeader("Connection", "close");

  unsigned long inicio = millis();

  int code = firebaseGetHttp.GET();

  Serial.print("firebaseGET tempo = ");
  Serial.print(millis() - inicio);

  Serial.print(" ms  codigo=");
  Serial.println(code);

  out = (code == HTTP_CODE_OK)
        ? firebaseGetHttp.getString()
        : "";

  firebaseGetHttp.end();

  return code == HTTP_CODE_OK;
}


// ======================================================
// TESTE HTTPS
// ======================================================

void testeHTTPS() {

  if (WiFi.status() != WL_CONNECTED)
    return;

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  http.setTimeout(3000);

  unsigned long inicio = millis();

  if (!http.begin(client, "https://example.com")) {

    Serial.println("TESTE HTTPS: falha no begin");

    return;
  }

  int code = http.GET();

  unsigned long tempo = millis() - inicio;

  Serial.print("TESTE HTTPS example.com = ");
  Serial.print(tempo);
  Serial.print(" ms  codigo=");
  Serial.println(code);

  http.end();
}


// ======================================================
// TESTE HTTP
// ======================================================

void testeHTTP() {

  if (WiFi.status() != WL_CONNECTED)
    return;

  WiFiClient client;

  HTTPClient http;

  http.setTimeout(3000);

  unsigned long inicio = millis();

  if (!http.begin(client, "http://example.com")) {

    Serial.println("TESTE HTTP: falha no begin");

    return;
  }

  int code = http.GET();

  unsigned long tempo = millis() - inicio;

  Serial.print("TESTE HTTP example.com = ");
  Serial.print(tempo);
  Serial.print(" ms  codigo=");
  Serial.println(code);

  http.end();
}


// ======================================================
// TESTE HTTPS REUTILIZACAO
// ======================================================

void testeHTTPSReutilizacao() {

  if (WiFi.status() != WL_CONNECTED)
    return;

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  http.setTimeout(3000);

  if (!http.begin(client, "https://example.com")) {

    Serial.println("TESTE REUTILIZACAO: falha no begin");

    return;
  }

  http.addHeader("Connection", "keep-alive");

  unsigned long inicio1 = millis();

  int code1 = http.GET();

  unsigned long tempo1 = millis() - inicio1;

  Serial.print("CLIENTE CONECTADO APOS HTTPS 1 = ");
  Serial.println(
    client.connected()
    ? "SIM"
    : "NAO"
  );

  Serial.print("HTTPS 1 = ");
  Serial.print(tempo1);
  Serial.print(" ms  codigo=");
  Serial.println(code1);


  unsigned long inicio2 = millis();

  int code2 = http.GET();

  unsigned long tempo2 = millis() - inicio2;

  Serial.print("HTTPS 2 = ");
  Serial.print(tempo2);
  Serial.print(" ms  codigo=");
  Serial.println(code2);

  http.end();
}


// ======================================================
// TESTE FIREBASE REUTILIZACAO
// ======================================================

void testeFirebaseReutilizacao() {

  if (WiFi.status() != WL_CONNECTED)
    return;

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  http.setTimeout(5000);

  String url = fbUrl("/configuracao");

  if (!http.begin(client, url)) {

    Serial.println(
      "TESTE FIREBASE REUTILIZACAO: falha no begin"
    );

    return;
  }

  http.addHeader("Connection", "keep-alive");

  unsigned long inicio1 = millis();

  int code1 = http.GET();

  unsigned long tempo1 = millis() - inicio1;

  Serial.print("FIREBASE GET 1 = ");
  Serial.print(tempo1);
  Serial.print(" ms  codigo=");
  Serial.println(code1);

  Serial.print("CLIENTE FIREBASE CONECTADO = ");
  Serial.println(
    client.connected()
    ? "SIM"
    : "NAO"
  );


  unsigned long inicio2 = millis();

  int code2 = http.GET();

  unsigned long tempo2 = millis() - inicio2;

  Serial.print("FIREBASE GET 2 = ");
  Serial.print(tempo2);
  Serial.print(" ms  codigo=");
  Serial.println(code2);

  http.end();
}


// ======================================================
// TESTE FIREBASE PUT REUTILIZACAO
// ======================================================

void testeFirebasePUTReutilizacao() {

  if (WiFi.status() != WL_CONNECTED)
    return;

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  http.setTimeout(5000);

  String url = fbUrl("/teste_conexao");

  if (!http.begin(client, url)) {

    Serial.println(
      "TESTE PUT FIREBASE: falha no begin"
    );

    return;
  }

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "Connection",
    "keep-alive"
  );

  String json = "{\"teste\":true}";


  unsigned long inicio1 = millis();

  int code1 = http.PUT(json);

  unsigned long tempo1 = millis() - inicio1;

  Serial.print("FIREBASE PUT 1 = ");
  Serial.print(tempo1);
  Serial.print(" ms  codigo=");
  Serial.println(code1);

  Serial.print("CLIENTE FIREBASE CONECTADO = ");
  Serial.println(
    client.connected()
    ? "SIM"
    : "NAO"
  );


  unsigned long inicio2 = millis();

  int code2 = http.PUT(json);

  unsigned long tempo2 = millis() - inicio2;

  Serial.print("FIREBASE PUT 2 = ");
  Serial.print(tempo2);
  Serial.print(" ms  codigo=");
  Serial.println(code2);

  http.end();
}


// ======================================================
// TESTE CLIENT GLOBAL
// ======================================================

void testeFirebaseClientGlobal() {

  if (WiFi.status() != WL_CONNECTED)
    return;

  HTTPClient http;

  http.setTimeout(5000);

  String url = fbUrl("/configuracao");

  if (!http.begin(firebaseClient, url)) {

    Serial.println(
      "TESTE CLIENT GLOBAL: falha no begin"
    );

    return;
  }

  http.addHeader(
    "Connection",
    "keep-alive"
  );

  unsigned long inicio1 = millis();

  int code1 = http.GET();

  unsigned long tempo1 = millis() - inicio1;

  Serial.print("CLIENT GLOBAL GET 1 = ");
  Serial.print(tempo1);
  Serial.print(" ms  codigo=");
  Serial.println(code1);

  Serial.print("CLIENT GLOBAL CONECTADO = ");
  Serial.println(
    firebaseClient.connected()
    ? "SIM"
    : "NAO"
  );


  unsigned long inicio2 = millis();

  int code2 = http.GET();

  unsigned long tempo2 = millis() - inicio2;

  Serial.print("CLIENT GLOBAL GET 2 = ");
  Serial.print(tempo2);
  Serial.print(" ms  codigo=");
  Serial.println(code2);

  http.end();
}


// ======================================================
// FIREBASE PUT
// ======================================================

bool firebasePUT(
  const String &path,
  const String &json
) {

  if (WiFi.status() != WL_CONNECTED)
    return false;

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  http.setTimeout(1500);

  if (!http.begin(client, fbUrl(path)))
    return false;

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  unsigned long inicio = millis();

  int code = http.PUT(json);

  Serial.print("firebasePUT tempo = ");
  Serial.print(millis() - inicio);
  Serial.println(" ms");

  http.end();

  return code >= 200 && code < 300;
}


// ======================================================
// FIREBASE PATCH
// ======================================================

bool firebasePATCH(
  const String &path,
  const String &json
) {

  if (WiFi.status() != WL_CONNECTED)
    return false;

  if (!firebaseHttp.connected()) {

    firebaseHttp.setTimeout(1500);

    if (!firebaseHttp.begin(
      firebaseClient,
      fbUrl(path)
    )) {

      return false;
    }

    firebaseHttp.addHeader(
      "Content-Type",
      "application/json"
    );

    firebaseHttp.addHeader(
      "Connection",
      "keep-alive"
    );
  }

  unsigned long inicio = millis();

  int code =
    firebaseHttp.sendRequest(
      "PATCH",
      json
    );

  Serial.print("firebasePATCH tempo = ");
  Serial.print(millis() - inicio);

  Serial.print(" ms  codigo=");
  Serial.println(code);

  return code >= 200 && code < 300;
}

// ======================================================
// FIREBASE DELETE
// ======================================================

bool firebaseDELETE(
  const String &path
) {

  if (WiFi.status() != WL_CONNECTED)
    return false;


  String url = fbUrl(path);


  Serial.println();
  Serial.println("=== FIREBASE DELETE ===");

  Serial.print("PATH: ");
  Serial.println(path);

  Serial.print("URL: ");
  Serial.println(url);


  firebaseDeleteHttp.setTimeout(1500);


  // Sempre inicia uma nova requisição.
  // Não reutiliza a URL de um DELETE anterior.

  if (
    !firebaseDeleteHttp.begin(
      firebaseClient,
      url
    )
  ) {

    Serial.println(
      "firebaseDELETE ERRO: begin"
    );

    return false;
  }


  firebaseDeleteHttp.addHeader(
    "Connection",
    "close"
  );


  unsigned long inicio = millis();


  int code =
    firebaseDeleteHttp.sendRequest(
      "DELETE"
    );


  Serial.print("TEMPO: ");
  Serial.print(millis() - inicio);
  Serial.println(" ms");


  Serial.print("HTTP CODE: ");
  Serial.println(code);


  String resposta =
    firebaseDeleteHttp.getString();


  Serial.print("RESPOSTA: ");
  Serial.println(resposta);


  firebaseDeleteHttp.end();


  Serial.println("======================");


  return code >= 200 && code < 300;
}

// ======================================================
// JSON
// ======================================================

int jsonInt(
  const String &s,
  int def
) {

  String x = s;

  x.trim();

  if (
    x.length() == 0 ||
    x == "null"
  )
    return def;

  return x.toInt();
}


int extrairJsonInt(
  const String &json,
  const String &chave,
  int padrao
) {

  String busca =
    "\"" + chave + "\":";

  int inicio =
    json.indexOf(busca);

  if (inicio < 0)
    return padrao;

  inicio += busca.length();

  int fim = inicio;

  while (fim < json.length()) {

    char c = json[fim];

    if (
      c == ',' ||
      c == '}' ||
      c == '\n' ||
      c == '\r'
    )
      break;

    fim++;
  }

  String valor =
    json.substring(
      inicio,
      fim
    );

  valor.trim();

  if (valor.length() == 0)
    return padrao;

  return valor.toInt();
}


String extrairJsonString(
  const String &json,
  const String &chave,
  const String &padrao
) {

  String busca =
    "\"" + chave + "\":\"";

  int inicio =
    json.indexOf(busca);

  if (inicio < 0)
    return padrao;

  inicio += busca.length();

  int fim =
    json.indexOf("\"", inicio);

  if (fim < 0)
    return padrao;

  return json.substring(
    inicio,
    fim
  );
}


bool jsonBool(
  const String &s,
  bool def
) {

  String x = s;

  x.trim();

  if (x == "true")
    return true;

  if (x == "false")
    return false;

  return def;
}


String stripQuotes(
  String x
) {

  x.trim();

  if (
    x.startsWith("\"") &&
    x.endsWith("\"")
  ) {

    x =
      x.substring(
        1,
        x.length() - 1
      );
  }

  return x;
}


// ======================================================
// EEPROM
// ======================================================

void carregarEEPROM() {

  EEPROM.begin(64);

  EEPROM.get(0, cfg);

  if (
    cfg.magic != EEPROM_MAGIC ||

    cfg.ligar < 20 ||
    cfg.ligar > 70 ||

    cfg.desligar < 20 ||
    cfg.desligar > 100 ||

    cfg.ligar >= cfg.desligar ||

    cfg.timeoutMin < 5 ||
    cfg.timeoutMin > 180 ||

    cfg.debounceSeg < 1 ||
    cfg.debounceSeg > 30 ||

    cfg.margemQueda < 1 ||
    cfg.margemQueda > 20 ||

    cfg.boia20 < 1 ||
    cfg.boia20 > 100 ||

    cfg.boia40 < 1 ||
    cfg.boia40 > 100 ||

    cfg.boia60 < 1 ||
    cfg.boia60 > 100 ||

    cfg.boia80 < 1 ||
    cfg.boia80 > 100 ||

    cfg.boia20 >= cfg.boia40 ||
    cfg.boia40 >= cfg.boia60 ||
    cfg.boia60 >= cfg.boia80
  ) {

    cfg.magic = EEPROM_MAGIC;

    cfg.ligar = 40;
    cfg.desligar = 80;

    cfg.timeoutMin = 90;
    cfg.debounceSeg = 5;

    cfg.margemQueda = 5;

    cfg.boia20 = 20;
    cfg.boia40 = 40;
    cfg.boia60 = 60;
    cfg.boia80 = 80;

    cfg.tela0 = 0;
    cfg.tela20 = 20;
    cfg.tela40 = 40;
    cfg.tela60 = 60;
    cfg.tela80 = 80;
    cfg.tela100 = 100;

    EEPROM.put(0, cfg);

    EEPROM.commit();
  }
}


void salvarEEPROM() {

  EEPROM.put(0, cfg);

  EEPROM.commit();
}


// ======================================================
// CALCULO DE LITROS
// ======================================================

float calcularLitros(
  int nivel
) {

  if (nivel <= 0)
    return 0;

  if (nivel > 100)
    nivel = 100;

  float h =
    (nivel / 100.0f) *
    H_UTIL;

  float r =
    R_BASE +
    (R_TOPO - R_BASE) *
    (h / H_UTIL);

  float v =
    (PI * h / 3.0f) *
    (
      r * r +
      r * R_BASE +
      R_BASE * R_BASE
    );

  return v / 1000.0f;
}


// ======================================================
// LEITURA DAS BOIAS
// ======================================================

int lerBoias(
  bool &valida
) {

  boia20 =
    digitalRead(PIN_BOIA_20) == LOW;

  boia40 =
    digitalRead(PIN_BOIA_40) == LOW;

  boia60 =
    digitalRead(PIN_BOIA_60) == LOW;

  boia80 =
    digitalRead(PIN_BOIA_80) == LOW;


  valida = true;

  if (
    boia40 &&
    !boia20
  )
    valida = false;

  if (
    boia60 &&
    !boia40
  )
    valida = false;

  if (
    boia80 &&
    !boia60
  )
    valida = false;


  if (!valida)
    return -1;


  // SUBINDO

  if (
    boia80 &&
    nivelAtual < cfg.boia80
  )
    return cfg.boia80;

  if (
    boia60 &&
    nivelAtual < cfg.boia60
  )
    return cfg.boia60;

  if (
    boia40 &&
    nivelAtual < cfg.boia40
  )
    return cfg.boia40;

  if (
    boia20 &&
    nivelAtual < cfg.boia20
  )
    return cfg.boia20;


  // DESCENDO

  if (
    !boia80 &&
    nivelAtual >= cfg.boia80
  )
    return cfg.boia80 -
           cfg.margemQueda;

  if (
    !boia60 &&
    nivelAtual >= cfg.boia60
  )
    return cfg.boia60 -
           cfg.margemQueda;

  if (
    !boia40 &&
    nivelAtual >= cfg.boia40
  )
    return cfg.boia40 -
           cfg.margemQueda;

  if (
    !boia20 &&
    nivelAtual >= cfg.boia20
  )
    return cfg.boia20 -
           cfg.margemQueda;


  return nivelAtual;
}


// ======================================================
// TELEGRAM
// ======================================================

void telegram(
  const String &msg
) {

  if (
    String(TELEGRAM_TOKEN).length() < 10 ||
    String(TELEGRAM_CHAT).length() < 1 ||
    WiFi.status() != WL_CONNECTED
  )
    return;

  if (
    millis() - ultimoAlerta <
    COOLDOWN_ALERTA
  )
    return;

  ultimoAlerta = millis();

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  String url =
    "https://api.telegram.org/bot" +
    String(TELEGRAM_TOKEN) +
    "/sendMessage?chat_id=" +
    String(TELEGRAM_CHAT) +
    "&text=" +
    urlEncode(msg);

  if (http.begin(client, url)) {

    http.setTimeout(5000);

    http.GET();

    http.end();
  }
}


// ======================================================
// VOICE MONKEY / ALEXA
// ======================================================

void alexa(
  const String &device
) {

  if (
    String(VOICEMONKEY_TOKEN).length() < 10 ||
    WiFi.status() != WL_CONNECTED
  )
    return;

  WiFiClientSecure client;

  client.setInsecure();

  HTTPClient http;

  String url =
    "https://api-v2.voicemonkey.io/trigger?token=" +
    String(VOICEMONKEY_TOKEN) +
    "&device=" +
    device +
    "&monkey=" +
    device;

  if (http.begin(client, url)) {

    http.setTimeout(5000);

    http.GET();

    http.end();
  }
}


// ======================================================
// REGISTRAR EVENTO
// ======================================================

void registrarEvento(
  const String &e
) {

  ultimoEvento = e;

  Serial.println(
    "EVENTO: " + e
  );

  String key =
    String(millis());

  String json =
    "{\"evento\":\"";

  for (
    size_t i = 0;
    i < e.length();
    i++
  ) {

    char c = e[i];

    if (
      c == '"' ||
      c == '\\'
    )
      json += '\\';

    json += c;
  }

  json +=
    "\",\"millis\":" +
    String(millis()) +
    ",\"ts\":" + String(epochAgora()) + "}";

  firebasePUT(
    "/eventos/" + key,
    json
  );
}

// ======================================================
// CONSULTAR SONOFF
// ======================================================

bool consultarSonoff() {

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    sonoffOnline = false;
    erroSonoff = true;
    sistemaSeguro = false;

    return false;
  }


  WiFiClient client;

  HTTPClient http;

  http.setTimeout(3000);

  String url =
    "http://" +
    String(SONOFF_IP) +
    "/cm?cmnd=Power";


  if (!http.begin(client, url)) {

    sonoffOnline = false;
    erroSonoff = true;
    sistemaSeguro = false;

    return false;
  }


  int code = http.GET();

  String r =
    (code == HTTP_CODE_OK)
    ? http.getString()
    : "";


  Serial.print(
    "SONOFF CONSULTA: code="
  );

  Serial.print(code);

  Serial.print(
    " resposta="
  );

  Serial.println(r);

  http.end();


  if (
    code != HTTP_CODE_OK
  ) {

    sonoffOnline = false;
    erroSonoff = true;
    sistemaSeguro = false;

    return false;
  }


  bool achou = false;


  if (
    r.indexOf("\"ON\"") >= 0
  ) {

    bombaLigada = true;

    achou = true;

  } else if (
    r.indexOf("\"OFF\"") >= 0
  ) {

    bombaLigada = false;

    achou = true;
  }


  sonoffOnline = achou;

  erroSonoff = !achou;

  sistemaSeguro =
    !erroBoias &&
    !erroSonoff;


  // Se a bomba estiver ligada e ainda nao existir
  // um inicio de ciclo, registra apenas o instante.
  //
  // O registro completo do inicio continua sendo feito
  // por registrarInicioBomba() quando o ciclo e iniciado.
  if (
    bombaLigada &&
    inicioBomba == 0
  ) {

    inicioBomba = millis();
  }


  // IMPORTANTE:
  // Nao zerar inicioBomba quando a bomba estiver OFF.
  // O encerramento do ciclo fara isso depois que o
  // historico for registrado.


  return achou;
}
// ======================================================
// COMANDAR SONOFF
// ======================================================

bool comandarSonoff(
  bool ligar
) {

  Serial.println();
  Serial.println("=== COMANDAR SONOFF ===");

  Serial.print("ORDEM: ");
  Serial.println(ligar ? "ON" : "OFF");


  if (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.println("ERRO: WiFi desconectado");

    return false;
  }


  Serial.print("IP SONOFF: ");
  Serial.println(SONOFF_IP);


  String cmd =
    ligar
    ? "Power%20On"
    : "Power%20Off";


  for (
    uint8_t tentativa = 0;
    tentativa < 2;
    tentativa++
  ) {

    Serial.print("Tentativa: ");
    Serial.println(tentativa + 1);


    WiFiClient client;

    HTTPClient http;

    http.setTimeout(3000);


    String url =
      "http://" +
      String(SONOFF_IP) +
      "/cm?cmnd=" +
      cmd;


    Serial.print("URL: ");
    Serial.println(url);


    if (
      http.begin(client, url)
    ) {

      int code = http.GET();


      Serial.print("HTTP CODE: ");
      Serial.println(code);


      http.end();


      if (
        code == HTTP_CODE_OK
      ) {

        Serial.println("Comando aceito pelo Sonoff");

        delay(200);


        bool consulta =
          consultarSonoff();


        Serial.print("CONSULTA SONOFF: ");
        Serial.println(
          consulta
          ? "OK"
          : "ERRO"
        );


        Serial.print("BOMBA LIDA PELO ESP: ");
        Serial.println(
          bombaLigada
          ? "ON"
          : "OFF"
        );


        Serial.print("ORDEM ESP: ");
        Serial.println(
          ligar
          ? "ON"
          : "OFF"
        );


        if (
          consulta &&
          bombaLigada == ligar
        ) {

          erroSonoff = false;

          sistemaSeguro =
            !erroBoias;


          Serial.println(
            "=== SONOFF CONFIRMADO ==="
          );


          return true;
        }

        Serial.println(
          "ERRO: Sonoff respondeu, mas estado nao conferiu"
        );
      }
    }
    else {

      Serial.println(
        "ERRO: http.begin() falhou"
      );
    }


    yield();
  }


  Serial.println(
    "=== FALHA AO COMANDAR SONOFF ==="
  );


  sonoffOnline = false;

  erroSonoff = true;

  sistemaSeguro = false;


  return false;
}

// ======================================================
// PROCESSAR BOIAS
// ======================================================

void processarBoias() {

  bool valida;

  int novo =
    lerBoias(valida);


  if (
    novo != nivelBruto
  ) {

    Serial.print("BOIAS: ");

    Serial.print(
      digitalRead(PIN_BOIA_20) == LOW
      ? "20 "
      : "-- "
    );

    Serial.print(
      digitalRead(PIN_BOIA_40) == LOW
      ? "40 "
      : "-- "
    );

    Serial.print(
      digitalRead(PIN_BOIA_60) == LOW
      ? "60 "
      : "-- "
    );

    Serial.print(
      digitalRead(PIN_BOIA_80) == LOW
      ? "80"
      : "--"
    );

    Serial.print(
      "  -> novo="
    );

    Serial.print(novo);

    Serial.print(
      "  valida="
    );

    Serial.println(
      valida
      ? "SIM"
      : "NAO"
    );
  }


  if (!valida) {

    if (!erroBoias) {

      erroBoias = true;

      sistemaSeguro = false;

      registrarEvento(
        "ERRO: combinacao invalida das boias"
      );

      telegram(
        "ERRO NAS BOIAS - bomba bloqueada por seguranca"
      );

      alexa(
        "caixamuitocritica"
      );
    }

    return;
  }


  if (erroBoias) {

    erroBoias = false;

    sistemaSeguro =
      !erroSonoff;

    registrarEvento(
      "Boias normalizadas"
    );
  }


  static bool primeiraLeitura = true;


  if (primeiraLeitura) {

    primeiraLeitura = false;

    nivelBruto = novo;

    nivelAtual = novo;

    inicioDebounce = millis();

    return;
  }


  if (
    novo != nivelBruto
  ) {

    nivelBruto = novo;

    inicioDebounce = millis();

    return;
  }


  if (
    millis() - inicioDebounce <
    (unsigned long)cfg.debounceSeg *
    1000UL
  )
    return;


  if (
    nivelAtual != novo
  ) {

    int ant = nivelAtual;


    Serial.print(
      "DEBOUNCE OK - nivel vai mudar de "
    );

    Serial.print(nivelAtual);

    Serial.print(" para ");

    Serial.println(novo);


    nivelAtual = novo;


    Serial.print(
      "MUDANCA DE NIVEL: "
    );

    Serial.print(ant);

    Serial.print("% -> ");

    Serial.print(nivelAtual);

    Serial.println("%");


    if (
      nivelAtual == 60
    ) {

      tempoNivel60 = millis();

      Serial.println(
        "CRONOMETRO 60% INICIADO"
      );
    }


    if (
      ant == 60 &&
      nivelAtual == 80
    ) {

      Serial.print(
        "TEMPO REAL 60% -> 80% = "
      );

      Serial.print(
        (millis() - tempoNivel60) /
        1000.0
      );

      Serial.println(
        " segundos"
      );
    }


    ultimoEvento =
      "Nivel: " +
      String(ant) +
      "% -> " +
      String(nivelAtual) +
      "%";
  }
}


// ======================================================
// LER CONFIGURACOES
// ======================================================

void lerConfiguracoes() {

  String s;

  if (
    !firebaseGET(
      "/configuracao",
      s
    )
  )
    return;


  Serial.print(
    "CONFIG JSON RECEBIDO: "
  );

  Serial.println(s);


  int v;


  v =
    extrairJsonInt(
      s,
      "nivel_ligar",
      cfg.ligar
    );

  if (
  v >= 20 &&
  v <= 70
)
  cfg.ligar = v;


  v =
  extrairJsonInt(
    s,
    "nivel_desligar",
    cfg.desligar
  );

if (
  v >= 20 &&
  v <= 100 &&
  v > cfg.ligar
)
  cfg.desligar = v;


  v =
    extrairJsonInt(
      s,
      "timeout_bomba",
      cfg.timeoutMin
    );

  if (
    v >= 5 &&
    v <= 180
  )
    cfg.timeoutMin = v;


  v =
    extrairJsonInt(
      s,
      "debounce",
      cfg.debounceSeg
    );

  if (
    v >= 1 &&
    v <= 30
  )
    cfg.debounceSeg = v;


  v =
    extrairJsonInt(
      s,
      "margem_queda",
      cfg.margemQueda
    );

  if (
    v >= 1 &&
    v <= 20
  )
    cfg.margemQueda = v;


  Serial.print(
    "CONFIG: margemQueda = "
  );

  Serial.println(
    cfg.margemQueda
  );


  Serial.print(
    "CONFIG: boia80 = "
  );

  Serial.println(
    cfg.boia80
  );


  v =
    extrairJsonInt(
      s,
      "boia20",
      cfg.boia20
    );

  if (
    v >= 1 &&
    v <= 100
  )
    cfg.boia20 = v;


  v =
    extrairJsonInt(
      s,
      "boia40",
      cfg.boia40
    );

  if (
    v >= 1 &&
    v <= 100
  )
    cfg.boia40 = v;


  v =
    extrairJsonInt(
      s,
      "boia60",
      cfg.boia60
    );

  if (
    v >= 1 &&
    v <= 100
  )
    cfg.boia60 = v;


  v =
    extrairJsonInt(
      s,
      "boia80",
      cfg.boia80
    );

  if (
    v >= 1 &&
    v <= 100
  )
    cfg.boia80 = v;


  v =
    extrairJsonInt(
      s,
      "tela0",
      cfg.tela0
    );

  if (
    v >= 0 &&
    v <= 100
  )
    cfg.tela0 = v;


  v =
    extrairJsonInt(
      s,
      "tela20",
      cfg.tela20
    );

  if (
    v >= 0 &&
    v <= 100
  )
    cfg.tela20 = v;


  v =
    extrairJsonInt(
      s,
      "tela40",
      cfg.tela40
    );

  if (
    v >= 0 &&
    v <= 100
  )
    cfg.tela40 = v;


  v =
    extrairJsonInt(
      s,
      "tela60",
      cfg.tela60
    );

  if (
    v >= 0 &&
    v <= 100
  )
    cfg.tela60 = v;


  v =
    extrairJsonInt(
      s,
      "tela80",
      cfg.tela80
    );

  if (
    v >= 0 &&
    v <= 100
  )
    cfg.tela80 = v;


  v =
    extrairJsonInt(
      s,
      "tela100",
      cfg.tela100
    );

  if (
    v >= 0 &&
    v <= 100
  )
    cfg.tela100 = v;


  // ---- V4.2: alerta e bloqueio por horario ----
  v = extrairJsonInt(s, "alerta_sem_subida", alertaSemSubidaMin);
  if (v >= 5 && v <= 180) alertaSemSubidaMin = v;
  bloqAtivo = extrairJsonBool(s, "bloqueio_ativo", bloqAtivo);
  bloqEmerg = extrairJsonBool(s, "bloqueio_emergencia", bloqEmerg);
  v = extrairJsonInt(s, "bloqueio_ini_min", bloqIni);
  if (v >= 0 && v < 1440) bloqIni = v;
  v = extrairJsonInt(s, "bloqueio_fim_min", bloqFim);
  if (v >= 0 && v < 1440) bloqFim = v;



  static int oldL = -1;
  static int oldT = -1;
  static int oldD = -1;
  static int oldM = -1;
  static int oldDesligar = -1;

  static int oldB20 = -1;
  static int oldB40 = -1;
  static int oldB60 = -1;
  static int oldB80 = -1;

  static int oldTela0 = -1;
  static int oldTela20 = -1;
  static int oldTela40 = -1;
  static int oldTela60 = -1;
  static int oldTela80 = -1;
  static int oldTela100 = -1;


  if (
    oldL != cfg.ligar ||
    oldT != cfg.timeoutMin ||
	oldDesligar != cfg.desligar ||
    oldD != cfg.debounceSeg ||
    oldM != cfg.margemQueda ||

    oldB20 != cfg.boia20 ||
    oldB40 != cfg.boia40 ||
    oldB60 != cfg.boia60 ||
    oldB80 != cfg.boia80 ||

    oldTela0 != cfg.tela0 ||
    oldTela20 != cfg.tela20 ||
    oldTela40 != cfg.tela40 ||
    oldTela60 != cfg.tela60 ||
    oldTela80 != cfg.tela80 ||
    oldTela100 != cfg.tela100
  ) {

    oldL = cfg.ligar;
    oldT = cfg.timeoutMin;
	oldDesligar = cfg.desligar;
    oldD = cfg.debounceSeg;
    oldM = cfg.margemQueda;

    oldB20 = cfg.boia20;
    oldB40 = cfg.boia40;
    oldB60 = cfg.boia60;
    oldB80 = cfg.boia80;

    oldTela0 = cfg.tela0;
    oldTela20 = cfg.tela20;
    oldTela40 = cfg.tela40;
    oldTela60 = cfg.tela60;
    oldTela80 = cfg.tela80;
    oldTela100 = cfg.tela100;


    salvarEEPROM();
  }
}



// ======================================================
// PROTOTIPOS
// ======================================================

void registrarInicioBomba(bool manual);

void registrarFimBomba(
  String motivo
);

// ======================================================
// PROCESSAR COMANDOS
// ======================================================

void processarComandos() {

  if (
    millis() - ultimoComando <
    INTERVALO_COMANDO
  )
    return;

  ultimoComando = millis();


  String s;

  if (
    !firebaseGET(
      "/comandos",
      s
    )
  )
    return;


  Serial.print(
    "COMANDOS RECEBIDO: "
  );

  Serial.println(s);


  String bomba =
    extrairJsonString(
      s,
      "bomba",
      ""
    );

  String modo =
    extrairJsonString(
      s,
      "modo",
      ""
    );


  bomba.toUpperCase();

  modo.toUpperCase();


  // ====================================================
  // MODO TEM PRIORIDADE SOBRE COMANDO DA BOMBA
  // ====================================================

  if (modo == "AUTO") {

    ultimoComando = millis();

    modoManual = false;

    bloqueioOff = false;


    // Remove qualquer comando antigo da bomba.
    // Isso impede um OFF antigo de sobrescrever o AUTO.
    firebaseDELETE(
      "/comandos/bomba"
    );


    registrarEvento(
      "Modo AUTOMATICO"
    );


    firebaseDELETE(
      "/comandos/modo"
    );


    return;
  }


  if (
    modo == "MANUAL"
  ) {

    ultimoComando = millis();

    modoManual = true;

    bloqueioOff = false;


    // Remove qualquer comando antigo da bomba.
    firebaseDELETE(
      "/comandos/bomba"
    );


    registrarEvento(
      "Modo MANUAL"
    );


    firebaseDELETE(
      "/comandos/modo"
    );


    return;
  }


  // ====================================================
  // COMANDO LIGAR BOMBA
  // ====================================================

  if (
    bomba == "ON"
  ) {

    ultimoComando = millis();

    modoManual = true;

    bloqueioOff = false;


    if (
      comandarSonoff(true)
    ) {

      bombaLigada = true;

	  registrarInicioBomba(true);


      registrarEvento(
        "Bomba LIGADA pelo painel"
      );


      firebaseDELETE(
        "/comandos/bomba"
      );

    } else {

      registrarEvento(
        "ERRO: nao foi possivel ligar a bomba"
      );
    }


    return;
  }


// ====================================================
// COMANDO DESLIGAR BOMBA
// ====================================================

if (
  bomba == "OFF"
) {

  ultimoComando = millis();

  modoManual = true;

  bloqueioOff = true;


  if (
    comandarSonoff(false)
  ) {

    bombaLigada = false;


    registrarFimBomba(
      "Desligada pelo painel"
    );


    registrarEvento(
      "Bomba DESLIGADA pelo painel - bloqueada"
    );


    firebaseDELETE(
      "/comandos/bomba"
    );

  } else {

    registrarEvento(
      "ERRO: nao foi possivel desligar a bomba"
    );
  }


  return;
}
}


// ======================================================
// CONTROLE AUTOMATICO
// ======================================================

bool bloqueioHorario() {
  if (!bloqAtivo || bloqIni == bloqFim) return false;
  time_t t = time(nullptr);
  if (t < 100000) return false;   // sem hora valida: nao bloqueia
  struct tm lt;
  localtime_r(&t, &lt);
  int m = lt.tm_hour * 60 + lt.tm_min;
  if (bloqIni < bloqFim) return (m >= bloqIni && m < bloqFim);
  return (m >= bloqIni || m < bloqFim);
}

// Excecao: com a caixa em 20% ou menos a bomba e liberada ate encher.
bool bloqueadoAgora() {
  int alvo = (cfg.desligar < cfg.boia80) ? cfg.desligar : cfg.boia80;
  if (nivelAtual >= alvo) emergenciaAtiva = false;
  bool b = bloqueioHorario();
  if (b && bloqEmerg && nivelAtual <= 20) emergenciaAtiva = true;
  return b && !emergenciaAtiva;
}

void controlarAutomatico() {

  if (
    modoManual ||
    bloqueioOff ||
    erroBoias
  )
    return;

  // V4.2: horario de bloqueio
  if (bloqueadoAgora()) {
    if (bombaLigada) {
      if (comandarSonoff(false)) {
        bombaLigada = false;
        registrarFimBomba("Horario de bloqueio");
        registrarEvento("Bomba DESLIGADA: horario de bloqueio");
      }
    }
    return;
  }


  if (
    (
      nivelAtual >= cfg.desligar ||
      boia80
    ) &&
    bombaLigada
  ) {

    if (
  comandarSonoff(false)
) {

  bombaLigada = false;

  registrarFimBomba(
    "Caixa cheia"
  );

  registrarEvento(
    "Bomba DESLIGADA: boia de 80% acionada"
  );

  telegram(
    "Caixa cheia: 80%. Bomba desligada."
  );

  alexa(
    "caixacheia"
  );

} else {

      registrarEvento(
        "ERRO: nao foi possivel confirmar desligamento"
      );
    }

    return;
  }


  if (
  !bombaLigada &&
  nivelAtual <= cfg.ligar &&
  !boia80
) {

    if (
      !sonoffOnline &&
      !consultarSonoff()
    )
      return;


    if (
      comandarSonoff(true)
    ) {

     bombaLigada = true;

	 registrarInicioBomba(false);


      registrarEvento(
        "Bomba LIGADA automaticamente em " +
        String(nivelAtual) +
        "%"
      );


      telegram(
        "Bomba ligada automaticamente. Nivel: " +
        String(nivelAtual) +
        "%"
      );


      alexa(
        "ligarbomba"
      );

    } else {

      registrarEvento(
        "FALHA: nao foi possivel ligar a bomba"
      );
    }
  }
}


// ======================================================
// TIMEOUT
// ======================================================

void verificarTimeout() {

  if (
    !bombaLigada ||
    inicioBomba == 0
  )
    return;

  if (
    millis() - inicioBomba <
    (unsigned long)cfg.timeoutMin *
    60000UL
  )
    return;


  registrarEvento(
    "TIMEOUT: bomba excedeu " +
    String(cfg.timeoutMin) +
    " minutos"
  );


  bool ok =
    comandarSonoff(false);


  bombaLigada = false;


  // Registrar o ciclo ANTES de perder inicioBomba
  registrarFimBomba(
    "Timeout"
  );


  bloqueioOff = true;


  telegram(
    "SEGURANCA: bomba ultrapassou o tempo maximo de " +
    String(cfg.timeoutMin) +
    " minutos."
  );


  alexa(
    "caixamuitocritica"
  );


  if (!ok) {

    erroSonoff = true;

    sistemaSeguro = false;

    registrarEvento(
      "ATENCAO: desligamento nao confirmado no Sonoff"
    );
  }
}



// ======================================================
// IDENTIFICAR BOIAS ATIVADAS
// ======================================================

String obterBoiasAtivas() {

  String resultado = "";

  if (boia20)
    resultado += "20";

  if (boia40) {

    if (resultado.length() > 0)
      resultado += "-";

    resultado += "40";
  }

  if (boia60) {

    if (resultado.length() > 0)
      resultado += "-";

    resultado += "60";
  }

  if (boia80) {

    if (resultado.length() > 0)
      resultado += "-";

    resultado += "80";
  }

  if (resultado.length() == 0)
    resultado = "0";

  return resultado;
}

// ======================================================
// REGISTRAR INICIO DO CICLO DA BOMBA
// ======================================================

void registrarInicioBomba(
  bool manual
) {

  inicioBomba = millis();

  nivelBombaInicio = nivelAtual;

  boiasBombaInicio =
    obterBoiasAtivas();

  cicloBombaManual = manual;


  struct tm timeinfo;

  if (
    getLocalTime(
      &timeinfo,
      2000
    )
  ) {

    char buffer[25];

    strftime(
      buffer,
      sizeof(buffer),
      "%d/%m/%Y %H:%M:%S",
      &timeinfo
    );

    dataHoraBombaInicio =
      String(buffer);

  } else {

    dataHoraBombaInicio =
      "Horario indisponivel";
  }


  Serial.println();
  Serial.println(
    "=== INICIO CICLO BOMBA ==="
  );

  Serial.print(
    "MODO: "
  );

  Serial.println(
    manual
    ? "MANUAL"
    : "AUTOMATICO"
  );

  Serial.print(
    "NIVEL INICIO: "
  );

  Serial.print(
    nivelBombaInicio
  );

  Serial.println("%");

  Serial.print(
    "BOIAS INICIO: "
  );

  Serial.println(
    boiasBombaInicio
  );

  Serial.print(
    "DATA/HORA: "
  );

  Serial.println(
    dataHoraBombaInicio
  );

  Serial.println(
    "=========================="
  );
}


// ======================================================
// REGISTRAR FIM DO CICLO DA BOMBA
// ======================================================

void registrarFimBomba(
  String motivo
) {

  // Nao existe ciclo ativo
  if (
    inicioBomba == 0
  )
    return;


  if (
  motivo == "Caixa cheia" &&
  boia80
) {

  nivelBombaFim =
    cfg.boia80;

} else {

  nivelBombaFim =
    nivelAtual;
}

boiasBombaFim =
  obterBoiasAtivas();


  unsigned long duracaoMs =
    millis() - inicioBomba;

  unsigned long duracaoSeg =
    duracaoMs / 1000;


  String dataHoraFim;

  struct tm timeinfo;

  if (
    getLocalTime(
      &timeinfo,
      2000
    )
  ) {

    char buffer[25];

    strftime(
      buffer,
      sizeof(buffer),
      "%d/%m/%Y %H:%M:%S",
      &timeinfo
    );

    dataHoraFim =
      String(buffer);

  } else {

    dataHoraFim =
      "Horario indisponivel";
  }


  String modo =
    cicloBombaManual
    ? "MANUAL"
    : "AUTOMATICO";


  Serial.println();
  Serial.println(
    "=== FIM CICLO BOMBA ==="
  );

  Serial.print(
    "MODO: "
  );

  Serial.println(
    modo
  );

  Serial.print(
    "NIVEL INICIO: "
  );

  Serial.print(
    nivelBombaInicio
  );

  Serial.println("%");


  Serial.print(
    "BOIAS INICIO: "
  );

  Serial.println(
    boiasBombaInicio
  );


  Serial.print(
    "NIVEL FIM: "
  );

  Serial.print(
    nivelBombaFim
  );

  Serial.println("%");


  Serial.print(
    "BOIAS FIM: "
  );

  Serial.println(
    boiasBombaFim
  );


  Serial.print(
    "DATA INICIO: "
  );

  Serial.println(
    dataHoraBombaInicio
  );


  Serial.print(
    "DATA FIM: "
  );

  Serial.println(
    dataHoraFim
  );


  Serial.print(
    "DURACAO: "
  );

  Serial.print(
    duracaoSeg
  );

  Serial.println(
    " segundos"
  );


  Serial.print(
    "MOTIVO: "
  );

  Serial.println(
    motivo
  );


  // ====================================================
  // MONTAR JSON
  // ====================================================

  String json = "{";

  json +=
    "\"boias_inicio\":\"" +
    boiasBombaInicio +
    "\",";

  json +=
    "\"boias_fim\":\"" +
    boiasBombaFim +
    "\",";

  json +=
    "\"nivel_inicio\":" +
    String(nivelBombaInicio) +
    ",";

  json +=
    "\"nivel_fim\":" +
    String(nivelBombaFim) +
    ",";

  json +=
    "\"data_inicio\":\"" +
    dataHoraBombaInicio +
    "\",";

  json +=
    "\"data_fim\":\"" +
    dataHoraFim +
    "\",";

  json +=
    "\"duracao_segundos\":" +
    String(duracaoSeg) +
    ",";

  json +=
    "\"modo\":\"" +
    modo +
    "\",";

  json +=
    "\"motivo\":\"" +
    motivo +
    "\"";

  json += "}";


  // ====================================================
  // CHAVE DO HISTÓRICO
  // ====================================================

  String chave =
    String(millis());


  bool resultado =
    firebasePUT(
      "/historico_bomba/" + chave,
      json
    );


  Serial.print(
    "HISTORICO BOMBA -> "
  );

  Serial.println(
    resultado
    ? "SALVO"
    : "ERRO"
  );


  // ====================================================
  // LIMPAR CICLO ATUAL
  // ====================================================

  inicioBomba = 0;

  nivelBombaInicio = 0;

  nivelBombaFim = 0;

  boiasBombaInicio = "";

  boiasBombaFim = "";

  dataHoraBombaInicio = "";

  cicloBombaManual = false;


  Serial.println(
    "========================"
  );
}



// ======================================================
// V4.2: CICLO DA BOMBA - PREVISAO DE ENCHIMENTO E ALERTA
// ======================================================
int proximaMarca(int n, bool inclusivo) {
  int m[4] = { cfg.boia20, cfg.boia40, cfg.boia60, cfg.boia80 };
  for (int i = 0; i < 4; i++) {
    if (inclusivo ? (m[i] >= n) : (m[i] > n)) return m[i];
  }
  return cfg.boia80;
}

void atualizarCiclo() {
  // Inicio do ciclo
  if (bombaLigada && !cicloAnterior) {
    // Automatico: a agua acabou de cair abaixo da marca de cima. Manual: ponto medio da faixa.
    float alto = calcularLitros(proximaMarca(nivelAtual, !cicloBombaManual));
    float baixo = calcularLitros(nivelAtual);
    litrosDegrau = cicloBombaManual ? (baixo + alto) / 2.0f : alto;
    tDegrau = millis();
    tUltimaSubida = millis();
    degrauValido = false;
    nivelCiclo = nivelAtual;
    alertaBomba = false;
  }
  // Fim do ciclo
  if (!bombaLigada && cicloAnterior) {
    previsaoMin = -1;
    alertaBomba = false;
  }
  cicloAnterior = bombaLigada;
  if (!bombaLigada) return;

  // Uma boia nova foi acionada: a agua esta exatamente nessa marca.
  if (nivelAtual > nivelCiclo) {
    unsigned long agora = millis();
    float lit = calcularLitros(nivelAtual);
    float dl = lit - litrosDegrau;
    float dt = (agora - tDegrau) / 60000.0f;
    if (degrauValido && dt > 0.3f && dl > 0) {
      float t = dl / dt;
      taxaLmin = (taxaLmin > 0) ? (0.5f * taxaLmin + 0.5f * t) : t;
    }
    tDegrau = agora;
    litrosDegrau = lit;
    degrauValido = true;
    tUltimaSubida = agora;
    nivelCiclo = nivelAtual;
    alertaBomba = false;
  } else if (nivelAtual < nivelCiclo) {
    nivelCiclo = nivelAtual;
  }

  // Previsao ate o nivel em que a bomba desliga
  int alvo = (cfg.desligar < cfg.boia80) ? cfg.desligar : cfg.boia80;
  if (taxaLmin > 0 && nivelAtual < alvo) {
    float falta = calcularLitros(alvo) - litrosDegrau;
    float est = falta / taxaLmin - (millis() - tDegrau) / 60000.0f;
    previsaoMin = (est < 1) ? 1 : (int)(est + 0.5f);
  } else {
    previsaoMin = -1;
  }

  // Alerta: bomba ligada ha muito tempo sem o nivel subir
  if (!alertaBomba &&
      millis() - tUltimaSubida >= (unsigned long)alertaSemSubidaMin * 60000UL) {
    alertaBomba = true;
    String msg = "ALERTA: bomba ligada ha " + String(alertaSemSubidaMin) +
                 " min sem subir o nivel";
    registrarEvento(msg);
    telegram(msg + ". Verifique a bomba/registro.");
  }
}

// ======================================================
// PUBLICAR ESTADO
// ======================================================

void publicarEstado() {

  if (
    WiFi.status() != WL_CONNECTED
  )
    return;


  String json = "{";

  // V4.2: horario do ESP (para "atualizado ha X"), previsao, alerta e bloqueio
  json += "\"previsao_min\":" + String(bombaLigada ? previsaoMin : -1) + ",";
  json += "\"alerta_bomba\":" + (alertaBomba ? String("true") : String("false")) + ",";
  json += "\"bloqueio_agora\":" + (bloqueadoAgora() ? String("true") : String("false")) + ",";
  json += "\"taxa_l_min\":" + String(taxaLmin, 2) + ",";
  if (epochAgora() > 0) json += "\"ultimo_ts\":" + String(epochAgora()) + ",";



  json +=
    "\"nivel\":" +
    String(nivelAtual) +
    ",";


  json +=
    "\"litros\":" +
    String(
      calcularLitros(nivelAtual),
      1
    ) +
    ",";


  json +=
    "\"status_bomba\":" +
    (
      bombaLigada
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"modo_manual\":" +
    (
      modoManual
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"bloqueio_off\":" +
    (
      bloqueioOff
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"sonoff_online\":" +
    (
      sonoffOnline
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"erro_boias\":" +
    (
      erroBoias
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"erro_sonoff\":" +
    (
      erroSonoff
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"sistema_seguro\":" +
    (
      sistemaSeguro
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"ultimo_evento\":\"";


  for (
    size_t i = 0;
    i < ultimoEvento.length();
    i++
  ) {

    char c = ultimoEvento[i];

    if (
      c == '"' ||
      c == '\\'
    )
      json += '\\';

    json += c;
  }


  json += "\",";


  json +=
    "\"boias\":{";


  json +=
    "\"20\":" +
    (
      boia20
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"40\":" +
    (
      boia40
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"60\":" +
    (
      boia60
      ? String("true")
      : String("false")
    ) +
    ",";


  json +=
    "\"80\":" +
    (
      boia80
      ? String("true")
      : String("false")
    );


  json += "},";


  json +=
    "\"dispositivo\":{";


  json +=
    "\"rssi\":" +
    String(WiFi.RSSI()) +
    ",";


  json +=
    "\"ip\":\"" +
    WiFi.localIP().toString() +
    "\",";


  json +=
    "\"firmware\":\"" +
    String(FW_VERSION) +
    "\",";


  json +=
    "\"inicio_firmware\":\"" +
    inicioFirmware +
    "\"";


  json += "}";


  json += "}";


  bool resultado =
    firebasePATCH(
      "/",
      json
    );


  Serial.print(
    "PUBLICAR ESTADO -> nivel="
  );


  Serial.print(nivelAtual);


  Serial.print(
    "  resultado="
  );


  Serial.println(
    resultado
    ? "OK"
    : "ERRO"
  );
}

// ======================================================
// HEARTBEAT
// ======================================================

void publicarHeartbeat() {

  String json =
    "{\"status\":\"online\",";

  json +=
    "\"rssi\":" +
    String(WiFi.RSSI()) +
    ",";

  json +=
    "\"ip\":\"" +
    WiFi.localIP().toString() +
    "\",";

  json +=
    "\"uptime\":" +
    String(
      millis() / 1000UL
    ) +
    ",";

  json +=
    "\"versao\":\"" +
    String(FW_VERSION) +
    "\"}";


  firebasePUT(
    "/dispositivo",
    json
  );


  firebasePUT(
    "/ultimo_ping",
    String(millis())
  );
}


// ======================================================
// SETUP
// ======================================================

void setup() {

  Serial.begin(115200);

  delay(300);


  // ----------------------------------------------------
  // BOIAS
  // ----------------------------------------------------

  pinMode(
    PIN_BOIA_20,
    INPUT_PULLUP
  );

  pinMode(
    PIN_BOIA_40,
    INPUT_PULLUP
  );

  pinMode(
    PIN_BOIA_60,
    INPUT_PULLUP
  );

  pinMode(
    PIN_BOIA_80,
    INPUT_PULLUP
  );


  // ----------------------------------------------------
  // EEPROM
  // ----------------------------------------------------

  carregarEEPROM();


  // ----------------------------------------------------
  // WIFI
  // ----------------------------------------------------

  WiFi.mode(WIFI_STA);


  WiFiManager wm;


  if (
    !wm.autoConnect(
      "Caixa_Agua_Boias",
      "Config123"
    )
  ) {

    delay(2000);

    ESP.restart();
  }


  // ----------------------------------------------------
  // FIREBASE HTTPS
  // ----------------------------------------------------

  firebaseClient.setInsecure();


  // ----------------------------------------------------
  // INFORMACOES
  // ----------------------------------------------------

  Serial.println();

  Serial.println(
    "================================"
  );

  Serial.println(
    "=== CAIXA D'AGUA V4 ESP32-C3 ==="
  );

  Serial.println(
    "================================"
  );

  Serial.print(
    "IP: "
  );

  Serial.println(
    WiFi.localIP()
  );

  Serial.print(
    "Boia 20% GPIO: "
  );

  Serial.println(
    PIN_BOIA_20
  );

  Serial.print(
    "Boia 40% GPIO: "
  );

  Serial.println(
    PIN_BOIA_40
  );

  Serial.print(
    "Boia 60% GPIO: "
  );

  Serial.println(
    PIN_BOIA_60
  );

  Serial.print(
    "Boia 80% GPIO: "
  );

  Serial.println(
    PIN_BOIA_80
  );


  // ----------------------------------------------------
  // OTA
  // ----------------------------------------------------

  ArduinoOTA.setHostname(
    "Monitor-Boias-ESP32-C3"
  );


  if (
    String(OTA_PASSWORD).length() > 0
  )
    ArduinoOTA.setPassword(
      OTA_PASSWORD
    );


Serial.println();
Serial.println("=== INICIANDO OTA ===");

ArduinoOTA.begin();

Serial.println("=== OTA INICIADO ===");
Serial.print("Hostname OTA: ");
Serial.println("Monitor-Boias-ESP32-C3");
Serial.print("IP OTA: ");
Serial.println(WiFi.localIP());
  
  

  // ----------------------------------------------------
  // NTP
  // ----------------------------------------------------

  configTime(
    -3 * 3600,
    0,
    "pool.ntp.org",
    "a.st1.ntp.br",
    "time.nist.gov"
  );

  struct tm timeinfo;

  if (getLocalTime(&timeinfo, 10000)) {

    char buffer[25];

    strftime(
      buffer,
      sizeof(buffer),
      "%d/%m/%Y %H:%M:%S",
      &timeinfo
    );

    inicioFirmware = String(buffer);

  } else {

    inicioFirmware = "Horario indisponivel";
  }
  
  // ----------------------------------------------------
  // SONOFF
  // ----------------------------------------------------

  {
    String sTaxa;
    if (firebaseGET("/taxa_l_min", sTaxa)) {
      float v = sTaxa.toFloat();
      if (v > 0.5f && v < 500.0f) taxaLmin = v;
    }
  }
  consultarSonoff();


  // ----------------------------------------------------
  // BOIAS
  // ----------------------------------------------------

  processarBoias();


  // ----------------------------------------------------
  // FIREBASE
  // ----------------------------------------------------

  publicarEstado();

  publicarHeartbeat();


  // ----------------------------------------------------
  // EVENTO
  // ----------------------------------------------------

  registrarEvento(
    "ESP32-C3 V4.2 iniciado"
  );


  if (bombaLigada)
    inicioBomba = millis();
}


// ======================================================
// LOOP
// ======================================================

void loop() {

  ArduinoOTA.handle();
  



  unsigned long agora =
    millis();


  int nivelAntes =
    nivelAtual;


  // ----------------------------------------------------
  // BOIAS
  // ----------------------------------------------------

  processarBoias();


  if (
    nivelAtual != nivelAntes
  ) {

    Serial.println(
      "NIVEL MUDOU - PUBLICANDO AGORA"
    );

    publicarEstado();

    ultimoFirebase = millis();
  }


  // ----------------------------------------------------
  // CONFIGURACAO
  // ----------------------------------------------------

  if (
    agora - ultimaConfig >=
    INTERVALO_CONFIG
  ) {

    ultimaConfig = agora;

    lerConfiguracoes();
  }


  // ----------------------------------------------------
  // COMANDOS
  // ----------------------------------------------------

  processarComandos();


  // ----------------------------------------------------
  // SONOFF
  // ----------------------------------------------------

  if (
    agora - ultimoSonoff >=
    INTERVALO_SONOFF
  ) {

    ultimoSonoff = agora;

    consultarSonoff();
  }


  // ----------------------------------------------------
  // AUTOMATICO
  // ----------------------------------------------------

  controlarAutomatico();


  // ----------------------------------------------------
  // TIMEOUT
  // ----------------------------------------------------

  verificarTimeout();
  atualizarCiclo();


  // ----------------------------------------------------
  // FIREBASE
  // ----------------------------------------------------

  if (
    millis() - ultimoFirebase >=
    INTERVALO_FIREBASE
  ) {

    ultimoFirebase = millis();

    publicarEstado();
  }


  // ----------------------------------------------------
  // HEARTBEAT
  // ----------------------------------------------------

  if (
    agora - ultimoHeartbeat >=
    INTERVALO_HEARTBEAT
  ) {

    ultimoHeartbeat = agora;

    publicarHeartbeat();
  }


  delay(20);
}