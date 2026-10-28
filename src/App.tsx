import { useState, useEffect, useCallback } from 'react';
import { WaterTankData, HistoricalDataPoint, PumpHistoryPoint, TankConfig } from './types';
import { apiService } from './services/api';
import { getTankStatus, formatLitros, calculateLitros } from './utils/tankUtils';
import { DEFAULT_TANK_CONFIG, UPDATE_INTERVAL_MS } from './config';
import { WaterTank } from './components/WaterTank/WaterTank';
import { PumpStatus } from './components/PumpStatus/PumpStatus';
import { LevelChart, PumpHistoryChart, StatusDistributionChart } from './components/Charts/Charts';
import { StatCard } from './components/StatCard/StatCard';
import { ConnectionStatus } from './components/ConnectionStatus/ConnectionStatus';
import { LastUpdate } from './components/LastUpdate/LastUpdate';
import { DemoModeToggle } from './components/DemoModeToggle/DemoModeToggle';
import './App.css';

function App() {
  const [currentData, setCurrentData] = useState<WaterTankData | null>(null);
  const [history, setHistory] = useState<HistoricalDataPoint[]>([]);
  const [pumpHistory, setPumpHistory] = useState<PumpHistoryPoint[]>([]);
  const [tankConfig, setTankConfig] = useState<TankConfig>(DEFAULT_TANK_CONFIG);
  const [lastPumpChange, setLastPumpChange] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados iniciais
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [data, hist, pumpHist] = await Promise.all([
        apiService.fetchCurrentData(),
        apiService.fetchHistory(),
        apiService.fetchPumpHistory(),
      ]);

      setCurrentData(data);
      setHistory(hist);
      setPumpHistory(pumpHist);

      // Detectar última mudança da bomba
      if (pumpHist.length > 0) {
        setLastPumpChange(pumpHist[pumpHist.length - 1].timestamp);
      }
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
      setError('Falha ao carregar dados. Verifique a conexão.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Atualização periódica
  useEffect(() => {
    loadInitialData();

    const interval = setInterval(async () => {
      try {
        const data = await apiService.fetchCurrentData();
        const prevPumpState = currentData?.status_bomba;

        setCurrentData(data);
        apiService.saveHistory(data);

        // Atualizar histórico local
        setHistory(prev => {
          const updated = [...prev, {
            timestamp: data.timestamp,
            nivel: data.nivel,
            litros: data.litros,
            status_bomba: data.status_bomba,
          }];
          return updated.slice(-200);
        });

        // Detectar mudança de estado da bomba
        if (prevPumpState !== undefined && prevPumpState !== data.status_bomba) {
          setLastPumpChange(data.timestamp);
          const pumpPoint = {
            timestamp: data.timestamp,
            status: data.status_bomba,
            duracao_segundos: 0, // Será calculado na próxima mudança
          };
          apiService.savePumpHistory(pumpPoint);
          setPumpHistory(prev => [...prev, pumpPoint].slice(-100));
        }
      } catch (err) {
        console.error('Erro na atualização periódica:', err);
      }
    }, UPDATE_INTERVAL_MS);

    // Escutar eventos do modo demo
    const unsubscribe = apiService.subscribe((data) => {
      setCurrentData(data);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [loadInitialData, currentData?.status_bomba]);

  // Calcular tendência do nível
  const getLevelTrend = () => {
    if (history.length < 2) return 'stable' as const;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const diff = last.nivel - prev.nivel;
    if (diff > 0.5) return 'up' as const;
    if (diff < -0.5) return 'down' as const;
    return 'stable' as const;
  };

  // Calcular tendência do volume
  const getVolumeTrend = () => {
    if (history.length < 2) return 'stable' as const;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const diff = last.litros - prev.litros;
    if (diff > 5) return 'up' as const;
    if (diff < -5) return 'down' as const;
    return 'stable' as const;
  };

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-screen">
          <div className="loading-tank" aria-hidden="true">
            <svg viewBox="0 0 100 150" width="80" height="120">
              <rect x="15" y="20" width="70" height="110" rx="8" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.3" />
              <rect x="18" y="110" width="64" height="20" rx="2" fill="#38bdf8" opacity="0.4">
                <animate attributeName="height" values="20;60;20" dur="2s" repeatCount="indefinite" />
                <animate attributeName="y" values="110;70;110" dur="2s" repeatCount="indefinite" />
              </rect>
            </svg>
          </div>
          <p className="loading-text">Carregando monitoramento...</p>
          <div className="loading-spinner" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="app error">
        <div className="error-screen">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h2>Erro ao carregar dados</h2>
          <p>{error || 'Não foi possível conectar ao sistema'}</p>
          <button onClick={loadInitialData} className="retry-btn">Tentar novamente</button>
        </div>
      </div>
    );
  }

  const status = getTankStatus(currentData, tankConfig);
  const litros = currentData.litros || calculateLitros(currentData.nivel, tankConfig.capacidade_total);
  const levelTrend = getLevelTrend();
  const volumeTrend = getVolumeTrend();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              <path d="M12 12a5 5 0 0 1 0 10" strokeDasharray="15" strokeDashoffset="15" />
            </svg>
          </div>
          <div className="title-group">
            <h1>Monitor de Caixa d'Água</h1>
            <span className="subtitle">Sistema de monitoramento residencial</span>
          </div>
        </div>
        <div className="header-right">
          <ConnectionStatus connected={currentData.conectado ?? true} />
          <DemoModeToggle />
        </div>
      </header>

      <main className="app-main">
        {/* Seção principal: Caixa d'água + Bomba */}
        <section className="main-section" aria-labelledby="main-title">
          <h2 id="main-title" className="section-title visually-hidden">Status Principal</h2>

          <div className="main-grid">
            {/* Caixa d'água animada */}
            <div className="tank-card">
              <WaterTank data={currentData} capacity={tankConfig.capacidade_total} />
            </div>

            {/* Bomba + Cards de status */}
            <div className="side-cards">
              <PumpStatus data={currentData} lastChangeTime={lastPumpChange || undefined} />

              <div className="status-grid">
                <StatCard
                  label="Nível Atual"
                  value={currentData.nivel.toFixed(1).replace('.', ',')}
                  unit="%"
                  trend={levelTrend}
                  trendValue={levelTrend !== 'stable' ? `${Math.abs(currentData.nivel - (history[history.length - 2]?.nivel || currentData.nivel)).toFixed(1).replace('.', ',')}%` : undefined}
                  color="cyan"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                  }
                />

                <StatCard
                  label="Volume"
                  value={formatLitros(litros)}
                  unit=""
                  trend={volumeTrend}
                  trendValue={volumeTrend !== 'stable' ? `${Math.abs(litros - (history[history.length - 2]?.litros || litros)).toLocaleString('pt-BR')} L` : undefined}
                  color="blue"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M12 3v18" />
                    </svg>
                  }
                />

                <StatCard
                  label="Capacidade Total"
                  value={formatLitros(tankConfig.capacidade_total)}
                  unit=""
                  color="green"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
                      <path d="M12 22.08V12" />
                    </svg>
                  }
                />
              </div>
            </div>
          </div>
        </section>

        {/* Seção de gráficos */}
        <section className="charts-section" aria-labelledby="charts-title">
          <h2 id="charts-title" className="section-title">Histórico e Gráficos</h2>

          <div className="charts-grid">
            <div className="chart-card large">
              <h3 className="chart-title">Nível e Volume ao Longo do Tempo</h3>
              <LevelChart data={history} />
            </div>

            <div className="chart-card">
              <h3 className="chart-title">Funcionamento da Bomba (24h)</h3>
              <PumpHistoryChart data={pumpHistory} />
            </div>

            <div className="chart-card">
              <h3 className="chart-title">Distribuição de Status</h3>
              <StatusDistributionChart data={history} />
            </div>
          </div>
        </section>

        {/* Rodapé com última atualização */}
        <footer className="app-footer">
          <LastUpdate timestamp={currentData.timestamp} />
          <div className="footer-info">
            <span>Atualização automática a cada {UPDATE_INTERVAL_MS / 1000}s</span>
            {apiService.isDemoMode() && (
              <span className="demo-notice">⚠ Modo demonstração ativo - dados simulados</span>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;