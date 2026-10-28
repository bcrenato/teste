import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import './DemoModeToggle.css';

export function DemoModeToggle() {
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsDemo(apiService.isDemoMode());
    setIsLoading(false);
  }, []);

  const handleToggle = () => {
    const newState = !isDemo;
    setIsDemo(newState);
    apiService.setDemoMode(newState);
  };

  if (isLoading) {
    return (
      <div className="demo-toggle loading">
        <div className="toggle-spinner" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`demo-toggle ${isDemo ? 'demo-active' : ''}`}>
      <label className="toggle-label" htmlFor="demo-toggle">
        <span className="toggle-icon" aria-hidden="true">
          {isDemo ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
              <path d="M9 18a6 6 0 0 1 6-6" strokeDasharray="15" strokeDashoffset="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
          )}
        </span>
        <span className="toggle-text">
          <span className="toggle-main">{isDemo ? 'MODO DEMONSTRAÇÃO' : 'MODO REAL'}</span>
          <span className="toggle-sub">{isDemo ? 'Dados simulados para teste' : 'Aguardando dispositivo real'}</span>
        </span>
      </label>
      <button
        id="demo-toggle"
        className={`toggle-switch ${isDemo ? 'on' : 'off'}`}
        onClick={handleToggle}
        aria-label={isDemo ? 'Desativar modo demonstração' : 'Ativar modo demonstração'}
        aria-pressed={isDemo}
      >
        <span className="toggle-thumb" aria-hidden="true" />
        <span className="toggle-track" aria-hidden="true" />
      </button>
      <div className="demo-badge" aria-hidden="true">
        {isDemo ? 'DEMO' : 'REAL'}
      </div>
    </div>
  );
}