# Guia: instalar o sistema em outra casa (sistema independente)

Cada casa tem o seu próprio Firebase, a sua placa e o seu site. Nada é compartilhado.

## O que você precisa
- 1 ESP32-C3, 4 boias, 1 Sonoff (com a mesma firmware/API do seu), fonte e rede Wi-Fi.
- Uma conta Google (pode ser a sua) e uma conta no GitHub.

## 1. Firebase (projeto novo)
1. console.firebase.google.com > Adicionar projeto (ex.: caixa-agua-casa2).
2. Criação > Realtime Database > Criar banco (modo bloqueado). Anote a URL (databaseURL).
3. Criação > Authentication > Começar > E-mail/senha > Ativar. Aba Usuários > adicionar os usuários. Configurações > Ações do usuário > desmarcar "Ativar criação (cadastro)".
4. Configurações do projeto > Seus apps > Web (</>) > registrar app > copiar o objeto `firebaseConfig`.
5. Configurações do projeto > Contas de serviço > Secrets do banco de dados > copiar o secret (vai no ESP).
6. Realtime Database > Regras > colar o conteúdo de REGRAS-DO-FIREBASE.json > Publicar.

## 2. Site (GitHub Pages)
1. Novo repositório (ex.: casa2) com os arquivos do site na raiz. Settings > Pages > main / root.
2. No app.js troque o bloco `firebaseConfig` pelo do projeto novo.
3. Notificações (opcional): Cloud Messaging > Certificados push da Web > gerar chave > colar em `VAPID_KEY`; `firebase deploy --only functions` (plano Blaze) e ajuste `instance` e `REGION` em functions/index.js.
4. Abra https://SEU-USUARIO.github.io/casa2/ , entre com o usuário criado.

## 3. Placa (ESP32-C3)
No arquivo .ino altere, no topo:
- FIREBASE_HOST (URL do banco novo) e FIREBASE_AUTH (o secret).
- SONOFF_IP (IP do Sonoff dessa casa).
- OTA hostname e OTA_PASSWORD (diferentes dos da outra casa).
- TELEGRAM_TOKEN/CHAT e VOICEMONKEY (se usar), com tokens próprios.
- Pinos das boias, se a ligação for diferente.
Grave por cabo na primeira vez (Partition Scheme: Minimal SPIFFS 1.9MB APP with OTA). Na primeira ligação conecte ao Wi-Fi "Caixa_Agua_Boias" e escolha a rede da casa.

## 4. Configuração no app (Ajustes)
1. Nome do local (aparece no título).
2. Capacidade nominal, altura interna e diâmetros da base e do topo (medidas internas da caixa).
3. Altura de cada boia em cm, do fundo.
4. Margem de queda, nível para ligar/desligar, tempo máximo, alerta de bomba sem subir.
5. Horário de bloqueio, se quiser.
6. Salvar. A calibração visual já vem alinhada ao desenho; ajuste fino só se precisar.

## 5. APK (opcional)
No apk.yml troque a URL do site (3 lugares) e, em capacitor.config, o appId (ex.: br.com.caixadagua.casa2) e o appName. Gere o APK pelo GitHub Actions.

## 6. Testes
- Teste do balde: meça a vazão real da bomba e compare com `taxa_l_min` no Firebase.
- Ligue/desligue pelo app e confira que a bomba responde e que o registro de quem comandou aparece em Atividade.
- Feche o registro do Wi-Fi e confira o aviso "ESP sem sinal".
