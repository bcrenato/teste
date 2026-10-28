import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  className?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'cyan';
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendValue,
  className = '',
  color = 'blue'
}: StatCardProps) {
  const colorClasses = {
    blue: 'stat-blue',
    green: 'stat-green',
    orange: 'stat-orange',
    red: 'stat-red',
    cyan: 'stat-cyan',
  };

  const trendIcons = {
    up: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    ),
    down: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    ),
    stable: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M5 12h14" />
      </svg>
    ),
  };

  const trendColors = {
    up: '#22c55e',
    down: '#ef4444',
    stable: '#64748b',
  };

  return (
    <div className={`stat-card ${colorClasses[color]} ${className}`}>
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value-wrapper">
        <span className="stat-value">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {(trend || trendValue) && (
        <div className="stat-trend" style={{ color: trend ? trendColors[trend] : undefined }}>
          {trend && trendIcons[trend]}
          {trendValue && <span className="stat-trend-value">{trendValue}</span>}
        </div>
      )}
    </div>
  );
}