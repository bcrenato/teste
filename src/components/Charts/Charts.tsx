import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  DoughnutController,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { HistoricalDataPoint, PumpHistoryPoint } from '../../types';
import { formatTime } from '../../utils/tankUtils';
import { getTankStatus } from '../../utils/tankUtils';
import './Charts.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  DoughnutController
);

interface LevelChartProps {
  data: HistoricalDataPoint[];
  className?: string;
}

export function LevelChart({ data, className = '' }: LevelChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return null;

    const labels = data.map(d => formatTime(d.timestamp));
    const nivelData = data.map(d => d.nivel);
    const litrosData = data.map(d => d.litros);
    const bombaData = data.map(d => d.status_bomba ? 100 : 0);

    return {
      labels,
      datasets: [
        {
          label: 'Nível (%)',
          data: nivelData,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#0c1a2a',
          pointBorderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: 'Volume (L)',
          data: litrosData,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#22c55e',
          pointBorderColor: '#0c1a2a',
          pointBorderWidth: 2,
          yAxisID: 'y1',
        },
        {
          label: 'Bomba',
          data: bombaData,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          borderWidth: 1.5,
          borderDash: [6, 4],
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#f97316',
          yAxisID: 'y',
        },
      ],
    };
  }, [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          font: {
            family: 'Inter, sans-serif',
            size: 11,
            weight: 500,
          },
          color: '#94a3b8',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(12, 26, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(56, 189, 248, 0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        titleFont: { family: 'Inter, sans-serif', size: 12, weight: 600 },
        bodyFont: { family: 'Inter, sans-serif', size: 11 },
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label === 'Bomba') {
              return `${label}: ${value > 50 ? 'LIGADA' : 'DESLIGADA'}`;
            }
            if (label === 'Volume (L)') {
              return `${label}: ${value.toLocaleString('pt-BR')} L`;
            }
            return `${label}: ${value.toFixed(1).replace('.', ',')}%`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(56, 189, 248, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter, sans-serif', size: 10 },
          maxTicksLimit: 8,
          autoSkip: true,
        },
        border: { color: 'rgba(56, 189, 248, 0.1)' },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(56, 189, 248, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter, sans-serif', size: 10 },
          callback: (value: number) => `${value}%`,
        },
        border: { color: 'rgba(56, 189, 248, 0.1)' },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        min: 0,
        grid: {
          drawOnChartArea: false,
          color: 'rgba(34, 197, 94, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter, sans-serif', size: 10 },
          callback: (value: number) => `${value.toLocaleString('pt-BR')} L`,
        },
        border: { color: 'rgba(34, 197, 94, 0.1)' },
      },
    },
    elements: {
      line: {
        spanGaps: true,
      },
    },
    animation: {
      duration: 750,
      easing: 'easeOutQuart' as const,
    },
  }), []);

  if (!chartData) {
    return (
      <div className={`chart-container ${className}`} style={{ height: '300px' }}>
        <div className="chart-empty">Sem dados históricos</div>
      </div>
    );
  }

  return (
    <div className={`chart-container ${className}`} style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

interface PumpHistoryChartProps {
  data: PumpHistoryPoint[];
  className?: string;
}

export function PumpHistoryChart({ data, className = '' }: PumpHistoryChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return null;

    // Agrupar por hora para visualização mais limpa
    const hourlyData = new Map<string, { on: number; off: number }>();

    data.forEach(point => {
      const date = new Date(point.timestamp);
      const hourKey = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
      const duration = point.duracao_segundos || 0;

      if (!hourlyData.has(hourKey)) {
        hourlyData.set(hourKey, { on: 0, off: 0 });
      }
      const entry = hourlyData.get(hourKey)!;
      if (point.status) {
        entry.on += duration;
      } else {
        entry.off += duration;
      }
    });

    const labels = Array.from(hourlyData.keys()).slice(-24); // Últimas 24 horas
    const onData = labels.map(l => Math.round((hourlyData.get(l)?.on || 0) / 60)); // em minutos
    const offData = labels.map(l => Math.round((hourlyData.get(l)?.off || 0) / 60));

    return {
      labels,
      datasets: [
        {
          label: 'Ligada (min)',
          data: onData,
          backgroundColor: 'rgba(34, 197, 94, 0.6)',
          borderColor: '#22c55e',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Desligada (min)',
          data: offData,
          backgroundColor: 'rgba(71, 85, 105, 0.4)',
          borderColor: '#475569',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          font: {
            family: 'Inter, sans-serif',
            size: 11,
            weight: 500,
          },
          color: '#94a3b8',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(12, 26, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(34, 197, 94, 0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        titleFont: { family: 'Inter, sans-serif', size: 12, weight: 600 },
        bodyFont: { family: 'Inter, sans-serif', size: 11 },
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value} min`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          color: 'rgba(56, 189, 248, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter, sans-serif', size: 10 },
          maxTicksLimit: 10,
          autoSkip: true,
        },
        border: { color: 'rgba(56, 189, 248, 0.1)' },
      },
      y: {
        stacked: true,
        grid: {
          color: 'rgba(56, 189, 248, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter, sans-serif', size: 10 },
          callback: (value: number) => `${value}min`,
        },
        border: { color: 'rgba(56, 189, 248, 0.1)' },
      },
    },
    animation: {
      duration: 750,
      easing: 'easeOutQuart' as const,
    },
  }), []);

  if (!chartData) {
    return (
      <div className={`chart-container ${className}`} style={{ height: '250px' }}>
        <div className="chart-empty">Sem histórico da bomba</div>
      </div>
    );
  }

  return (
    <div className={`chart-container ${className}`} style={{ height: '250px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

interface StatusDistributionChartProps {
  data: HistoricalDataPoint[];
  className?: string;
}

export function StatusDistributionChart({ data, className = '' }: StatusDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return null;

    const statusCounts: Record<string, number> = {
      vazia: 0,
      baixa: 0,
      normal: 0,
      enchendo: 0,
      cheia: 0,
    };

    data.forEach(point => {
      const status = getTankStatus(point);
      statusCounts[status]++;
    });

    return {
      labels: ['Vazia', 'Baixa', 'Normal', 'Enchendo', 'Cheia'],
      datasets: [{
        data: [
          statusCounts.vazia,
          statusCounts.baixa,
          statusCounts.normal,
          statusCounts.enchendo,
          statusCounts.cheia,
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.6)',
          'rgba(249, 115, 22, 0.6)',
          'rgba(34, 197, 94, 0.6)',
          'rgba(59, 130, 246, 0.6)',
          'rgba(6, 182, 212, 0.6)',
        ],
        borderColor: [
          '#ef4444',
          '#f97316',
          '#22c55e',
          '#3b82f6',
          '#06b6d4',
        ],
        borderWidth: 2,
        borderRadius: 8,
        spacing: 2,
      }],
    };
  }, [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 12,
          font: {
            family: 'Inter, sans-serif',
            size: 11,
            weight: 500,
          },
          color: '#94a3b8',
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(12, 26, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(56, 189, 248, 0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        titleFont: { family: 'Inter, sans-serif', size: 12, weight: 600 },
        bodyFont: { family: 'Inter, sans-serif', size: 11 },
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${context.label}: ${value} leituras (${percent.replace('.', ',')}%)`;
          },
        },
      },
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000,
      easing: 'easeOutQuart' as const,
    },
  }), []);

  if (!chartData) {
    return (
      <div className={`chart-container ${className}`} style={{ height: '250px' }}>
        <div className="chart-empty">Sem dados para distribuição</div>
      </div>
    );
  }

  return (
    <div className={`chart-container ${className}`} style={{ height: '250px' }}>
      <div className="chart-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}