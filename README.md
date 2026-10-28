# 🏠 Monitor de Caixa d'Água - Sistema de Monitoramento Residencial

Sistema moderno, funcional e visualmente elegante para monitorar o nível de uma caixa d'água residencial em tempo real. Desenvolvido com React, TypeScript, Vite e Chart.js.

![Demo](https://img.shields.io/badge/Demo-Ativo-brightgreen) ![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![Chart.js](https://img.shields.io/badge/Chart.js-4-orange)

---

## ✨ Funcionalidades

### 🎨 Interface Visual
- **Caixa d'água animada em SVG** - Representação 3D realista com água translúcida, ondas suaves, reflexos e sombras
- **Animação contínua da água** - Movimento natural mesmo com nível estável
- **Transições suaves** - Nível da água anima suavemente ao mudar
- **Tubulações animadas** - Entrada/saída de água visível quando bomba ligada/desligada
- **Indicador de nível lateral** - Porcentagem em tempo real ao lado da caixa
- **Design responsivo** - Funciona em desktop, tablet e mobile

### 📊 Dashboard Completo
- **Nível da água** - Porcentagem, volume em litros, capacidade total
- **Estado da bomba** - Ícone animado (LIGADA/DESLIGADA) com partículas de fluxo
- **Status de conexão** - Indicador visual com animação de pulso
- **Última atualização** - Timestamp formatado com tempo relativo
- **Gráficos interativos** - Chart.js com tooltip, zoom e responsividade
  - Variação de nível e volume ao longo do tempo
  - Histórico de funcionamento da bomba (24h)
  - Distribuição de status (Vazia, Baixa, Normal, Enchendo, Cheia)

### 🔧 Modos de Operação
- **Modo Demonstração** - Dados simulados para teste sem hardware (ativado por padrão)
- **Modo Real** - Preparado para integração com ESP8266/ESP32 via API REST

### 🛡️ Segurança
- Variáveis de ambiente para configurações sensíveis
- Validação de dados recebidos
- Separação de camada de API da interface
- Preparado para HTTPS
- Sem credenciais no código do cliente

---

## 🚀 Início Rápido

### Pré-requisitos
- **Node.js 18+** (recomendado 20+)
- **npm 9+** ou **yarn/pnpm**

### Instalação

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd water-tank-monitor

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

### Build para Produção

```bash
# Build otimizado
npm run build

# Preview do build
npm run preview
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (baseado no `.env.example`):

```env
# API do dispositivo (ESP8266/ESP32)
VITE_API_BASE_URL=https://seu-servidor.com/api
VITE_API_KEY=sua-chave-api-aqui

# Configurações da caixa d'água
VITE_TANK_CAPACITY=1000          # Capacidade total em litros
VITE_TANK_LOW_THRESHOLD=15       # % para estado "Vazia/Baixa"
VITE_TANK_NORMAL_MIN=20          # % mínimo para "Normal"
VITE_TANK_NORMAL_MAX=80          # % máximo para "Normal"
VITE_TANK_HIGH_THRESHOLD=90      # % para "Enchendo"
VITE_TANK_FULL_THRESHOLD=100     # % para "Cheia"

# Intervalo de atualização (ms)
VITE_UPDATE_INTERVAL=5000

# Modo demo (true/false)
VITE_DEMO_MODE=true
```

### Configuração da Caixa d'Água

Edite `src/config/index.ts` para ajustar os thresholds padrão:

```typescript
export const DEFAULT_TANK_CONFIG: TankConfig = {
  capacidade_total: 1000,      // Litros
  nivel_critico_baixo: 15,     // %
  nivel_normal_min: 20,        // %
  nivel_normal_max: 80,        // %
  nivel_alto: 90,              // %
  nivel_cheio: 100,            // %
};
```

---

## 🔌 Integração com ESP8266/ESP32

### Formato de Dados Esperado

A API deve retornar JSON no seguinte formato:

```json
{
  "nivel": 75.5,
  "litros": 755,
  "status_bomba": true,
  "timestamp": "2024-01-15T14:30:00.000Z",
  "conectado": true
}
```

### Endpoints Necessários

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/data` | GET | Dados atuais do sensor |
| `/api/history` | GET | Histórico de nível (array) |
| `/api/pump-history` | GET | Histórico da bomba (array) |
| `/api/config` | GET/POST | Configuração da caixa |

### Exemplo de Código para ESP32 (Arduino)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "SUA_REDE";
const char* password = "SUA_SENHA";
const char* serverUrl = "https://seu-servidor.com/api/data";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado!");
}

