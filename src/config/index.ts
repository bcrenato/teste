import type { TankConfig, DemoConfig } from '../types';

export const DEFAULT_TANK_CONFIG: TankConfig = {
  capacidade_total: 1000,
  nivel_critico_baixo: 15,
  nivel_normal_min: 20,
  nivel_normal_max: 80,
  nivel_alto: 90,
  nivel_cheio: 100,
};

export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  enabled: true,
  updateIntervalMs: 3000,
  simulatePumpCycles: true,
};

export const API_ENDPOINTS = {
  // Endpoints para integração real com ESP8266/ESP32
  // Configure via variáveis de ambiente no servidor
  data: '/api/data',
  history: '/api/history',
  pumpHistory: '/api/pump-history',
  config: '/api/config',
} as const;

export const STORAGE_KEYS = {
  history: 'water_tank_history',
  pumpHistory: 'water_tank_pump_history',
  config: 'water_tank_config',
  demoMode: 'water_tank_demo_mode',
} as const;

export const UPDATE_INTERVAL_MS = 5000;
export const MAX_HISTORY_POINTS = 200;
export const MAX_PUMP_HISTORY_POINTS = 100;