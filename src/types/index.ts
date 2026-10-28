export interface WaterTankData {
  nivel: number;           // Porcentagem de 0 a 100
  litros: number;          // Volume estimado em litros
  status_bomba: boolean;   // Estado da bomba
  timestamp: string;       // ISO 8601 date string
  conectado?: boolean;     // Estado da comunicação
}

export interface TankConfig {
  capacidade_total: number;    // Capacidade total em litros
  nivel_critico_baixo: number; // % para estado "Vazia/Baixa"
  nivel_normal_min: number;    // % mínimo para "Normal"
  nivel_normal_max: number;    // % máximo para "Normal"
  nivel_alto: number;          // % para "Enchendo"
  nivel_cheio: number;         // % para "Cheia"
}

export interface HistoricalDataPoint {
  timestamp: string;
  nivel: number;
  litros: number;
  status_bomba: boolean;
}

export interface PumpHistoryPoint {
  timestamp: string;
  status: boolean;
  duracao_segundos?: number;
}

export type TankStatus = 'vazia' | 'baixa' | 'normal' | 'enchendo' | 'cheia';

export interface DemoConfig {
  enabled: boolean;
  updateIntervalMs: number;
  simulatePumpCycles: boolean;
}