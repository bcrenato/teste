import type { WaterTankData, TankConfig, TankStatus } from '../types';
import { DEFAULT_TANK_CONFIG } from '../config';

export function getTankStatus(data: WaterTankData, config: TankConfig = DEFAULT_TANK_CONFIG): TankStatus {
  const { nivel, status_bomba } = data;
  const { nivel_critico_baixo, nivel_normal_min, nivel_normal_max, nivel_alto, nivel_cheio } = config;

  if (nivel <= nivel_critico_baixo) {
    return 'vazia';
  }
  if (nivel < nivel_normal_min) {
    return 'baixa';
  }
  if (nivel >= nivel_cheio) {
    return 'cheia';
  }
  if (nivel >= nivel_alto) {
    return status_bomba ? 'enchendo' : 'normal';
  }
  if (nivel > nivel_normal_max) {
    return status_bomba ? 'enchendo' : 'normal';
  }
  return 'normal';
}

export function getTankStatusLabel(status: TankStatus): string {
  const labels: Record<TankStatus, string> = {
    vazia: 'Vazia',
    baixa: 'Baixa',
    normal: 'Normal',
    enchendo: 'Enchendo',
    cheia: 'Cheia',
  };
  return labels[status];
}

export function getTankStatusColor(status: TankStatus): string {
  const colors: Record<TankStatus, string> = {
    vazia: '#ef4444',      // red-500
    baixa: '#f97316',      // orange-500
    normal: '#22c55e',     // green-500
    enchendo: '#3b82f6',   // blue-500
    cheia: '#06b6d4',      // cyan-500
  };
  return colors[status];
}

export function formatLitros(litros: number): string {
  if (litros >= 1000) {
    return `${(litros / 1000).toFixed(1).replace('.', ',')} mil L`;
  }
  return `${litros.toLocaleString('pt-BR')} L`;
}

export function formatPercent(nivel: number): string {
  return `${nivel.toFixed(1).replace('.', ',')}%`;
}

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--/--/---- --:--:--';
  }
}

export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}min ${remainingSeconds}s` : `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

export function calculateLitros(nivel: number, capacidadeTotal: number): number {
  return Math.round((nivel / 100) * capacidadeTotal);
}

export function calculateNivel(litros: number, capacidadeTotal: number): number {
  if (capacidadeTotal <= 0) return 0;
  return Math.max(0, Math.min(100, (litros / capacidadeTotal) * 100));
}