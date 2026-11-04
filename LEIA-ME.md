# Caixa d'Água — app web (PWA)

## 1. Publicar no GitHub Pages
Substitua os arquivos do repositório `caixa_dagua` por estes (apague `config.html`, `script.js`, `icone.png`; o resto é novo ou atualizado) e dê commit.
Pages: Settings › Pages › Branch `main` / root. URL: https://bcrenato.github.io/caixa_dagua/

**iPhone:** Safari › Compartilhar › *Adicionar à Tela de Início*. Abra pelo ícone criado (push só funciona assim, iOS 16.4+).

## 2. APK para Android (sem programar)
1. Abra https://www.pwabuilder.com e cole a URL do Pages.
2. *Package for stores* › **Android** › gere o pacote. Baixe o `.apk` (ou `.aab`) e instale no celular.
3. O APK é um “TWA”: abre o seu site em tela cheia e as notificações push funcionam normalmente.
(Guarde o arquivo de assinatura/keystore que o PWABuilder fornece para futuras atualizações.)

## 3. Notificações push (Firebase Cloud Messaging)
O ESP8266 só grava no Realtime Database; quem envia o push é uma Cloud Function (gratuita no uso normal, mas exige o plano **Blaze** do Firebase com cartão).
1. Firebase Console › Configurações do projeto › Cloud Messaging › *Certificados push da Web* › **Gerar par de chaves**. Cole a chave em `VAPID_KEY` no `app.js`.
2. No PC: `npm i -g firebase-tools`, `firebase login`, `firebase use monitor-caixa-agua-ff63a`, `firebase deploy --only functions`.
3. No app: Ajustes › **Ativar notificações** (escolha quais avisos quer).
Se o seu Realtime Database não estiver em `us-central1`, ajuste `REGION` em `functions/index.js`.

## Segurança (importante)
O app não tem login: quem souber o endereço pode comandar a bomba se as regras do Realtime Database estiverem abertas. Restrinja a API Key por domínio (Google Cloud › Credenciais) e considere Firebase Auth + regras.
