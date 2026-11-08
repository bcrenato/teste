# Atualização v2 (para o ESP32-C3)

## O que o arquivo do ESP traz de novo (caixa_dagua_v4_2_esp32c3.ino)
Seu código v4.1 continua igual; foram acrescentados só estes pontos:
1. `fbUrl` agora envia `?auth=` (no seu código a credencial era ignorada, então o ESP só funcionava com o banco aberto).
2. `ultimo_ts` (horário do ESP) no PATCH de estado -> "Atualizado há X" no app.
3. Previsão para encher (`previsao_min`), alerta de bomba sem subir o nível (`alerta_bomba`) e bloqueio por horário (`bloqueio_agora`).
4. Eventos com horário (`ts`) -> aba Atividade.
Os tokens do Telegram e do VoiceMonkey foram deixados em branco no arquivo: veja o passo 1.

## Ordem de aplicação
1. SEGREDOS: o arquivo que você enviou tinha o token do Telegram, o do VoiceMonkey e a senha OTA em texto. Como foram compartilhados, gere novos: Telegram (BotFather > /revoke), VoiceMonkey (gerar novo token) e troque OTA_PASSWORD. Cole os novos tokens no .ino.
2. Firebase Console > Configurações do projeto > Contas de serviço > Secrets do banco de dados > copie o secret e cole em FIREBASE_AUTH no .ino.
3. Grave o .ino no ESP32-C3 (OTA ou cabo) e confira no Monitor Serial que o PATCH e os GET dão código 200.
4. Suba para o GitHub: index.html, app.css, app.js, sw.js e functions/index.js. Apague consumo.html, consumo.js e style.css.
5. Authentication > ative E-mail/senha, crie os usuários e desmarque "Ativar criação (cadastro)".
6. Por último, Realtime Database > Regras > cole REGRAS-DO-FIREBASE.json > Publicar.
7. `firebase deploy --only functions` (inclui o aviso da bomba sem subir).

## Se aparecer "Sketch too big" e a placa estiver sem acesso por cabo
1. Compile o seu arquivo ANTIGO (v4.1) com o esquema de partição padrão. Se ele também passar de 1.310.720 bytes, a placa foi gravada com um esquema maior e o aviso é só da configuração do IDE.
2. Ferramentas > Partition Scheme > "Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)" e grave pela rede (Porta de rede / OTA).
3. Se a gravação por rede falhar, o firmware antigo continua funcionando (nada é perdido).
4. O arquivo novo traz SERIAL_DEBUG 0 (Monitor Serial desligado) para economizar espaço; mude para 1 se quiser ver as mensagens.
