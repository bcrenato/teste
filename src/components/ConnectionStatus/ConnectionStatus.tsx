import './ConnectionStatus.css';

interface ConnectionStatusProps {
  connected: boolean;
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatus({ connected, className = '', showLabel = true }: ConnectionStatusProps) {
  return (
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'} ${className}`}>
      <div className="connection-indicator" aria-hidden="true">
        <span className="pulse-ring" />
        <span className="pulse-dot" />
      </div>
      {showLabel && (
        <span className="connection-label">
          {connected ? 'Conectado' : 'Desconectado'}
        </span>
      )}
      <div className="connection-signal" aria-hidden="true">
        <span style={{ animationDelay: '0ms' }} />
        <span style={{ animationDelay: '100ms' }} />
        <span style={{ animationDelay: '200ms' }} />
        <span style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}