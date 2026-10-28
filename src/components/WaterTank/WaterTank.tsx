import { useEffect, useRef, useState } from 'react';
import { WaterTankData } from '../../types';
import { getTankStatus, getTankStatusLabel } from '../../utils/tankUtils';
import './WaterTank.css';

interface WaterTankProps {
  data: WaterTankData;
  capacity: number;
  className?: string;
}

export function WaterTank({ data, capacity, className = '' }: WaterTankProps) {
  const { nivel, status_bomba } = data;
  const [currentLevel, setCurrentLevel] = useState(nivel);
  const [showInletFlow, setShowInletFlow] = useState(false);
  const [showOutletFlow, setShowOutletFlow] = useState(false);
  const animationRef = useRef<number>();
  const waveOffsetRef = useRef(0);

  // Animar transição suave do nível da água
  useEffect(() => {
    const startLevel = currentLevel;
    const targetLevel = nivel;
    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing suave (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrentLevel(startLevel + (targetLevel - startLevel) * eased);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [nivel]);

  // Animar ondas da água
  useEffect(() => {
    let lastTime = 0;
    const animateWaves = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      // Velocidade da onda baseada se a bomba está ligada
      const speed = status_bomba ? 0.025 : 0.008;
      waveOffsetRef.current = (waveOffsetRef.current + delta * speed) % (2 * Math.PI);
      // Trigger re-render para animação CSS
      // Usamos CSS animation para as ondas, apenas atualizamos offset se necessário
    };
    const raf = requestAnimationFrame(animateWaves);
    return () => cancelAnimationFrame(raf);
  }, [status_bomba]);

  // Controlar animação de entrada/saída de água
  useEffect(() => {
    if (status_bomba && currentLevel < 98) {
      setShowInletFlow(true);
      setShowOutletFlow(false);
    } else if (!status_bomba && currentLevel > 2) {
      setShowOutletFlow(true);
      setShowInletFlow(false);
    } else {
      setShowInletFlow(false);
      setShowOutletFlow(false);
    }
  }, [status_bomba, currentLevel]);

  const waterHeight = (currentLevel / 100) * 280; // Área interna da caixa: 280px
  const waterY = 340 - waterHeight; // Posição Y da superfície da água

  return (
    <div className={`water-tank-container ${className}`} role="img" aria-label={`Caixa d'água com ${nivel.toFixed(1)}% de nível`}>
      <svg className="water-tank-svg" viewBox="0 0 200 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          {/* Gradiente da caixa (parede externa) */}
          <linearGradient id="tankWallGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2d3a4a" />
            <stop offset="50%" stopColor="#3a4f63" />
            <stop offset="100%" stopColor="#2d3a4a" />
          </linearGradient>

          {/* Gradiente interno da caixa */}
          <linearGradient id="tankInnerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a2530" />
            <stop offset="50%" stopColor="#1e2d3d" />
            <stop offset="100%" stopColor="#1a2530" />
          </linearGradient>

          {/* Gradiente da água */}
          <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.65" />
          </linearGradient>

          {/* Gradiente da superfície da água (brilho) */}
          <linearGradient id="waterSurfaceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
          </linearGradient>

          {/* Reflexo da luz na água */}
          <radialGradient id="waterHighlight" cx="30%" cy="20%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </radialGradient>

          {/* Sombra interna */}
          <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feOffset dx="0" dy="4" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite in="SourceGraphic" in2="offset-blur" operator="over" />
          </filter>

          {/* Blur para efeito de profundidade */}
          <filter id="waterBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
          </filter>

          {/* Padrão de onda para textura da água */}
          <pattern id="waterPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M0,20 Q10,15 20,20 T40,20" stroke="#38bdf8" strokeWidth="0.5" fill="none" opacity="0.15" />
            <path d="M0,30 Q10,25 20,30 T40,30" stroke="#38bdf8" strokeWidth="0.3" fill="none" opacity="0.1" />
          </pattern>
        </defs>

        {/* Sombra projetada da caixa no chão */}
        <ellipse cx="100" cy="395" rx="75" ry="8" fill="#0a121a" opacity="0.4" filter="url(#waterBlur)" />

        {/* Tubulação de saída (inferior) - desenhada primeiro para ficar atrás da caixa */}
        <g className="outlet-pipe">
          {/* Cano vertical descendo */}
          <rect x="92" y="340" width="16" height="50" rx="2" fill="url(#pipeGradient)" stroke="#2a3a4a" strokeWidth="1.5" />
          {/* Cotovelo */}
          <path d="M92 370 Q92 385 100 385 Q108 385 108 370" stroke="url(#pipeGradient)" strokeWidth="16" fill="none" strokeLinecap="round" />
          <path d="M92 370 Q92 385 100 385 Q108 385 108 370" stroke="#1a2a3a" strokeWidth="18" fill="none" strokeLinecap="round" opacity="0.3" />
          {/* Cano horizontal de saída */}
          <rect x="108" y="377" width="35" height="6" rx="1" fill="url(#pipeGradient)" stroke="#2a3a4a" strokeWidth="1" />
          {/* Ponta de saída */}
          <polygon points="143,375 150,380 143,385" fill="url(#pipeGradient)" stroke="#2a3a4a" strokeWidth="1" />
          {/* Animação de água saindo */}
          {showOutletFlow && currentLevel > 5 && (
            <g className="outlet-flow" filter="url(#waterBlur)">
              <path
                d="M143 380 Q155 375 165 380 Q175 385 185 380"
                stroke="#38bdf8"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                opacity="0.7"
                className="flow-stream"
              />
              <circle cx="155" cy="378" r="2" fill="#7dd3fc" opacity="0.8" className="flow-drop" />
              <circle cx="165" cy="380" r="1.5" fill="#7dd3fc" opacity="0.6" className="flow-drop" style={{ animationDelay: '0.2s' }} />
              <circle cx="175" cy="378" r="1" fill="#38bdf8" opacity="0.5" className="flow-drop" style={{ animationDelay: '0.4s' }} />
            </g>
          )}

          {/* Gradiente do cano */}
          <defs>
            <linearGradient id="pipeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4a5a6a" />
              <stop offset="50%" stopColor="#5a6f82" />
              <stop offset="100%" stopColor="#4a5a6a" />
            </linearGradient>
          </defs>
        </g>

        {/* Tubulação de entrada (superior) */}
        <g className="inlet-pipe">
          {/* Cano vertical subindo */}
          <rect x="158" y="20" width="12" height="50" rx="2" fill="url(#pipeGradient)" stroke="#2a3a4a" strokeWidth="1.5" />
          {/* Cotovelo de entrada */}
          <path d="M164 20 Q175 20 175 30 Q175 40 164 40" stroke="url(#pipeGradient)" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M164 20 Q175 20 175 30 Q175 40 164 40" stroke="#1a2a3a" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.3" />
          {/* Cano horizontal de entrada */}
          <rect x="120" y="24" width="44" height="12" rx="2" fill="url(#pipeGradient)" stroke="#2a3a4a" strokeWidth="1" />
          {/* Conexão com a caixa */}
          <rect x="158" y="30" width="8" height="20" rx="1" fill="url(#tankWallGradient)" stroke="#2a3a4a" strokeWidth="1" />
          {/* Animação de água entrando */}
          {showInletFlow && currentLevel < 95 && (
            <g className="inlet-flow" filter="url(#waterBlur)">
              <path
                d="M164 35 Q150 30 140 35 Q130 40 120 35"
                stroke="#38bdf8"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                opacity="0.8"
                className="flow-stream inlet-stream"
              />
              <circle cx="150" cy="33" r="2.5" fill="#7dd3fc" opacity="0.9" className="flow-drop inlet-drop" />
              <circle cx="140" cy="35" r="2" fill="#7dd3fc" opacity="0.7" className="flow-drop inlet-drop" style={{ animationDelay: '0.15s' }} />
              <circle cx="130" cy="34" r="1.5" fill="#38bdf8" opacity="0.6" className="flow-drop inlet-drop" style={{ animationDelay: '0.3s' }} />
            </g>
          )}
          {/* Seta indicando direção de entrada */}
          {showInletFlow && (
            <polygon points="125,30 118,35 125,40" fill="#38bdf8" opacity="0.8" className="flow-arrow" />
          )}
        </g>

        {/* Parede traseira da caixa (para profundidade) */}
        <path
          d="M30 30 L30 340 Q30 360 45 360 L155 360 Q170 360 170 340 L170 30 Q170 10 155 10 L45 10 Q30 10 30 30 Z"
          fill="url(#tankWallGradient)"
          stroke="#1a2a3a"
          strokeWidth="1"
          opacity="0.6"
          transform="translate(8, 8)"
        />

        {/* Corpo principal da caixa - parede externa */}
        <path
          d="M22 22 L22 332 Q22 350 38 350 L162 350 Q178 350 178 332 L178 22 Q178 8 162 8 L38 8 Q22 8 22 22 Z"
          fill="url(#tankWallGradient)"
          stroke="#1a2a3a"
          strokeWidth="2"
          filter="url(#innerShadow)"
        />

        {/* Destaque na borda superior */}
        <path
          d="M38 22 L162 22"
          stroke="#4a6a8a"
          strokeWidth="1.5"
          opacity="0.6"
        />

        {/* Reflexo lateral esquerdo */}
        <path
          d="M22 22 L38 22 L38 332 L22 332 Z"
          fill="#3a5a7a"
          opacity="0.15"
        />

        {/* Área interna da caixa (fundo) */}
        <rect x="38" y="350" width="124" height="1" fill="#1a2a3a" />

        {/* Marcadores de nível na lateral interna */}
        <g className="level-markers" stroke="#2a4a5a" strokeWidth="0.5" opacity="0.4">
          {[25, 50, 75].map(pct => (
            <line
              key={pct}
              x1="38"
              y1={340 - (pct / 100) * 280}
              x2="50"
              y2={340 - (pct / 100) * 280}
            />
          ))}
        </g>

        {/* ÁGUA - Camada principal */}
        {currentLevel > 0 && (
          <g className="water-body" filter="url(#waterBlur)">
            {/* Corpo da água com clip path para ficar dentro da caixa */}
            <clipPath id="waterClip">
              <rect x="40" y="60" width="120" height="280" rx="2" />
            </clipPath>

            <g clipPath="url(#waterClip)">
              {/* Fundo da água (gradiente vertical) */}
              <rect
                x="40"
                y={waterY}
                width="120"
                height={waterHeight}
                fill="url(#waterGradient)"
                className="water-fill"
              />

              {/* Padrão de textura da água */}
              <rect
                x="40"
                y={waterY}
                width="120"
                height={waterHeight}
                fill="url(#waterPattern)"
                className="water-pattern"
              />

              {/* Reflexo de luz na superfície */}
              <ellipse
                cx="100"
                cy={waterY + 15}
                rx="45"
                ry="8"
                fill="url(#waterHighlight)"
                className="water-highlight"
              />

              {/* Bolhas quando bomba ligada */}
              {status_bomba && currentLevel > 10 && (
                <g className="bubbles">
                  {[1, 2, 3, 4, 5].map((_, i) => (
                    <circle
                      key={i}
                      cx={55 + (i % 3) * 30}
                      cy={waterY + waterHeight - 20 - (i * 40) % waterHeight}
                      r={1.5 + Math.sin(Date.now() / 1000 + i) * 0.5}
                      fill="#7dd3fc"
                      opacity="0.4"
                      className="bubble"
                      style={{
                        animationDelay: `${i * 0.4}s`,
                        animationDuration: `${2 + i * 0.3}s`
                      }}
                    />
                  ))}
                </g>
              )}
            </g>
          </g>
        )}

        {/* Superfície da água com ondas animadas */}
        {currentLevel > 1 && currentLevel < 99 && (
          <g className="water-surface" clipPath="url(#waterClip)">
            <path
              d={`M40,${waterY}
                Q55,${waterY - 3} 70,${waterY}
                Q85,${waterY + 3} 100,${waterY}
                Q115,${waterY - 3} 130,${waterY}
                Q145,${waterY + 3} 160,${waterY}`}
              stroke="url(#waterSurfaceGradient)"
              strokeWidth="2.5"
              fill="none"
              className="surface-wave"
              style={{
                transformOrigin: '100px center',
                transform: `translateY(${Math.sin(waveOffsetRef.current) * 1.5}px)`
              }}
            />
            {/* Segunda onda mais sutil */}
            <path
              d={`M40,${waterY + 4}
                Q55,${waterY + 1} 70,${waterY + 4}
                Q85,${waterY + 7} 100,${waterY + 4}
                Q115,${waterY + 1} 130,${waterY + 4}
                Q145,${waterY + 7} 160,${waterY + 4}`}
              stroke="#38bdf8"
              strokeWidth="1"
              fill="none"
              opacity="0.3"
              className="surface-wave-secondary"
              style={{
                transformOrigin: '100px center',
                transform: `translateY(${Math.sin(waveOffsetRef.current * 0.7 + 1) * 1}px)`
              }}
            />
          </g>
        )}

        {/* Tampa da caixa */}
        <path
          d="M22 22 L22 38 Q22 10 38 10 L162 10 Q178 10 178 22 L178 38 Q178 50 162 50 L38 50 Q22 50 22 38 Z"
          fill="url(#tankWallGradient)"
          stroke="#1a2a3a"
          strokeWidth="2"
        />

        {/* Reflexo na tampa */}
        <path
          d="M38 22 L162 22 L162 38 Q178 38 178 22"
          fill="#4a6a8a"
          opacity="0.1"
        />

        {/* Indicador de nível percentual (lateral) */}
        <g className="level-indicator" aria-hidden="true">
          {/* Linha de referência do nível atual */}
          <line
            x1="22"
            y1={waterY}
            x2="178"
            y2={waterY}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="6,4"
            opacity="0.5"
            className="level-line"
          />
          {/* Círculo com porcentagem */}
          <circle cx="190" cy={waterY} r="16" fill="#0c1a2a" stroke="#38bdf8" strokeWidth="2" />
          <text
            x="190"
            y={waterY + 5}
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="11"
            fontWeight="bold"
            fontFamily="'JetBrains Mono', monospace"
            className="level-percent-text"
          >
            {currentLevel.toFixed(0)}%
          </text>
        </g>

        {/* Estrutura de suporte da caixa (pés) */}
        <g className="tank-feet" fill="#1a2a3a" stroke="#0a121a" strokeWidth="1">
          <rect x="30" y="350" width="30" height="10" rx="2" />
          <rect x="140" y="350" width="30" height="10" rx="2" />
        </g>
      </svg>

      {/* Painel de informações sobreposto */}
      <div className="water-tank-info">
        <div className="tank-level-display">
          <span className="level-value">{nivel.toFixed(1).replace('.', ',')}<span className="level-unit">%</span></span>
          <span className="level-litros">{Math.round((nivel / 100) * capacity).toLocaleString('pt-BR')} L</span>
        </div>
        <div className="tank-status">
          <span className={`status-badge status-${getTankStatus(data)}`}>
            {getTankStatusLabel(getTankStatus(data))}
          </span>
          <span className="capacity-info">{capacity.toLocaleString('pt-BR')} L total</span>
        </div>
      </div>

      {/* Legenda das tubulações */}
      <div className="pipe-legend">
        <div className="pipe-legend-item inlet">
          <span className="pipe-color inlet-color"></span>
          <span>Entrada</span>
          {status_bomba && <span className="pipe-flow-indicator">● Fluindo</span>}
        </div>
        <div className="pipe-legend-item outlet">
          <span className="pipe-color outlet-color"></span>
          <span>Saída</span>
          {!status_bomba && currentLevel > 5 && <span className="pipe-flow-indicator">● Drenando</span>}
        </div>
      </div>
    </div>
  );
}