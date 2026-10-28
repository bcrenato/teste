import type { WaterTankData, HistoricalDataPoint, PumpHistoryPoint, TankConfig, DemoConfig } from '../types';
import { DEFAULT_TANK_CONFIG, DEFAULT_DEMO_CONFIG, API_ENDPOINTS, STORAGE_KEYS, MAX_HISTORY_POINTS, MAX_PUMP_HISTORY_POINTS } from '../config';

export class ApiService {
  private static instance: ApiService;
  private demoMode: boolean = DEFAULT_DEMO_CONFIG.enabled;
  private demoConfig: DemoConfig = DEFAULT_DEMO_CONFIG;
  private tankConfig: TankConfig = DEFAULT_TANK_CONFIG;
  private listeners: Set<(data: WaterTankData) => void> = new Set();
  private demoInterval: ReturnType<typeof setInterval> | null = null;
  private lastPumpState: boolean = false;
  private pumpCycleStart: number = Date.now();

  private constructor() {
    this.loadConfig();
    this.loadDemoMode();
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.config);
      if (stored) {
        this.tankConfig = { ...DEFAULT_TANK_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Erro ao carregar configuração:', e);
    }
  }

  private loadDemoMode(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.demoMode);
      if (stored !== null) {
        this.demoMode = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao carregar modo demo:', e);
    }
  }

  async fetchCurrentData(): Promise<WaterTankData> {
    if (this.demoMode) {
      return this.generateDemoData();
    }

    try {
      const response = await fetch(API_ENDPOINTS.data);
      if (!response.ok) throw new Error('Falha na requisição');
      const data = await response.json();
      return this.validateData(data);
    } catch (error) {
      console.error('Erro ao buscar dados reais:', error);
      // Fallback para demo se falhar
      return this.generateDemoData();
    }
  }

  async fetchHistory(): Promise<HistoricalDataPoint[]> {
    if (this.demoMode) {
      return this.getDemoHistory();
    }

    try {
      const response = await fetch(API_ENDPOINTS.history);
      if (!response.ok) throw new Error('Falha na requisição');
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return this.getDemoHistory();
    }
  }

  async fetchPumpHistory(): Promise<PumpHistoryPoint[]> {
    if (this.demoMode) {
      return this.getDemoPumpHistory();
    }

    try {
      const response = await fetch(API_ENDPOINTS.pumpHistory);
      if (!response.ok) throw new Error('Falha na requisição');
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar histórico da bomba:', error);
      return this.getDemoPumpHistory();
    }
  }

  private validateData(data: unknown): WaterTankData {
    const d = data as Record<string, unknown>;
    return {
      nivel: Math.max(0, Math.min(100, Number(d.nivel) || 0)),
      litros: Math.max(0, Number(d.litros) || 0),
      status_bomba: Boolean(d.status_bomba),
      timestamp: d.timestamp ? new Date(d.timestamp as string).toISOString() : new Date().toISOString(),
      conectado: Boolean(d.conectado),
    };
  }

  private generateDemoData(): WaterTankData {
    // Simula variação suave do nível da água
    const now = Date.now();
    const cycle = (now / 30000) % 2; // Ciclo de 30 segundos
    const baseLevel = 30 + Math.sin(cycle * Math.PI) * 25; // Varia entre 5% e 55%
    const variation = (Math.random() - 0.5) * 4; // Variação aleatória pequena
    const nivel = Math.max(0, Math.min(100, baseLevel + variation));

    // Simula bomba ligando quando nível baixo e desligando quando alto
    let status_bomba = this.lastPumpState;
    if (this.demoConfig.simulatePumpCycles) {
      if (nivel < this.tankConfig.nivel_critico_baixo && !status_bomba) {
        status_bomba = true;
        this.pumpCycleStart = now;
      } else if (nivel > this.tankConfig.nivel_normal_max && status_bomba) {
        status_bomba = false;
      }
    }
    this.lastPumpState = status_bomba;

    // Se bomba ligada, nível sobe mais rápido
    const litros = Math.round((nivel / 100) * this.tankConfig.capacidade_total);

    return {
      nivel: Math.round(nivel * 10) / 10,
      litros,
      status_bomba,
      timestamp: new Date().toISOString(),
      conectado: true,
    };
  }

  private getDemoHistory(): HistoricalDataPoint[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.history);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao carregar histórico demo:', e);
    }

    // Gerar histórico simulado das últimas 24 horas
    const history: HistoricalDataPoint[] = [];
    const now = Date.now();
    for (let i = 100; i >= 0; i--) {
      const time = now - i * 15 * 60 * 1000; // A cada 15 minutos
      const cycle = (time / 30000) % 2;
      const baseLevel = 30 + Math.sin(cycle * Math.PI) * 25;
      const variation = (Math.random() - 0.5) * 4;
      const nivel = Math.max(0, Math.min(100, baseLevel + variation));
      const status_bomba = nivel < this.tankConfig.nivel_critico_baixo;
      history.push({
        timestamp: new Date(time).toISOString(),
        nivel: Math.round(nivel * 10) / 10,
        litros: Math.round((nivel / 100) * this.tankConfig.capacidade_total),
        status_bomba,
      });
    }
    return history;
  }

  private getDemoPumpHistory(): PumpHistoryPoint[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.pumpHistory);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao carregar histórico da bomba demo:', e);
    }

    // Gerar histórico da bomba simulado
    const history: PumpHistoryPoint[] = [];
    const now = Date.now();
    let pumpOn = false;
    let lastChange = now - 24 * 60 * 60 * 1000;

    for (let i = 50; i >= 0; i--) {
      const time = now - i * 30 * 60 * 1000; // A cada 30 minutos
      const cycle = (time / 30000) % 2;
      const baseLevel = 30 + Math.sin(cycle * Math.PI) * 25;
      const shouldBeOn = baseLevel < this.tankConfig.nivel_critico_baixo;

      if (shouldBeOn !== pumpOn) {
        history.push({
          timestamp: new Date(lastChange).toISOString(),
          status: pumpOn,
          duracao_segundos: Math.round((time - lastChange) / 1000),
        });
        pumpOn = shouldBeOn;
        lastChange = time;
      }
    }

    // Adicionar estado atual
    history.push({
      timestamp: new Date(lastChange).toISOString(),
      status: pumpOn,
      duracao_segundos: Math.round((now - lastChange) / 1000),
    });

    return history;
  }

  saveHistory(data: WaterTankData): void {
    try {
      const history = this.getDemoHistory();
      history.push({
        timestamp: data.timestamp,
        nivel: data.nivel,
        litros: data.litros,
        status_bomba: data.status_bomba,
      });

      // Manter apenas os últimos N pontos
      if (history.length > MAX_HISTORY_POINTS) {
        history.splice(0, history.length - MAX_HISTORY_POINTS);
      }

      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    } catch (e) {
      console.warn('Erro ao salvar histórico:', e);
    }
  }

  savePumpHistory(point: PumpHistoryPoint): void {
    try {
      const history = this.getDemoPumpHistory();
      history.push(point);

      if (history.length > MAX_PUMP_HISTORY_POINTS) {
        history.splice(0, history.length - MAX_PUMP_HISTORY_POINTS);
      }

      localStorage.setItem(STORAGE_KEYS.pumpHistory, JSON.stringify(history));
    } catch (e) {
      console.warn('Erro ao salvar histórico da bomba:', e);
    }
  }

  subscribe(listener: (data: WaterTankData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(data: WaterTankData): void {
    this.listeners.forEach(listener => listener(data));
  }

  startDemoMode(): void {
    if (this.demoInterval) return;

    this.demoMode = true;
    localStorage.setItem(STORAGE_KEYS.demoMode, 'true');

    this.demoInterval = setInterval(async () => {
      const data = this.generateDemoData();
      this.saveHistory(data);
      this.notifyListeners(data);
    }, this.demoConfig.updateIntervalMs);
  }

  stopDemoMode(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.demoMode = false;
    localStorage.setItem(STORAGE_KEYS.demoMode, 'false');
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  setDemoMode(enabled: boolean): void {
    if (enabled) {
      this.startDemoMode();
    } else {
      this.stopDemoMode();
    }
  }

  getTankConfig(): TankConfig {
    return { ...this.tankConfig };
  }

  updateTankConfig(config: Partial<TankConfig>): void {
    this.tankConfig = { ...this.tankConfig, ...config };
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(this.tankConfig));
  }

  getDemoConfig(): DemoConfig {
    return { ...this.demoConfig };
  }

  updateDemoConfig(config: Partial<DemoConfig>): void {
    this.demoConfig = { ...this.demoConfig, ...config };
    if (this.demoMode && this.demoInterval) {
      this.stopDemoMode();
      this.startDemoMode();
    }
  }
}

export const apiService = ApiService.getInstance();