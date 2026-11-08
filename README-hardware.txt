CAIXA D'AGUA V4 - ESP8266 CH340C

ARQUIVOS
- esp8266_caixa_v4.ino: firmware para NodeMCU ESP8266.
- index.html: painel principal.
- config.html: configuração e comandos.
- script.js: Firebase, painel e gráfico.

HARDWARE
- D1/GPIO5 = boia 20%
- D2/GPIO4 = boia 40%
- D5/GPIO14 = boia 60%
- D6/GPIO12 = boia 80%
Cada boia deve ficar entre o GPIO e GND. Use INPUT_PULLUP. Não aplique 5 V aos GPIOs.

LOGICA
- 0, 20, 40, 60 ou 80% são estados válidos.
- Combinação não cumulativa é considerada erro e bloqueia a automação.
- Padrões válidos: 0000, 1000, 1100, 1110, 1111.
- AUTO: liga em <=40% e desliga em >=80%.
- OFF pelo painel: coloca MANUAL + bloqueio OFF, impedindo o AUTO de religar.
- AUTO: remove o bloqueio e devolve o controle à automação.
- Timeout também vale para acionamento manual.
- O ESP confirma o estado real do Sonoff depois do comando.

SONOFF
IP configurado: 192.168.1.71
Consulta: /cm?cmnd=Power
Liga: /cm?cmnd=Power%20On
Desliga: /cm?cmnd=Power%20Off

FIREBASE
Projeto: monitor-caixa-agua-ff63a
Preencha no firmware FIREBASE_AUTH com uma credencial RTDB compatível com ?auth=.
No site, substitua SUA_API_KEY_FIREBASE pela API Key do projeto.
A API Key web não deve ser tratada como segredo; proteja o acesso pelas Firebase Realtime Database Rules.

OTA
Altere OTA_PASSWORD antes de usar.

WIFI MANAGER
Na primeira configuração, o ESP cria a rede Caixa_Agua_Boias com senha Config123.

OBSERVAÇÃO
Coloque caixa.png na mesma pasta do index.html se quiser manter a imagem personalizada da caixa. O painel funciona sem ela.

SEGURANÇA ELÉTRICA
O software não substitui proteção elétrica. Mantenha contatora/relé adequado, proteção contra sobrecarga e um meio físico de desligamento da bomba.
