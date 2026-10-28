import { formatDateTime, formatTime } from '../../utils/tankUtils';
import './LastUpdate.css';

interface LastUpdateProps {
  timestamp: string;
  className?: string;
  compact?: boolean;
}

export function LastUpdate({ timestamp, className = '', compact = false }: LastUpdateProps) {
  const formattedDate = formatDateTime(timestamp);
  const formattedTime = formatTime(timestamp);
  const now = Date.now();
  const dataTime = new Date(timestamp).getTime();
  const diffMs = now - dataTime;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  let relativeTime = '';
  if (diffSeconds < 60) {
    relativeTime = 'agora mesmo';
  } else if (diffMinutes < 60) {
    relativeTime = `há ${diffMinutes} min`;
  } else if (diffHours < 24) {
    relativeTime = `há ${diffHours}h`;
  } else {
    relativeTime = formattedDate;
  }

  const isStale = diffSeconds > 120; // Mais de 2 minutos sem atualização

  if (compact) {
    return (
      <div className={`last-update compact ${isStale ? 'stale' : ''} ${className}`}>
        <span className="update-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <span className="update-time" title={formattedDate}>{formattedTime}</span>
        <span className="update-relative">{relativeTime}</span>
      </div>
    );
  }

  return (
    <div className={`last-update ${isStale ? 'stale' : ''} ${className}`}>
      <div className="update-header">
        <span className="update-label">Última atualização</span>
        <span className={`update-status ${isStale ? 'stale' : 'fresh'}`} aria-hidden="true" />
      </div>
      <div className="update-main">
        <span className="update-date">{formattedDate}</span>
        <span className="update-relative">({relativeTime})</span>
      </div>
      {isStale && (
        <div className="update-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Dados podem estar desatualizados</span>
        </div>
      )}
    </div>
  );
}