void loop() {
  // Ler sensor (ex: JSN-SR04T ultrassônico)
  float nivel = lerNivelAgua(); // Sua função de leitura
  bool bomba = digitalRead(PIN_BOMBA);

  StaticJsonDocument<256> doc;
  doc["nivel"] = nivel;
  doc["litros"] = (nivel / 100.0) * 1000; // Capacidade 1000L
  doc["status_bomba"] = bomba;
  doc["timestamp"] = getISOTime(); // Implemente com NTP
  doc["conectado"] = true;

  String json;
  serializeJson(doc, json);

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer SUA_CHAVE_API");
  int httpCode = http.POST(json);
  http.end();

  delay(5000); // Enviar a cada 5s
}
```

---

## 📁 Estrutura do Projeto

```
water-tank-monitor/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── WaterTank/          # Caixa d'água animada (SVG + CSS)
│   │   ├── PumpStatus/         # Status da bomba com animação
│   │   ├── Charts/             # Gráficos (Chart.js)
│   │   ├── StatCard/           # Cards de estatísticas
│   │   ├── ConnectionStatus/   # Indicador de conexão
│   │   ├── LastUpdate/         # Timestamp da última atualização
│   │   └── DemoModeToggle/     # Toggle modo demo/real
│   ├── config/
│   │   └── index.ts            # Configurações padrão
│   ├── services/
│   │   └── api.ts              # Camada de comunicação (API + Demo)
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── utils/
│   │   └── tankUtils.ts        # Funções utilitárias
│   ├── App.tsx                 # Componente principal
│   ├── App.css                 # Estilos de layout
│   ├── index.css               # Estilos globais + reset
│   └── main.tsx                # Entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🎯 Estados do Sistema

| Nível (%) | Status | Cor | Descrição |
|-----------|--------|-----|-----------|
| 0-15% | **Vazia** | 🔴 Vermelho | Crítico - bomba deve ligar |
| 15-20% | **Baixa** | 🟠 Laranja | Atenção - nível baixo |
| 20-80% | **Normal** | 🟢 Verde | Operação normal |
| 80-90% | **Normal/Enchendo** | 🔵 Azul | Bomba pode estar enchendo |
| 90-99% | **Enchendo** | 🔵 Azul | Enchendo ativamente |
| 100% | **Cheia** | 🔵 Ciano | Capacidade máxima |

---

## 🎨 Personalização

### Cores do Tema

Edite as variáveis CSS em `src/index.css`:

```css
:root {
  --color-accent-blue: #38bdf8;
  --color-accent-cyan: #06b6d4;
  --color-accent-green: #22c55e;
  --color-accent-orange: #f97316;
  --color-accent-red: #ef4444;
  /* ... */
}
```

### Animações

Todas as animações respeitam `prefers-reduced-motion: reduce` para acessibilidade.

---

## 🧪 Testes

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit
```

---

## 📦 Deploy

### Vercel / Netlify / Cloudflare Pages

1. Conecte o repositório
2. Build command: `npm run build`
3. Output directory: `dist`
4. Adicione variáveis de ambiente no painel

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🔒 Segurança em Produção

1. **Use HTTPS** - Configure certificado SSL/TLS
2. **Variáveis de ambiente** - Nunca commite `.env` com chaves reais
3. **API protegida** - Implemente autenticação (JWT, API Key) no backend
4. **CORS** - Configure origins permitidos no servidor
5. **Rate limiting** - Proteja endpoints contra abuso
6. **Validação** - Valide todos os dados no backend

---

## 📝 Roadmap / Próximos Passos

- [ ] Autenticação de usuários (login/logout)
- [ ] Múltiplas caixas d'água
- [ ] Alertas por WhatsApp/Email/Telegram
- [ ] Controle remoto da bomba (com confirmação)
- [ ] Exportação de dados (CSV/PDF)
- [ ] PWA (offline support)
- [ ] Tema claro/escuro alternável
- [ ] Internacionalização (i18n)
- [ ] Testes automatizados (Vitest + Playwright)

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

---

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- [React](https://react.dev/) - Biblioteca de UI
- [Vite](https://vite.dev/) - Build tool
- [Chart.js](https://www.chartjs.org/) - Gráficos
- [date-fns](https://date-fns.org/) - Manipulação de datas
- [Inter Font](https://rsms.me/inter/) - Tipografia
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) - Fonte monoespaçada

---

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/water-tank-monitor/issues)
- **Discussões**: [GitHub Discussions](https://github.com/seu-usuario/water-tank-monitor/discussions)

---

**Desenvolvido com ❤️ para automação residencial moderna**