import { WaterTankData } from '../../types';
import { formatDateTime } from '../../utils/tankUtils';
import './PumpStatus.css';

interface PumpStatusProps {
  data: WaterTankData;
  lastChangeTime?: string;
  className?: string;
}

export function PumpStatus({ data, lastChangeTime, className = '' }: PumpStatusProps) {
  const { status_bomba } = data;

  return (
    <div className={`pump-status-card ${status_bomba ? 'active' : 'inactive'} ${className}`}>
      <div className="pump-header">
        <div className="pump-icon-wrapper">
          <svg className="pump-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="pumpGradientActive" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
              <linearGradient id="pumpGradientInactive" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
              <filter id="pumpGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="pumpGlowInactive">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Base da bomba */}
            <rect x="14" y="42" width="36" height="16" rx="3"
              fill={status_bomba ? "url(#pumpGradientActive)" : "url(#pumpGradientInactive)"}
              stroke={status_bomba ? "#16a34a" : "#334155"}
              strokeWidth="1.5"
              filter={status_bomba ? "url(#pumpGlow)" : "url(#pumpGlowInactive)"}
            />

            {/* Corpo da bomba */}
            <rect x="18" y="18" width="28" height="26" rx="4"
              fill={status_bomba ? "url(#pumpGradientActive)" : "url(#pumpGradientInactive)"}
              stroke={status_bomba ? "#16a34a" : "#334155"}
              strokeWidth="1.5"
              filter={status_bomba ? "url(#pumpGlow)" : "url(#pumpGlowInactive)"}
            />

            {/* Entrada (superior) */}
            <path d="M32 6 L32 18"
              stroke={status_bomba ? "#22c55e" : "#475569"}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="32" cy="6" r="5"
              fill={status_bomba ? "#22c55e" : "#475569"}
              stroke={status_bomba ? "#16a34a" : "#334155"}
              strokeWidth="1.5"
            />

            {/* Saída (lateral) */}
            <path d="M46 30 Q54 30 54 38"
              stroke={status_bomba ? "#22c55e" : "#475569"}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="54" cy="38" r="4"
              fill={status_bomba ? "#22c55e" : "#475569"}
              stroke={status_bomba ? "#16a34a" : "#334155"}
              strokeWidth="1.5"
            />

            {/* Impelidor/rotor animado */}
            <g className="pump-impeller" style={{ transformOrigin: '32px 31px' }}>
              <circle cx="32" cy="31" r="10"
                fill="none"
                stroke={status_bomba ? "#16a34a" : "#334155"}
                strokeWidth="1.5"
                strokeDasharray="12 12"
                opacity="0.5"
              />
              <g className="impeller-blades">
                <line x1="32" y1="21" x2="32" y2="16"
                  stroke={status_bomba ? "#22c55e" : "#475569"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line x1="32" y1="41" x2="32" y2="46"
                  stroke={status_bomba ? "#22c55e" : "#475569"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line x1="22" y1="31" x2="17" y2="31"
                  stroke={status_bomba ? "#22c55e" : "#475569"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line x1="42" y1="31" x2="47" y2="31"
                  stroke={status_bomba ? "#22c55e" : "#475569"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>
              <circle cx="32" cy="31" r="4"
                fill={status_bomba ? "#22c55e" : "#475569"}
                stroke={status_bomba ? "#16a34a" : "#334155"}
                strokeWidth="1"
              />
            </g>

            {/* Partículas de água quando ativo */}
            {status_bomba && (
              <g className="water-particles">
                {[1, 2, 3, 4, 5, 6].map((_, i) => (
                  <circle
                    key={i}
                    cx={32 + Math.cos(i * Math.PI / 3) * 18}
                    cy={31 + Math.sin(i * Math.PI / 3) * 18}
                    r="2"
                    fill="#38bdf8"
                    opacity="0.7"
                    className="particle"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: `${0.8 + i * 0.1}s`
                    }}
                  />
                ))}
              </g>
            )}

            {/* Linhas de fluxo na entrada */}
            {status_bomba && (
              <g className="inlet-flow-lines">
                <path d="M28 6 Q28 10 32 12 Q36 10 36 6"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                  className="flow-line"
                  style={{ animationDelay: '0s' }}
                />
                <path d="M26 4 Q26 9 32 11 Q38 9 38 4"
                  stroke="#38bdf8"
                  strokeWidth="1"
                  fill="none"
                  opacity="0.3"
                  className="flow-line"
                  style={{ animationDelay: '0.3s' }}
                />
              </g>
            )}

            {/* Linhas de fluxo na saída */}
            {status_bomba && (
              <g className="outlet-flow-lines">
                <path d="M46 32 Q50 32 52 35 Q54 38 54 41"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                  className="flow-line"
                  style={{ animationDelay: '0.1s' }}
                />
                <path d="M46 34 Q51 34 53 37 Q55 40 55 43"
                  stroke="#38bdf8"
                  strokeWidth="1"
                  fill="none"
                  opacity="0.3"
                  className="flow-line"
                  style={{ animationDelay: '0.4s' }}
                />
              </g>
            )}
          </svg>
        </div>

        <div className="pump-status-text">
          <span className="pump-label">Bomba d'Água</span>
          <span className={`pump-state ${status_bomba ? 'on' : 'off'}`}>
            {status_bomba ? 'LIGADA' : 'DESLIGADA'}
          </span>
        </div>
      </div>

      <div className="pump-details">
        <div className="pump-detail-item">
          <span className="detail-label">Status</span>
          <span className={`detail-value ${status_bomba ? 'text-green' : 'text-gray'}`}>
            {status_bomba ? 'Em funcionamento' : 'Parada'}
          </span>
        </div>

        {lastChangeTime && (
          <div className="pump-detail-item">
            <span className="detail-label">Última mudança</span>
            <span className="detail-value">{formatDateTime(lastChangeTime)}</span>
          </div>
        )}

        <div className="pump-detail-item">
          <span className="detail-label">Conexão</span>
          <span className={`detail-value ${data.conectado ? 'text-green' : 'text-red'}`}>
            {data.conectado ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      <div className="pump-indicator-bar">
        <div className={`indicator-fill ${status_bomba ? 'active' : 'inactive'}`} />
      </div>
    </div>
  );
}