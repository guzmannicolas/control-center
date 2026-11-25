import { useEffect, useState } from 'react';
import type { SoftwareAnalogy } from './analogiesData.ts';

type GameMissionId =
  | 'city-sandbox'
  | 'bakery-webhook'
  | 'restaurant-api'
  | 'monolith-vs-micro'
  | 'security-bouncer'
  | 'factory-docker'
  | 'ai-rag-exam';

interface GameMission {
  id: GameMissionId;
  title: string;
  badge: string;
  color: string;
  controlsLabel: string;
}

const GAME_MISSIONS: GameMission[] = [
  {
    id: 'city-sandbox',
    title: 'Mundo Abierto: La Ciudad Viva',
    badge: 'Mapa 2D Jugable',
    color: '#38bdf8',
    controlsLabel: 'Mandá pedidos por la ciudad y mirá cómo se mueven los camiones, el mozo y el cocinero',
  },
  {
    id: 'bakery-webhook',
    title: 'Nivel 1: La Panadería (Webhook vs. Llamar)',
    badge: 'Mini-Juego',
    color: '#fbbf24',
    controlsLabel: 'Probá llamar cada 5 minutos vs. dejar tu teléfono anotado cuando salen las facturas',
  },
  {
    id: 'restaurant-api',
    title: 'Nivel 2: El Restaurante (Frontend, API, Backend y Caché)',
    badge: 'Mini-Juego',
    color: '#a78bfa',
    controlsLabel: 'Elegí pedir Combo Fijo (REST), A Medida (GraphQL) o usar la Sal en la Mesada (Caché)',
  },
  {
    id: 'monolith-vs-micro',
    title: 'Nivel 3: Edificio Único vs. Barrio de Locales',
    badge: 'Simulador de Caos',
    color: '#34d399',
    controlsLabel: 'Provocá un cortocircuito en la cafetera y mirá qué pasa con la luz del edificio vs. el barrio',
  },
  {
    id: 'security-bouncer',
    title: 'Nivel 4: El Patovica y los 1.000 Bromistas (Seguridad)',
    badge: 'Defensa Tower',
    color: '#f87171',
    controlsLabel: 'Lanzá un ataque de bromistas (DDoS) o estafadores y activá el Patovica (Firewall) y Pulsera (JWT)',
  },
  {
    id: 'factory-docker',
    title: 'Nivel 5: La Fábrica, el Barco y el Teatro (DevOps)',
    badge: 'Fábrica 2D',
    color: '#fbbf24',
    controlsLabel: 'Mové la cinta CI/CD, empacá la Valija Docker, estrená en el Teatro y accioná la palanca de Rollback',
  },
  {
    id: 'ai-rag-exam',
    title: 'Nivel 6: El Examen de la IA (Alucinación vs. RAG + MCP)',
    badge: 'Laboratorio IA',
    color: '#f472b6',
    controlsLabel: 'Tomale examen al Loro Leído a memoria cerrada (inventa calles) vs. con Apuntes Abiertos y Enchufe USB-C',
  },
];

export function SoftwareCityGame({
  onSelectConcept,
}: {
  onSelectConcept?: (id: string) => void;
}) {
  const [mission, setMission] = useState<GameMissionId>('city-sandbox');
  const [tick, setTick] = useState<number>(0);

  // Interactive Game States per level
  const [cityOrderPhase, setCityOrderPhase] = useState<number>(0); // 0..5 moving truck/waiter
  const [bakeryMode, setBakeryMode] = useState<'polling' | 'webhook'>('webhook');
  const [bakeryOvenReady, setBakeryOvenReady] = useState<boolean>(false);
  const [pollingCallsCount, setPollingCallsCount] = useState<number>(0);

  const [orderType, setOrderType] = useState<'rest' | 'graphql' | 'websocket'>('rest');
  const [cacheOnCounter, setCacheOnCounter] = useState<boolean>(true);

  const [shortCircuitActive, setShortCircuitActive] = useState<boolean>(false);

  const [ddosAttackActive, setDdosAttackActive] = useState<boolean>(false);
  const [firewallEnabled, setFirewallEnabled] = useState<boolean>(true);
  const [hasJwtWristband, setHasJwtWristband] = useState<boolean>(true);

  const [theaterStage, setTheaterStage] = useState<'staging' | 'production' | 'spicy-bug' | 'rollback'>('production');

  const [aiHasRagNotes, setAiHasRagNotes] = useState<boolean>(true);
  const [aiHasMcpPlug, setAiHasMcpPlug] = useState<boolean>(true);
  const [aiHasGuardrails, setAiHasGuardrails] = useState<boolean>(true);

  // Continuous animation loop for moving vehicles, steam, waves, and characters
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => (t + 1) % 360);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  // Auto-advance city order packet when triggered
  useEffect(() => {
    if (cityOrderPhase === 0) return;
    const timer = setTimeout(() => {
      setCityOrderPhase((p) => (p >= 6 ? 0 : p + 1));
    }, 1400);
    return () => clearTimeout(timer);
  }, [cityOrderPhase]);

  const activeMission = GAME_MISSIONS.find((m) => m.id === mission) ?? GAME_MISSIONS[0]!;
  const truckOffset = (tick * 4) % 760;
  const waveOffset = Math.sin(tick / 6) * 4;
  const steamOffset = (tick % 30) * 0.8;

  return (
    <div
      style={{
        background: '#050811',
        border: '2px solid #1e293b',
        borderRadius: '16px',
        padding: '1.15rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
      }}
    >
      {/* Game Level Selector Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {GAME_MISSIONS.map((m) => {
            const active = m.id === mission;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMission(m.id)}
                style={{
                  background: active ? '#0f172a' : '#0b0f19',
                  border: `2px solid ${active ? m.color : '#1e293b'}`,
                  boxShadow: active ? `0 0 14px ${m.color}44` : 'none',
                  color: active ? '#ffffff' : '#94a3b8',
                  borderRadius: '10px',
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: m.color,
                  }}
                />
                <span>{m.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Game Arcade Controls Bar */}
      <div
        style={{
          background: '#0b0f19',
          border: `1.5px solid ${activeMission.color}`,
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: activeMission.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            CONTROLES DEL SIMULADOR — {activeMission.badge}
          </span>
          <span style={{ fontSize: '0.83rem', color: '#e2e8f0', fontWeight: 600 }}>
            {activeMission.controlsLabel}
          </span>
        </div>

        {/* Dynamic Controls per Mission */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {mission === 'city-sandbox' && (
            <>
              <button
                type="button"
                onClick={() => setCityOrderPhase(1)}
                style={{
                  background: '#0284c7',
                  border: '2px solid #38bdf8',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {cityOrderPhase === 0 ? 'Mandar Pedido desde Tu Casa -> Restaurante' : `Viajando... (Etapa ${cityOrderPhase}/6)`}
              </button>
              <button
                type="button"
                onClick={() => setShortCircuitActive((s) => !s)}
                style={{
                  background: shortCircuitActive ? '#dc2626' : '#1e293b',
                  border: `1.5px solid ${shortCircuitActive ? '#f87171' : '#475569'}`,
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {shortCircuitActive ? 'Arreglar Luz del Monolito' : 'Probar Cortocircuito (Bug)'}
              </button>
            </>
          )}

          {mission === 'bakery-webhook' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setBakeryMode('polling');
                  setBakeryOvenReady(false);
                  setPollingCallsCount((c) => c + 5);
                }}
                style={{
                  background: bakeryMode === 'polling' ? '#dc2626' : '#1e293b',
                  border: '1.5px solid #f87171',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Modo Pesado: Llamar cada 5 min ({pollingCallsCount} llamadas)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBakeryMode('webhook');
                  setBakeryOvenReady(false);
                }}
                style={{
                  background: bakeryMode === 'webhook' ? '#059669' : '#1e293b',
                  border: '1.5px solid #34d399',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Modo Webhook: Dejar mi Número Anotado
              </button>
              <button
                type="button"
                onClick={() => setBakeryOvenReady((r) => !r)}
                style={{
                  background: '#d97706',
                  border: '2px solid #fbbf24',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {bakeryOvenReady ? 'Meter Nueva Tanda al Horno' : '¡Sacar Facturas Calientes del Horno!'}
              </button>
            </>
          )}

          {mission === 'restaurant-api' && (
            <>
              <button
                type="button"
                onClick={() => setOrderType('rest')}
                style={{
                  background: orderType === 'rest' ? '#7c3aed' : '#1e293b',
                  border: '1.5px solid #a78bfa',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Pedir con REST (Combo Fijo)
              </button>
              <button
                type="button"
                onClick={() => setOrderType('graphql')}
                style={{
                  background: orderType === 'graphql' ? '#059669' : '#1e293b',
                  border: '1.5px solid #34d399',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Pedir con GraphQL (2 Papas Exactas)
              </button>
              <button
                type="button"
                onClick={() => setOrderType('websocket')}
                style={{
                  background: orderType === 'websocket' ? '#0284c7' : '#1e293b',
                  border: '1.5px solid #38bdf8',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                WebSocket (Teléfono Abierto)
              </button>
              <button
                type="button"
                onClick={() => setCacheOnCounter((c) => !c)}
                style={{
                  background: cacheOnCounter ? '#d97706' : '#1e293b',
                  border: '1.5px solid #fbbf24',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Caché en Mesada: {cacheOnCounter ? 'ACTIVA (1 seg)' : 'APAGADA (Baja al Sótano)'}
              </button>
            </>
          )}

          {mission === 'monolith-vs-micro' && (
            <button
              type="button"
              onClick={() => setShortCircuitActive((s) => !s)}
              style={{
                background: shortCircuitActive ? '#059669' : '#dc2626',
                border: `2px solid ${shortCircuitActive ? '#34d399' : '#f87171'}`,
                color: '#ffffff',
                borderRadius: '8px',
                padding: '0.5rem 1.1rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {shortCircuitActive
                ? 'Subir la Llave Térmica (Restaurar Luz)'
                : '¡Provocar Cortocircuito en la Cafetera / Carnicería!'}
            </button>
          )}

          {mission === 'security-bouncer' && (
            <>
              <button
                type="button"
                onClick={() => setDdosAttackActive((a) => !a)}
                style={{
                  background: ddosAttackActive ? '#dc2626' : '#1e293b',
                  border: '1.5px solid #f87171',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {ddosAttackActive ? 'Frenar Horda de Bromistas (DDoS)' : 'Lanzar 1.000 Bromistas (Ataque DDoS)'}
              </button>
              <button
                type="button"
                onClick={() => setFirewallEnabled((f) => !f)}
                style={{
                  background: firewallEnabled ? '#059669' : '#7f1d1d',
                  border: '1.5px solid #34d399',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Patovica (Firewall): {firewallEnabled ? 'EN LA PUERTA' : 'DURMIENDO'}
              </button>
              <button
                type="button"
                onClick={() => setHasJwtWristband((w) => !w)}
                style={{
                  background: hasJwtWristband ? '#d97706' : '#1e293b',
                  border: '1.5px solid #fbbf24',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Pulsera Hotel (JWT): {hasJwtWristband ? 'PUESTA' : 'SIN PULSERA'}
              </button>
            </>
          )}

          {mission === 'factory-docker' && (
            <>
              <button
                type="button"
                onClick={() => setTheaterStage('staging')}
                style={{
                  background: theaterStage === 'staging' ? '#0284c7' : '#1e293b',
                  border: '1.5px solid #38bdf8',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                1. Ensayo sin Público (Staging)
              </button>
              <button
                type="button"
                onClick={() => setTheaterStage('production')}
                style={{
                  background: theaterStage === 'production' ? '#059669' : '#1e293b',
                  border: '1.5px solid #34d399',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                2. Abrir Teatro con Público (Producción)
              </button>
              <button
                type="button"
                onClick={() => setTheaterStage('spicy-bug')}
                style={{
                  background: theaterStage === 'spicy-bug' ? '#dc2626' : '#1e293b',
                  border: '1.5px solid #f87171',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                3. Meter Ingrediente Feo (Bug en Vivo)
              </button>
              <button
                type="button"
                onClick={() => setTheaterStage('rollback')}
                style={{
                  background: theaterStage === 'rollback' ? '#d97706' : '#1e293b',
                  border: '1.5px solid #fbbf24',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                4. ¡Palanca de Rollback (Receta Anterior)!
              </button>
            </>
          )}

          {mission === 'ai-rag-exam' && (
            <>
              <button
                type="button"
                onClick={() => setAiHasRagNotes((r) => !r)}
                style={{
                  background: aiHasRagNotes ? '#059669' : '#dc2626',
                  border: '1.5px solid #34d399',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Apuntes en el Banco (RAG): {aiHasRagNotes ? 'ABIERTOS' : 'CERRADOS (Alucina)'}
              </button>
              <button
                type="button"
                onClick={() => setAiHasMcpPlug((m) => !m)}
                style={{
                  background: aiHasMcpPlug ? '#0284c7' : '#1e293b',
                  border: '1.5px solid #38bdf8',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Enchufe USB-C (MCP): {aiHasMcpPlug ? 'ENCHUFADO' : 'DESCONECTADO'}
              </button>
              <button
                type="button"
                onClick={() => setAiHasGuardrails((g) => !g)}
                style={{
                  background: aiHasGuardrails ? '#d97706' : '#1e293b',
                  border: '1.5px solid #fbbf24',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Barandas de Montaña (Guardrails): {aiHasGuardrails ? 'FIRMES' : 'SIN BARANDAS'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          2D GAME VIEWPORT: ILLUSTRATED CARTOON CANVAS (960 x 470)
      ===================================================================== */}
      <div
        style={{
          background: '#070d19',
          border: '2px solid #1e293b',
          borderRadius: '14px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <svg
          viewBox="0 0 960 470"
          style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
          role="img"
          aria-label="Simulador Visual 2D de la Ciudad del Software"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#061024" />
              <stop offset="65%" stopColor="#0c1e3e" />
              <stop offset="100%" stopColor="#142848" />
            </linearGradient>
            <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="fireGlow" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
          </defs>

          {/* Sky Background & Stars */}
          <rect width="960" height="470" fill="url(#skyGrad)" />
          <circle cx="80" cy="42" r="1.5" fill="#93c5fd" opacity="0.7" />
          <circle cx="240" cy="28" r="2" fill="#fde047" opacity="0.6" />
          <circle cx="520" cy="36" r="1.5" fill="#ffffff" opacity="0.5" />
          <circle cx="780" cy="25" r="2" fill="#93c5fd" opacity="0.7" />
          <circle cx="890" cy="52" r="1.5" fill="#ffffff" opacity="0.6" />

          {/* =================================================================
              SCENE 0: OPEN WORLD CITY SANDBOX (FULL METROPOLIS VIEW)
          ================================================================= */}
          {mission === 'city-sandbox' && (
            <g>
              {/* THE CLOUD (Usina Electrica Municipal en el Cielo) */}
              <g
                onClick={() => onSelectConcept?.('nube-cloud')}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d="M365 55 C365 38 385 32 400 40 C412 24 445 24 456 40 C475 34 495 45 492 60 C492 72 475 76 460 76 L380 76 C368 76 365 66 365 55 Z"
                  fill="#1e3a8a"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />
                <text x="430" y="55" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="800">
                  LA NUBE (USINA MUNICIPAL)
                </text>
                <text x="430" y="69" textAnchor="middle" fill="#7dd3fc" fontSize="9.5" fontWeight="700">
                  Red Eléctrica a Demanda (AWS / VPS)
                </text>
                {/* Animated Power Lines feeding the buildings */}
                <path d="M385 76 L140 135" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="4 4" />
                <path d="M430 76 L450 120" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="4 4" />
                <path d="M475 76 L760 120" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="4 4" />
                <polygon points="426,82 434,82 429,92 435,92 425,105 428,94 422,94" fill="#fde047" />
              </g>

              {/* BUILDING 1: TU CASA (CLIENTE) + AGENDA DNS */}
              <g
                onClick={() => onSelectConcept?.('cliente')}
                style={{ cursor: 'pointer' }}
              >
                {/* Ground */}
                <rect x="20" y="275" width="920" height="22" fill="#064e3b" />
                {/* House Roof & Walls */}
                <polygon points="35,180 110,125 185,180" fill="#b91c1c" stroke="#f87171" strokeWidth="2.5" />
                <rect x="145" y="135" width="16" height="32" fill="#7f1d1d" stroke="#f87171" strokeWidth="1.5" />
                <rect x="48" y="180" width="124" height="100" rx="4" fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
                {/* House Sign */}
                <rect x="52" y="158" width="116" height="20" rx="5" fill="#0284c7" />
                <text x="110" y="172" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">
                  TU CASA (CLIENTE)
                </text>
                {/* Address plaque (IP) */}
                <rect x="55" y="258" width="66" height="16" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                <text x="88" y="269" textAnchor="middle" fill="#38bdf8" fontSize="8.5" fontWeight="700">
                  IP: Calle 192.1
                </text>
                {/* Window with Person inside looking at screen */}
                <rect x="64" y="194" width="54" height="52" rx="4" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="2" />
                {/* Drawn Person */}
                <circle cx="84" cy="212" r="8" fill="#fde047" />
                <circle cx="82" cy="210" r="1.5" fill="#0f172a" />
                <circle cx="87" cy="210" r="1.5" fill="#0f172a" />
                <path d="M81 215 Q84 218 87 215" stroke="#0f172a" strokeWidth="1.5" fill="none" />
                <path d="M72 242 C72 226 96 226 96 242" fill="#38bdf8" />
                {/* Mini Laptop in window */}
                <rect x="94" y="222" width="16" height="11" rx="2" fill="#e2e8f0" />
                {/* Door */}
                <rect x="130" y="216" width="28" height="64" rx="3" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
                <circle cx="152" cy="248" r="2.5" fill="#fde047" />
                {/* DNS Phonebook Signpost outside house */}
                <rect x="196" y="218" width="4" height="62" fill="#94a3b8" />
                <rect x="176" y="196" width="56" height="28" rx="5" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.8" />
                <text x="204" y="208" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="800">
                  AGENDA DNS
                </text>
                <text x="204" y="219" textAnchor="middle" fill="#e2e8f0" fontSize="7.5">
                  Nombre -&gt; IP
                </text>
              </g>

              {/* BUILDING 2: PATOVICA (FIREWALL) + RECEPCION DEL RESTAURANTE (FRONTEND / API / BACKEND / DB) */}
              <g
                onClick={() => onSelectConcept?.('api')}
                style={{ cursor: 'pointer' }}
              >
                {/* Bouncer (Firewall) standing at the entrance */}
                <g transform="translate(242, 212)">
                  <rect x="-12" y="-22" width="60" height="16" rx="4" fill="#7f1d1d" stroke="#f87171" strokeWidth="1.2" />
                  <text x="18" y="-11" textAnchor="middle" fill="#fca5a5" fontSize="8.5" fontWeight="800">
                    PATOVICA (FIREWALL)
                  </text>
                  {/* Muscular Bouncer Character */}
                  <circle cx="18" cy="10" r="10" fill="#fca5a5" />
                  {/* Sunglasses */}
                  <rect x="11" y="6" width="6" height="4" fill="#050811" />
                  <rect x="19" y="6" width="6" height="4" fill="#050811" />
                  <line x1="17" y1="8" x2="19" y2="8" stroke="#050811" strokeWidth="1.5" />
                  {/* Suit Body & Crossed Arms */}
                  <rect x="4" y="20" width="28" height="36" rx="5" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.5" />
                  <path d="M14 20 L18 32 L22 20" fill="#ffffff" />
                  <path d="M18 22 L18 32" stroke="#ef4444" strokeWidth="2.5" />
                  {/* Velvet Rope */}
                  <rect x="34" y="34" width="4" height="34" fill="#fbbf24" />
                  <path d="M3 42 Q19 52 35 42" stroke="#dc2626" strokeWidth="3.5" fill="none" />
                </g>

                {/* THE RESTAURANT / MONOLITH BUILDING (Salón Frontend + Mozo API + Cocina Backend + Archivero SQL) */}
                <rect
                  x="292"
                  y="112"
                  width="320"
                  height="168"
                  rx="8"
                  fill={shortCircuitActive ? '#111827' : '#0f172a'}
                  stroke={shortCircuitActive ? '#ef4444' : '#a78bfa'}
                  strokeWidth="3"
                />
                {/* Roof Neon Sign */}
                <rect x="315" y="92" width="274" height="22" rx="6" fill="#2e1065" stroke="#a78bfa" strokeWidth="2" />
                <text x="452" y="107" textAnchor="middle" fill="#e9d5ff" fontSize="11" fontWeight="800">
                  {shortCircuitActive ? '¡SALTÓ LA TÉRMICA! (MONOLITO APAGADO)' : 'EDIFICIO RESTAURANTE (FRONTEND + API + BACKEND)'}
                </text>

                {/* Divider Wall between Dining Room (Frontend) and Kitchen (Backend) */}
                <line x1="448" y1="115" x2="448" y2="280" stroke="#475569" strokeWidth="3" strokeDasharray="10 6" />

                {/* LEFT ROOM: VIDRIERA Y SALÓN (FRONTEND) */}
                <rect x="304" y="124" width="132" height="18" rx="4" fill="#1e1b4b" />
                <text x="370" y="137" textAnchor="middle" fill="#38bdf8" fontSize="9.5" fontWeight="800">
                  VIDRIERA (FRONTEND)
                </text>
                {/* Dining Table & Customer */}
                <rect x="328" y="232" width="48" height="6" fill="#d97706" />
                <rect x="348" y="238" width="8" height="36" fill="#78350f" />
                {/* Customer sitting */}
                <circle cx="322" cy="212" r="8" fill={shortCircuitActive ? '#475569' : '#fde047'} />
                <path d="M312 242 C312 224 332 224 332 242" fill="#38bdf8" />

                {/* ANIMATED WAITER (EL MOZO = API) walking between Salon and Kitchen! */}
                <g
                  transform={`translate(${
                    cityOrderPhase === 3 ? 395 : cityOrderPhase === 4 ? 465 : 415 + Math.sin(tick / 8) * 28
                  }, 196)`}
                >
                  <rect x="-20" y="-26" width="56" height="15" rx="4" fill="#065f46" stroke="#34d399" strokeWidth="1.2" />
                  <text x="8" y="-16" textAnchor="middle" fill="#6ee7b7" fontSize="8.5" fontWeight="800">
                    MOZO (API)
                  </text>
                  <circle cx="8" cy="0" r="8" fill="#fde047" />
                  {/* Waiter Bowtie & Tuxedo */}
                  <rect x="-1" y="8" width="18" height="28" rx="4" fill="#1e293b" stroke="#f8fafc" strokeWidth="1.2" />
                  <polygon points="5,11 11,11 8,14" fill="#ef4444" />
                  {/* Tray with Silver Cloche Dish */}
                  <line x1="16" y1="12" x2="36" y2="12" stroke="#cbd5e1" strokeWidth="2.5" />
                  <path d="M19 12 C19 3 33 3 33 12 Z" fill="#38bdf8" />
                  <circle cx="26" cy="4" r="2" fill="#fde047" />
                </g>

                {/* RIGHT ROOM: COCINA (BACKEND) + MESADA (CACHÉ) + ARCHIVERO (SQL) */}
                <rect x="460" y="124" width="140" height="18" rx="4" fill="#064e3b" />
                <text x="530" y="137" textAnchor="middle" fill="#34d399" fontSize="9.5" fontWeight="800">
                  COCINA (BACKEND + DATOS)
                </text>

                {/* Pizarra Blanca (REDIS) on the Kitchen Wall */}
                <rect x="462" y="150" width="66" height="36" rx="3" fill="#f8fafc" stroke="#ef4444" strokeWidth="2" />
                <text x="495" y="163" textAnchor="middle" fill="#dc2626" fontSize="8" fontWeight="800">
                  PIZARRA REDIS
                </text>
                <text x="495" y="175" textAnchor="middle" fill="#0f172a" fontSize="7.5" fontWeight="700">
                  Mesa 4: 2 Cafés
                </text>

                {/* Chef (Backend Engine) with Tall Chef Hat */}
                <g transform="translate(515, 208)">
                  {/* Chef Hat */}
                  <path d="M-8 -10 C-12 -22 12 -22 8 -10 Z" fill="#ffffff" />
                  <rect x="-7" y="-12" width="14" height="5" fill="#e2e8f0" />
                  <circle cx="0" cy="-1" r="8" fill={shortCircuitActive ? '#475569' : '#fde047'} />
                  <rect x="-10" y="7" width="20" height="30" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.2" />
                </g>

                {/* Mesada con Sal y Aceite (CACHÉ) */}
                <rect x="460" y="242" width="76" height="32" rx="3" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
                <text x="498" y="261" textAnchor="middle" fill="#fde047" fontSize="8" fontWeight="800">
                  MESADA (CACHÉ)
                </text>
                {/* Salt & Oil bottles on counter */}
                <rect x="472" y="228" width="7" height="14" rx="2" fill="#f8fafc" />
                <rect x="484" y="225" width="8" height="17" rx="2" fill="#eab308" />

                {/* Gran Archivero (BASE DE DATOS SQL) */}
                <rect x="546" y="155" width="54" height="118" rx="4" fill="#1e293b" stroke="#34d399" strokeWidth="2" />
                <rect x="552" y="164" width="42" height="22" rx="2" fill="#0f172a" stroke="#34d399" strokeWidth="1" />
                <rect x="552" y="192" width="42" height="22" rx="2" fill="#0f172a" stroke="#34d399" strokeWidth="1" />
                <rect x="552" y="220" width="42" height="22" rx="2" fill="#0f172a" stroke="#34d399" strokeWidth="1" />
                <text x="573" y="262" textAnchor="middle" fill="#34d399" fontSize="8" fontWeight="800">
                  ARCHIVO SQL
                </text>
              </g>

              {/* BUILDING 3: LA PANADERÍA (WEBHOOK) & LA FÁBRICA / BARCO DOCKER */}
              <g
                onClick={() => onSelectConcept?.('webhook')}
                style={{ cursor: 'pointer' }}
              >
                <rect x="640" y="135" width="140" height="145" rx="6" fill="#1e1b4b" stroke="#fbbf24" strokeWidth="2.5" />
                {/* Bakery Striped Awning */}
                <path d="M634 135 L786 135 L794 156 L626 156 Z" fill="#dc2626" stroke="#fde047" strokeWidth="1.5" />
                <text x="710" y="126" textAnchor="middle" fill="#fbbf24" fontSize="10.5" fontWeight="800">
                  PANADERÍA (WEBHOOK)
                </text>
                {/* Brick Oven with Glowing Fire & Croissants */}
                <rect x="656" y="185" width="66" height="58" rx="6" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
                <path d="M668 232 C668 205 710 205 710 232 Z" fill="url(#fireGlow)" />
                {/* Rising aroma steam */}
                <path
                  d={`M682 ${180 - (steamOffset % 15)} Q686 ${172 - (steamOffset % 15)} 682 ${165 - (steamOffset % 15)}`}
                  stroke="#fde047"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d={`M698 ${180 - (steamOffset % 15)} Q702 ${172 - (steamOffset % 15)} 698 ${165 - (steamOffset % 15)}`}
                  stroke="#fde047"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Phone ringing on bakery counter */}
                <rect x="734" y="205" width="34" height="24" rx="4" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
                <text x="751" y="220" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="800">
                  TE AVISA
                </text>
              </g>

              {/* BUILDING 4: FÁBRICA DOCKER + ASISTENTE IA (MCP) */}
              <g
                onClick={() => onSelectConcept?.('docker')}
                style={{ cursor: 'pointer' }}
              >
                <rect x="802" y="135" width="138" height="145" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
                <text x="871" y="126" textAnchor="middle" fill="#38bdf8" fontSize="10.5" fontWeight="800">
                  FÁBRICA &amp; IA (DOCKER/RAG)
                </text>
                {/* Stacked Blue Docker Containers / Suitcases */}
                <rect x="816" y="160" width="48" height="28" rx="4" fill="#0284c7" stroke="#7dd3fc" strokeWidth="1.5" />
                <text x="840" y="178" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800">
                  VALIJA 1
                </text>
                <rect x="872" y="160" width="48" height="28" rx="4" fill="#0369a1" stroke="#7dd3fc" strokeWidth="1.5" />
                <text x="896" y="178" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800">
                  VALIJA 2
                </text>
                {/* AI Robot / Owl with Open Book (RAG) and USB-C Plug (MCP) */}
                <rect x="816" y="202" width="106" height="62" rx="6" fill="#2e1065" stroke="#f472b6" strokeWidth="1.8" />
                <circle cx="842" cy="232" r="12" fill="#f472b6" />
                <circle cx="838" cy="230" r="2.5" fill="#050811" />
                <circle cx="846" cy="230" r="2.5" fill="#050811" />
                <text x="886" y="226" textAnchor="middle" fill="#fbcfe8" fontSize="8.5" fontWeight="800">
                  AGENTE IA
                </text>
                <text x="886" y="240" textAnchor="middle" fill="#34d399" fontSize="7.5" fontWeight="700">
                  + Apuntes RAG
                </text>
                <text x="886" y="252" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontWeight="700">
                  + Enchufe MCP
                </text>
              </g>

              {/* =============================================================
                  THE MULTI-LANE HIGHWAY (ANCHO DE BANDA + CAMIÓN BLINDADO HTTPS)
              ============================================================= */}
              <rect x="0" y="295" width="960" height="82" fill="url(#roadGrad)" stroke="#334155" strokeWidth="2" />
              <line x1="0" y1="336" x2="960" y2="336" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="18 14" />
              <text x="480" y="312" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="800" letterSpacing="1">
                AUTOPISTA DE 8 CARRILES (ANCHO DE BANDA) — VELOCIDAD DE VIAJE = LATENCIA
              </text>

              {/* Animated Armored Truck (HTTPS + SSL) driving along the highway */}
              <g
                transform={`translate(${
                  cityOrderPhase > 0 ? 100 + cityOrderPhase * 115 : 80 + truckOffset
                }, 314)`}
              >
                <rect x="0" y="4" width="88" height="36" rx="6" fill="#065f46" stroke="#34d399" strokeWidth="2" />
                <rect x="68" y="10" width="16" height="14" rx="2" fill="#7dd3fc" />
                {/* Padlock drawn on the side of the truck */}
                <rect x="14" y="18" width="14" height="12" rx="2" fill="#fbbf24" />
                <path d="M17 18 V14 C17 11 25 11 25 14 V18" stroke="#fbbf24" strokeWidth="2" fill="none" />
                <text x="46" y="24" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800">
                  HTTPS SSL
                </text>
                <text x="46" y="34" textAnchor="middle" fill="#A7F3D0" fontSize="7" fontWeight="700">
                  BLINDADO
                </text>
                {/* Wheels */}
                <circle cx="20" cy="42" r="7" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
                <circle cx="68" cy="42" r="7" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
              </g>

              {/* UNDERGROUND SUBWAY TUNNEL: VPN (Túnel Subterráneo Privado) */}
              <rect x="0" y="382" width="960" height="88" fill="#030712" />
              <rect x="60" y="396" width="840" height="44" rx="22" fill="#0f172a" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="8 4" />
              <text x="480" y="414" textAnchor="middle" fill="#a5b4fc" fontSize="10" fontWeight="800">
                TÚNEL SUBTERRÁNEO PRIVADO (VPN) — NADIE EN LA VEREDA VE QUÉ LLEVÁS ENCIMA
              </text>
              {/* Secret Capsule moving inside the underground VPN tunnel */}
              <g transform={`translate(${120 + ((760 - truckOffset) % 680)}, 419)`}>
                <rect x="0" y="0" width="92" height="16" rx="8" fill="#4f46e5" stroke="#c7d2fe" strokeWidth="1.5" />
                <text x="46" y="11" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="800">
                  CÁPSULA CIFRADA
                </text>
              </g>
            </g>
          )}

          {/* =================================================================
              SCENE 1: LA PANADERÍA (WEBHOOK VS. POLLING MINI-GAME)
          ================================================================= */}
          {mission === 'bakery-webhook' && (
            <g>
              <rect x="0" y="360" width="960" height="110" fill="#1e293b" />
              {/* Left Side: Tu Casa con Teléfono */}
              <polygon points="60,170 165,100 270,170" fill="#0284c7" stroke="#38bdf8" strokeWidth="3" />
              <rect x="80" y="170" width="170" height="190" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
              <text x="165" y="198" textAnchor="middle" fill="#38bdf8" fontSize="13" fontWeight="800">
                TU CASA (CLIENTE)
              </text>
              {/* Person inside house */}
              <circle cx="165" cy="248" r="20" fill="#fde047" />
              <circle cx="158" cy="244" r="3" fill="#0f172a" />
              <circle cx="172" cy="244" r="3" fill="#0f172a" />
              <path
                d={bakeryMode === 'polling' ? 'M156 258 Q165 250 174 258' : 'M155 254 Q165 264 175 254'}
                stroke="#0f172a"
                strokeWidth="2.5"
                fill="none"
              />
              <path d="M135 320 C135 280 195 280 195 320" fill="#0284c7" />

              {/* Speech bubble from customer */}
              <rect x="55" y="42" width="245" height="52" rx="10" fill="#0f172a" stroke={bakeryMode === 'polling' ? '#ef4444' : '#34d399'} strokeWidth="2.5" />
              <text x="177" y="64" textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="800">
                {bakeryMode === 'polling'
                  ? '¡Llamo cada 5 min: ¿YA ESTÁN LAS FACTURAS?!'
                  : 'Dejé mi número anotado. Tomo mate tranquilo.'}
              </text>
              <text x="177" y="82" textAnchor="middle" fill="#94a3b8" fontSize="10">
                {bakeryMode === 'polling'
                  ? 'Gastás batería, tiempo y saturás al panadero'
                  : 'Cero llamadas inútiles (Eso es un WEBHOOK)'}
              </text>

              {/* Center Telephone Wire & Animated Signals */}
              <path d="M250 245 Q480 160 660 245" stroke="#475569" strokeWidth="3" fill="none" />

              {bakeryMode === 'polling' && (
                <g>
                  {/* Spamming Red Phone Calls going Left -> Right constantly */}
                  {[0, 1, 2, 3].map((i) => {
                    const pos = ((tick * 5 + i * 105) % 410) + 250;
                    return (
                      <g key={i} transform={`translate(${pos}, 198)`}>
                        <rect x="-38" y="-14" width="76" height="26" rx="13" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.5" />
                        <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="800">
                          ¿YA ESTÁN?
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {bakeryMode === 'webhook' && bakeryOvenReady && (
                <g transform={`translate(${640 - ((tick * 6) % 380)}, 195)`}>
                  <rect x="-75" y="-18" width="150" height="34" rx="17" fill="#059669" stroke="#6ee7b7" strokeWidth="2.5" />
                  <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">
                    ¡RING! ¡SALIERON DEL HORNO!
                  </text>
                </g>
              )}

              {/* Right Side: LA PANADERÍA CON HORNO DE LADRILLOS */}
              <rect x="650" y="120" width="260" height="240" rx="8" fill="#1e1b4b" stroke="#fbbf24" strokeWidth="3" />
              {/* Striped Bakery Awning */}
              <path d="M635 120 L925 120 L935 152 L625 152 Z" fill="#dc2626" stroke="#fde047" strokeWidth="2" />
              <text x="780" y="104" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="800">
                LA PANADERÍA (SERVIDOR)
              </text>

              {/* Notebook on Counter with Your Phone Number (Webhook Subscription) */}
              <rect x="665" y="170" width="92" height="58" rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
              <text x="711" y="188" textAnchor="middle" fill="#78350f" fontSize="9.5" fontWeight="800">
                LISTA WEBHOOK:
              </text>
              <text x="711" y="203" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="700">
                Avisar a Nicolás
              </text>
              <text x="711" y="216" textAnchor="middle" fill="#059669" fontSize="8.5" fontWeight="800">
                Tel: 11-4555-9999
              </text>

              {/* Brick Oven with Fire & Croissants */}
              <rect x="775" y="175" width="118" height="115" rx="10" fill="#451a03" stroke="#f59e0b" strokeWidth="2.5" />
              <path d="M792 265 C792 215 876 215 876 265 Z" fill="url(#fireGlow)" />
              <text x="834" y="196" textAnchor="middle" fill="#fde047" fontSize="10" fontWeight="800">
                {bakeryOvenReady ? '¡FACTURAS LISTAS!' : 'HORNEANDO...'}
              </text>

              {/* Golden Croissants Tray when Oven is Ready */}
              {bakeryOvenReady && (
                <g transform="translate(675, 265)">
                  <rect x="0" y="18" width="90" height="10" rx="4" fill="#cbd5e1" />
                  <path d="M12 16 C16 4 28 4 32 16 Z" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
                  <path d="M36 16 C40 4 52 4 56 16 Z" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
                  <path d="M60 16 C64 4 76 4 80 16 Z" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
                </g>
              )}
            </g>
          )}

          {/* =================================================================
              SCENE 2: EL RESTAURANTE (FRONTEND, API, REST, GRAPHQL, CACHÉ)
          ================================================================= */}
          {mission === 'restaurant-api' && (
            <g>
              <rect x="0" y="375" width="960" height="95" fill="#1e293b" />
              {/* Left Salon: VIDRIERA Y MESA (FRONTEND) */}
              <rect x="35" y="75" width="260" height="300" rx="10" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
              <rect x="55" y="90" width="220" height="28" rx="6" fill="#082f49" />
              <text x="165" y="109" textAnchor="middle" fill="#38bdf8" fontSize="12.5" fontWeight="800">
                SALÓN Y VIDRIERA (FRONTEND)
              </text>
              <text x="165" y="135" textAnchor="middle" fill="#94a3b8" fontSize="10">
                Todo lo que el cliente ve y toca
              </text>

              {/* Customer at Restaurant Table */}
              <circle cx="115" cy="235" r="18" fill="#fde047" />
              <path d="M88 310 C88 265 142 265 142 310" fill="#38bdf8" />
              <rect x="135" y="285" width="110" height="10" rx="3" fill="#d97706" />
              <rect x="182" y="295" width="12" height="65" fill="#78350f" />

              {/* Customer Order Speech Bubble */}
              <rect x="65" y="155" width="205" height="54" rx="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
              <text x="167" y="177" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">
                {orderType === 'rest' && 'REST API: "Dame el Combo Fijo #4"'}
                {orderType === 'graphql' && 'GraphQL: "Solo 2 papas y medio vaso"'}
                {orderType === 'websocket' && 'WebSocket: "Hablemos por teléfono en vivo"'}
              </text>
              <text x="167" y="195" textAnchor="middle" fill="#7dd3fc" fontSize="9.5">
                {orderType === 'rest' && 'Formulario estándar con casilleros fijos'}
                {orderType === 'graphql' && 'Cero desperdicio: ni un gramo de más'}
                {orderType === 'websocket' && 'Canal abierto bidireccional sin cortar'}
              </text>

              {/* Center: THE WAITER (EL MOZO = API) */}
              <g transform={`translate(${345 + Math.sin(tick / 7) * 45}, 215)`}>
                <rect x="-15" y="-58" width="140" height="36" rx="8" fill="#065f46" stroke="#34d399" strokeWidth="2" />
                <text x="55" y="-42" textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="800">
                  EL MOZO = LA API
                </text>
                <text x="55" y="-28" textAnchor="middle" fill="#a7f3d0" fontSize="9.5">
                  Lleva tu pedido a la cocina
                </text>
                <circle cx="55" cy="0" r="16" fill="#fde047" />
                <rect x="37" y="18" width="36" height="58" rx="6" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
                {/* Waiter Tray */}
                <rect x="75" y="26" width="66" height="6" rx="3" fill="#cbd5e1" />
                {orderType === 'rest' && (
                  <g>
                    <rect x="82" y="8" width="52" height="18" rx="4" fill="#a78bfa" />
                    <text x="108" y="20" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800">
                      COMBO COMPLETO
                    </text>
                  </g>
                )}
                {orderType === 'graphql' && (
                  <g>
                    <rect x="92" y="10" width="34" height="16" rx="4" fill="#34d399" />
                    <text x="109" y="21" textAnchor="middle" fill="#050811" fontSize="8.5" fontWeight="800">
                      2 PAPAS
                    </text>
                  </g>
                )}
                {orderType === 'websocket' && (
                  <g>
                    <rect x="82" y="8" width="54" height="18" rx="9" fill="#38bdf8" />
                    <text x="109" y="20" textAnchor="middle" fill="#050811" fontSize="8.5" fontWeight="800">
                      LÍNEA ABIERTA
                    </text>
                  </g>
                )}
              </g>

              {/* Right Kitchen: COCINA (BACKEND) + MESADA (CACHÉ) + SÓTANO (ARCHIVERO DB) */}
              <rect x="575" y="75" width="350" height="300" rx="10" fill="#0f172a" stroke="#34d399" strokeWidth="3" />
              <rect x="595" y="90" width="310" height="28" rx="6" fill="#064e3b" />
              <text x="750" y="109" textAnchor="middle" fill="#34d399" fontSize="12.5" fontWeight="800">
                LA COCINA Y DEPÓSITO (BACKEND)
              </text>

              {/* Mesada con Sal y Aceite (Caché) */}
              <rect
                x="600"
                y="185"
                width="145"
                height="75"
                rx="8"
                fill={cacheOnCounter ? '#451a03' : '#1e293b'}
                stroke={cacheOnCounter ? '#fbbf24' : '#475569'}
                strokeWidth="2.5"
              />
              <text x="672" y="208" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="800">
                MESADA (CACHÉ)
              </text>
              <text x="672" y="226" textAnchor="middle" fill="#fde68a" fontSize="9.5">
                {cacheOnCounter ? '¡Sal y Aceite a mano! (1 ms)' : 'Mesada vacía (Lento)'}
              </text>
              <text x="672" y="244" textAnchor="middle" fill="#94a3b8" fontSize="8.5">
                Evita bajar al sótano cada vez
              </text>

              {/* Sótano / Archivero Gigante (Base de Datos SQL) */}
              <rect
                x="765"
                y="145"
                width="140"
                height="210"
                rx="8"
                fill="#1e293b"
                stroke={!cacheOnCounter ? '#38bdf8' : '#475569'}
                strokeWidth="2.5"
              />
              <text x="835" y="170" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="800">
                ARCHIVERO (SQL)
              </text>
              <rect x="782" y="185" width="106" height="34" rx="4" fill="#0f172a" stroke="#38bdf8" />
              <text x="835" y="206" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700">
                Índice: Pág. 312
              </text>
              <rect x="782" y="230" width="106" height="34" rx="4" fill="#0f172a" stroke="#38bdf8" />
              <text x="835" y="251" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700">
                Planilla Clientes
              </text>
              <rect x="782" y="275" width="106" height="34" rx="4" fill="#0f172a" stroke="#38bdf8" />
              <text x="835" y="296" textAnchor="middle" fill="#cbd5e1" fontSize="9.5" fontWeight="700">
                Bóveda ACID
              </text>
            </g>
          )}

          {/* =================================================================
              SCENE 3: MONOLITO VS. MICROSERVICIOS (SIMULADOR DE TÉRMICA)
          ================================================================= */}
          {mission === 'monolith-vs-micro' && (
            <g>
              <rect x="0" y="385" width="960" height="85" fill="#1e293b" />

              {/* LEFT HALF: EL MONOLITO (Un solo edificio con una sola llave térmica) */}
              <rect
                x="45"
                y="65"
                width="380"
                height="320"
                rx="10"
                fill={shortCircuitActive ? '#090d16' : '#0f172a'}
                stroke={shortCircuitActive ? '#ef4444' : '#a78bfa'}
                strokeWidth="3.5"
              />
              <text x="235" y="45" textAnchor="middle" fill="#a78bfa" fontSize="14" fontWeight="800">
                A) EL MONOLITO (UN SOLO EDIFICIO)
              </text>

              {/* Single Master Thermal Switch */}
              <rect x="70" y="85" width="330" height="40" rx="6" fill={shortCircuitActive ? '#7f1d1d' : '#1e1b4b'} stroke="#f87171" strokeWidth="2" />
              <text x="235" y="110" textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="800">
                {shortCircuitActive
                  ? 'LLAVE TÉRMICA ÚNICA: ¡SALTÓ! TODO EL EDIFICIO A OSCURAS'
                  : 'LLAVE TÉRMICA ÚNICA: ENCENDIDA (Todos comparten cable)'}
              </text>

              {/* 4 Floors inside the Monolith */}
              {['Piso 4: Salón de Ventas', 'Piso 3: Caja y Cobros', 'Piso 2: Impresora de Facturas', 'Piso 1: Cafetera de la Cocina (BUG)'].map(
                (floor, i) => (
                  <g key={floor} transform={`translate(70, ${140 + i * 56})`}>
                    <rect
                      x="0"
                      y="0"
                      width="330"
                      height="44"
                      rx="6"
                      fill={shortCircuitActive ? '#111827' : '#1e293b'}
                      stroke={shortCircuitActive ? '#dc2626' : '#fbbf24'}
                      strokeWidth="2"
                    />
                    {/* Lit or Dark Windows */}
                    <rect x="14" y="10" width="24" height="24" rx="3" fill={shortCircuitActive ? '#1f2937' : '#fde047'} />
                    <rect x="46" y="10" width="24" height="24" rx="3" fill={shortCircuitActive ? '#1f2937' : '#fde047'} />
                    <text x="90" y="26" fill={shortCircuitActive ? '#ef4444' : '#f8fafc'} fontSize="11" fontWeight="800">
                      {shortCircuitActive ? `${floor} -> ¡APAGADO!` : `${floor} -> Funcionando`}
                    </text>
                  </g>
                )
              )}

              {/* RIGHT HALF: EL BARRIO DE MICROSERVICIOS (Locales independientes) */}
              <text x="700" y="45" textAnchor="middle" fill="#34d399" fontSize="14" fontWeight="800">
                B) MICROSERVICIOS (BARRIO DE LOCALES)
              </text>

              {/* 4 Separate Neighborhood Shops */}
              {[
                { name: 'CARNICERÍA (Con Cortocircuito)', color: '#ef4444', x: 500, y: 80, fails: true },
                { name: 'PANADERÍA (Térmica Propia)', color: '#34d399', x: 720, y: 80, fails: false },
                { name: 'FARMACIA (Térmica Propia)', color: '#38bdf8', x: 500, y: 240, fails: false },
                { name: 'BANCO (Térmica Propia)', color: '#fbbf24', x: 720, y: 240, fails: false },
              ].map((shop) => {
                const isDark = shortCircuitActive && shop.fails;
                return (
                  <g key={shop.name} transform={`translate(${shop.x}, ${shop.y})`}>
                    <polygon points="0,35 95,0 190,35" fill={isDark ? '#450a0a' : '#065f46'} stroke={shop.color} strokeWidth="2" />
                    <rect
                      x="10"
                      y="35"
                      width="170"
                      height="105"
                      rx="6"
                      fill={isDark ? '#111827' : '#0f172a'}
                      stroke={isDark ? '#dc2626' : shop.color}
                      strokeWidth="2.5"
                    />
                    <text x="95" y="55" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="800">
                      {shop.name}
                    </text>
                    {/* Shop Windows */}
                    <rect x="28" y="68" width="44" height="36" rx="4" fill={isDark ? '#1f2937' : '#fde047'} />
                    <rect x="118" y="68" width="44" height="36" rx="4" fill={isDark ? '#1f2937' : '#fde047'} />
                    <text x="95" y="125" textAnchor="middle" fill={isDark ? '#f87171' : '#6ee7b7'} fontSize="10" fontWeight="800">
                      {isDark ? 'SIN LUZ (Solo este local)' : '¡ABIERTO Y VENDIENDO!'}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* =================================================================
              SCENE 4: SEGURIDAD (PATOVICA FIREWALL, DDoS Y PULSERA JWT)
          ================================================================= */}
          {mission === 'security-bouncer' && (
            <g>
              <rect x="0" y="370" width="960" height="100" fill="#1e293b" />

              {/* Left Side: Street with Pranksters (DDoS) & Legitimate Guest */}
              {ddosAttackActive && (
                <g>
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const bounceX = firewallEnabled ? 40 + ((tick * 4 + i * 35) % 260) : 40 + ((tick * 5 + i * 80) % 680);
                    const bounceY = 140 + (i % 3) * 70;
                    return (
                      <g key={i} transform={`translate(${bounceX}, ${bounceY})`}>
                        <circle cx="0" cy="0" r="14" fill="#ef4444" />
                        <text x="0" y="-20" textAnchor="middle" fill="#fca5a5" fontSize="9" fontWeight="800">
                          BROMISTA DDoS
                        </text>
                        <circle cx="-5" cy="-3" r="2.5" fill="#ffffff" />
                        <circle cx="5" cy="-3" r="2.5" fill="#ffffff" />
                        <path d="M-6 6 L6 6" stroke="#ffffff" strokeWidth="2" />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Legitimate Customer with DNI & Hotel Wristband (JWT) */}
              <g transform="translate(220, 260)">
                <rect x="-55" y="-55" width="150" height="36" rx="8" fill="#0f172a" stroke="#fbbf24" strokeWidth="2" />
                <text x="20" y="-39" textAnchor="middle" fill="#fde047" fontSize="10" fontWeight="800">
                  CLIENTE REAL (Con DNI)
                </text>
                <text x="20" y="-25" textAnchor="middle" fill={hasJwtWristband ? '#34d399' : '#f87171'} fontSize="9" fontWeight="700">
                  {hasJwtWristband ? 'Tiene Pulsera Dorada (JWT)' : 'Sin Pulsera (Piden DNI siempre)'}
                </text>
                <circle cx="20" cy="0" r="16" fill="#fde047" />
                <rect x="4" y="18" width="32" height="54" rx="6" fill="#0284c7" />
                {/* Glowing Wristband (JWT) */}
                {hasJwtWristband && <circle cx="42" cy="40" r="7" fill="#fbbf24" stroke="#ffffff" strokeWidth="2" />}
              </g>

              {/* Center: EL PATOVICA (FIREWALL + RATE LIMITING) */}
              <g transform="translate(465, 220)">
                {firewallEnabled && (
                  <path
                    d="M-35 -95 Q-55 30 -35 145"
                    stroke="#38bdf8"
                    strokeWidth="6"
                    fill="none"
                    opacity="0.85"
                  />
                )}
                <rect x="-65" y="-85" width="170" height="40" rx="8" fill={firewallEnabled ? '#065f46' : '#7f1d1d'} stroke="#ffffff" strokeWidth="2" />
                <text x="20" y="-67" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">
                  {firewallEnabled ? 'PATOVICA ACTIVO (FIREWALL)' : 'PATOVICA DORMIDO'}
                </text>
                <text x="20" y="-52" textAnchor="middle" fill="#a7f3d0" fontSize="9">
                  {firewallEnabled ? 'Frena bromistas y mira lista' : '¡Pasan todos los intrusos!'}
                </text>
                {/* Big Bouncer Illustration */}
                <circle cx="20" cy="-15" r="20" fill="#fca5a5" />
                <rect x="6" y="-22" width="12" height="7" fill="#050811" />
                <rect x="22" y="-22" width="12" height="7" fill="#050811" />
                <rect x="-12" y="8" width="64" height="85" rx="10" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2.5" />
              </g>

              {/* Right Side: HOTEL ALL-INCLUSIVE & LICUADORA DE HASHING */}
              <rect x="665" y="75" width="260" height="295" rx="10" fill="#0f172a" stroke="#fbbf24" strokeWidth="3" />
              <text x="795" y="105" textAnchor="middle" fill="#fbbf24" fontSize="13" fontWeight="800">
                HOTEL ALL-INCLUSIVE (SISTEMA)
              </text>

              {/* Blender Smoothie (Hashing) */}
              <g transform="translate(705, 145)">
                <rect x="0" y="0" width="180" height="95" rx="8" fill="#1e293b" stroke="#f472b6" strokeWidth="2" />
                <text x="90" y="22" textAnchor="middle" fill="#f472b6" fontSize="10.5" fontWeight="800">
                  LICUADORA (HASHING SHA-256)
                </text>
                <text x="90" y="42" textAnchor="middle" fill="#e2e8f0" fontSize="9.5">
                  Frutilla (Tu Clave) -&gt; Licuado
                </text>
                <text x="90" y="60" textAnchor="middle" fill="#94a3b8" fontSize="8.5">
                  Nadie puede volver a armar la fruta
                </text>
              </g>

              {/* Platea vs Camarin (Autorización) */}
              <g transform="translate(705, 255)">
                <rect x="0" y="0" width="180" height="85" rx="8" fill="#1e293b" stroke="#34d399" strokeWidth="2" />
                <text x="90" y="22" textAnchor="middle" fill="#34d399" fontSize="10.5" fontWeight="800">
                  BAR VIP (AUTORIZACIÓN)
                </text>
                <text x="90" y="44" textAnchor="middle" fill="#e2e8f0" fontSize="9.5">
                  {hasJwtWristband
                    ? '¡Pulsera dorada! Café servido en 1s'
                    : 'Frenado: Mostrá tu pasaporte de nuevo'}
                </text>
              </g>
            </g>
          )}

          {/* =================================================================
              SCENE 5: LA FÁBRICA, EL BARCO DOCKER Y EL TEATRO (DEVOPS)
          ================================================================= */}
          {mission === 'factory-docker' && (
            <g>
              {/* Water waves at bottom left for Cargo Ship */}
              <rect x="0" y="365" width="960" height="105" fill="#0c4a6e" />

              {/* 1. LEFT: LÍNEA DE ENSAMBLAJE (GIT + CI/CD) */}
              <rect x="25" y="95" width="265" height="250" rx="10" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" />
              <text x="157" y="122" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="800">
                1. FÁBRICA Y CINTA (GIT + CI/CD)
              </text>
              {/* Conveyor Belt */}
              <rect x="45" y="225" width="225" height="22" rx="11" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="68" cy="236" r="7" fill="#fbbf24" />
              <circle cx="157" cy="236" r="7" fill="#fbbf24" />
              <circle cx="245" cy="236" r="7" fill="#fbbf24" />
              {/* Moving Docker Suitcase on the Conveyor Belt */}
              <g transform={`translate(${55 + ((tick * 3) % 145)}, 175)`}>
                <rect x="0" y="0" width="58" height="46" rx="6" fill="#0284c7" stroke="#7dd3fc" strokeWidth="2" />
                <path d="M18 0 V-8 H40 V0" stroke="#7dd3fc" strokeWidth="2.5" fill="none" />
                <text x="29" y="26" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="800">
                  DOCKER
                </text>
              </g>
              <text x="157" y="285" textAnchor="middle" fill="#cbd5e1" fontSize="9.5">
                Empaca todo en una valija idéntica
              </text>

              {/* 2. CENTER: BARCO CARGUERO (KUBERNETES) */}
              <g transform={`translate(335, ${185 + waveOffset})`}>
                <text x="125" y="-50" textAnchor="middle" fill="#38bdf8" fontSize="12" fontWeight="800">
                  2. BARCO CARGUERO (KUBERNETES)
                </text>
                {/* Stacked Containers on Ship Deck */}
                <rect x="35" y="45" width="55" height="36" rx="4" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                <rect x="95" y="45" width="55" height="36" rx="4" fill="#059669" stroke="#ffffff" strokeWidth="1.5" />
                <rect x="155" y="45" width="55" height="36" rx="4" fill="#7c3aed" stroke="#ffffff" strokeWidth="1.5" />
                <rect x="65" y="6" width="55" height="36" rx="4" fill="#d97706" stroke="#ffffff" strokeWidth="1.5" />
                <rect x="125" y="6" width="55" height="36" rx="4" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                {/* Ship Hull */}
                <polygon points="10,82 240,82 215,145 35,145" fill="#991b1b" stroke="#f87171" strokeWidth="2.5" />
                <text x="125" y="118" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800">
                  CAPITÁN KUBERNETES
                </text>
              </g>

              {/* 3. RIGHT: EL TEATRO (STAGING vs PRODUCCIÓN vs ROLLBACK) */}
              <rect x="615" y="75" width="320" height="285" rx="10" fill="#0f172a" stroke="#ef4444" strokeWidth="3" />
              {/* Red Theater Curtains */}
              <path d="M615 75 L665 75 L645 245 L615 245 Z" fill="#991b1b" />
              <path d="M935 75 L885 75 L905 245 L935 245 Z" fill="#991b1b" />
              <rect x="615" y="75" width="320" height="28" rx="4" fill="#7f1d1d" />
              <text x="775" y="94" textAnchor="middle" fill="#fde047" fontSize="11.5" fontWeight="800">
                {theaterStage === 'staging' && 'TEATRO EN ENSAYO (STAGING - SIN PÚBLICO)'}
                {theaterStage === 'production' && 'TEATRO EN VIVO (PRODUCCIÓN - SALA LLENA)'}
                {theaterStage === 'spicy-bug' && '¡INGREDIENTE FEO EN VIVO! (ERROR EN PROD)'}
                {theaterStage === 'rollback' && '¡ROLLBACK ACTIVADO! (RECETA CLÁSICA EN 1s)'}
              </text>

              {/* Stage Floor & Actor / Dish */}
              <rect x="655" y="225" width="240" height="12" fill="#d97706" />
              <circle
                cx="775"
                cy="175"
                r="28"
                fill={theaterStage === 'spicy-bug' ? '#dc2626' : '#34d399'}
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <text x="775" y="179" textAnchor="middle" fill="#050811" fontSize="10" fontWeight="800">
                {theaterStage === 'spicy-bug' ? '¡BUG!' : 'VERSIÓN OK'}
              </text>

              {/* Audience Seats */}
              {[0, 1, 2, 3, 4].map((seatIdx) => (
                <g key={seatIdx} transform={`translate(${668 + seatIdx * 52}, 295)`}>
                  <rect x="-16" y="0" width="32" height="28" rx="6" fill="#475569" />
                  {theaterStage !== 'staging' && (
                    <circle
                      cx="0"
                      cy="-10"
                      r="11"
                      fill={theaterStage === 'spicy-bug' ? '#f87171' : '#fde047'}
                    />
                  )}
                </g>
              ))}
              <text x="775" y="348" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="700">
                {theaterStage === 'staging'
                  ? 'Butacas vacías: si algo falla acá, ningún cliente lo ve'
                  : theaterStage === 'spicy-bug'
                  ? '¡El público ve el error! Apretá Rollback arriba'
                  : 'Público aplaudiendo: función estable y monitoreada'}
              </text>
            </g>
          )}

          {/* =================================================================
              SCENE 6: LABORATORIO DE IA (LLM, RAG A LIBRO ABIERTO, MCP, GUARDRAILS)
          ================================================================= */}
          {mission === 'ai-rag-exam' && (
            <g>
              <rect x="0" y="375" width="960" height="95" fill="#1e293b" />

              {/* Left: EL PUPITRE DEL EXAMEN (LLM + RAG APUNTES ABIERTOS) */}
              <rect x="35" y="65" width="440" height="305" rx="12" fill="#0f172a" stroke="#f472b6" strokeWidth="3" />
              <text x="255" y="95" textAnchor="middle" fill="#f472b6" fontSize="13" fontWeight="800">
                EL LORO SÚPER LEÍDO (LLM) RINDIENDO EXAMEN
              </text>

              {/* Scholar Owl / Parrot Character with Graduation Cap */}
              <g transform="translate(155, 215)">
                <polygon points="0,-46 -38,-30 0,-14 38,-30" fill="#1e1b4b" stroke="#fbbf24" strokeWidth="2" />
                <circle cx="0" cy="0" r="28" fill="#ec4899" stroke="#fbcfe8" strokeWidth="2" />
                <circle cx="-10" cy="-5" r="6" fill="#ffffff" />
                <circle cx="10" cy="-5" r="6" fill="#ffffff" />
                <circle cx="-10" cy="-5" r="2.5" fill="#050811" />
                <circle cx="10" cy="-5" r="2.5" fill="#050811" />
                <polygon points="-5,4 5,4 0,13" fill="#fbbf24" />
              </g>

              {/* School Desk with Open Book (RAG) or Empty Desk (Hallucination) */}
              <rect x="95" y="255" width="320" height="16" rx="4" fill="#b45309" />
              {aiHasRagNotes ? (
                <g transform="translate(225, 215)">
                  {/* Open Book on Desk */}
                  <path d="M0 35 L55 25 L55 -10 L0 0 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
                  <path d="M110 35 L55 25 L55 -10 L110 0 Z" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
                  <text x="55" y="15" textAnchor="middle" fill="#78350f" fontSize="9.5" fontWeight="800">
                    APUNTES ABIERTOS (RAG)
                  </text>
                </g>
              ) : (
                <text x="285" y="242" textAnchor="middle" fill="#f87171" fontSize="10.5" fontWeight="800">
                  SIN APUNTES (SOLO DE MEMORIA)
                </text>
              )}

              {/* Answer Speech Bubble from the AI */}
              <rect
                x="65"
                y="112"
                width="380"
                height="52"
                rx="10"
                fill="#1e293b"
                stroke={aiHasRagNotes ? '#34d399' : '#ef4444'}
                strokeWidth="2.5"
              />
              <text x="255" y="134" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">
                {aiHasRagNotes
                  ? 'CON RAG: "Según la página 4 del apunte, la panadería abre a las 8:00"'
                  : 'ALUCINACIÓN: "¡Abre a las 3:47 AM en Calle Inventada 9999! (Mentira segura)"'}
              </text>
              <text x="255" y="152" textAnchor="middle" fill={aiHasRagNotes ? '#6ee7b7' : '#fca5a5'} fontSize="9.5">
                {aiHasRagNotes
                  ? 'Lee datos reales verificados encima del banco'
                  : 'Por no decir "no sé", inventa con total confianza'}
              </text>

              {/* Right Top: ENCHUFE UNIVERSAL USB-C (MCP) + CALCULADORA (TOOL CALLING) */}
              <rect x="505" y="65" width="420" height="145" rx="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
              <text x="715" y="92" textAnchor="middle" fill="#38bdf8" fontSize="12" fontWeight="800">
                ENCHUFE UNIVERSAL USB-C (MCP) + CALCULADORA (TOOLS)
              </text>

              {/* USB-C Plug Animation */}
              <g transform={`translate(${aiHasMcpPlug ? 595 : 535}, 125)`}>
                <rect x="0" y="0" width="95" height="38" rx="8" fill="#0284c7" stroke="#7dd3fc" strokeWidth="2" />
                <rect x="95" y="10" width="22" height="18" rx="3" fill="#cbd5e1" />
                <text x="47" y="23" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800">
                  FICHA MCP
                </text>
              </g>
              {/* Wall Socket (Tus Carpetas, Mails, Calendario) */}
              <rect x="710" y="115" width="185" height="58" rx="8" fill="#1e293b" stroke="#34d399" strokeWidth="2" />
              <text x="802" y="140" textAnchor="middle" fill="#34d399" fontSize="10.5" fontWeight="800">
                TUS SISTEMAS Y CARPETAS
              </text>
              <text x="802" y="158" textAnchor="middle" fill="#cbd5e1" fontSize="9">
                {aiHasMcpPlug ? '¡Conectado! Usa Calculadora y Archivos' : 'Desenchufado de tus datos'}
              </text>

              {/* Right Bottom: RUTA DE MONTAÑA CON BARANDAS (GUARDRAILS) */}
              <rect x="505" y="225" width="420" height="145" rx="12" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" />
              <text x="715" y="252" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="800">
                RUTA DE MONTAÑA: BARANDAS DE SEGURIDAD (GUARDRAILS)
              </text>
              {/* Mountain Road */}
              <path d="M540 335 Q715 275 890 335" stroke="#334155" strokeWidth="28" fill="none" />
              {aiHasGuardrails && (
                <path d="M540 318 Q715 258 890 318" stroke="#fbbf24" strokeWidth="5" strokeDasharray="12 6" fill="none" />
              )}
              <text x="715" y="352" textAnchor="middle" fill={aiHasGuardrails ? '#fde047' : '#f87171'} fontSize="10" fontWeight="800">
                {aiHasGuardrails
                  ? 'BARANDAS FIRMES: Evitan que el auto derrape al precipicio'
                  : '¡PELIGRO! Sin barandas el asistente puede regalar el local'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

/**
 * Illustrated Cartoon Comic Strip Card for ANY of the 100 concepts.
 * Draws actual visual characters, buildings, props, and an interactive "Accionar Escena" button!
 */
export function IllustratedConceptCartoon({
  item,
  color,
}: {
  item: SoftwareAnalogy;
  color: string;
}) {
  const [showProblem, setShowProblem] = useState<boolean>(false);
  const icon = item.scene.blueprintIcon;

  return (
    <div
      style={{
        background: '#060a14',
        border: `1.5px solid ${showProblem ? '#ef4444' : color}`,
        borderRadius: '12px',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      {/* Top Bar inside Cartoon View: Mode Toggle Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: showProblem ? '#f87171' : '#34d399',
          }}
        >
          {showProblem ? 'ESCENA: QUÉ PASA SIN ESTO (EL CAOS)' : 'ESCENA: CÓMO FUNCIONA LA ANALOGÍA'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowProblem((p) => !p);
          }}
          style={{
            background: showProblem ? '#065f46' : '#7f1d1d',
            border: `1px solid ${showProblem ? '#34d399' : '#f87171'}`,
            color: '#ffffff',
            borderRadius: '6px',
            padding: '0.2rem 0.55rem',
            fontSize: '0.68rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showProblem ? 'Ver Solución Activa' : 'Probar Qué Pasa Sin Esto'}
        </button>
      </div>

      {/* Illustrated 2D Comic Panel SVG (320 x 135) */}
      <svg
        viewBox="0 0 340 135"
        style={{
          width: '100%',
          height: 'auto',
          background: showProblem ? '#18090d' : '#091326',
          borderRadius: '8px',
          border: '1px solid #1e293b',
          display: 'block',
        }}
      >
        {/* Ground Floor line */}
        <rect x="0" y="108" width="340" height="27" fill="#0f172a" />
        <line x1="0" y1="108" x2="340" y2="108" stroke={showProblem ? '#ef4444' : color} strokeWidth="2" />

        {/* LEFT ILLUSTRATED CHARACTER (Person / Customer / Driver) */}
        <g transform="translate(46, 72)">
          <circle cx="0" cy="-16" r="11" fill="#fde047" />
          <circle cx="-3.5" cy="-18" r="1.8" fill="#0f172a" />
          <circle cx="3.5" cy="-18" r="1.8" fill="#0f172a" />
          <path
            d={showProblem ? 'M-4 -10 Q0 -15 4 -10' : 'M-4 -12 Q0 -7 4 -12'}
            stroke="#0f172a"
            strokeWidth="1.8"
            fill="none"
          />
          <path d="M-14 22 C-14 0 14 0 14 22 Z" fill="#38bdf8" />
          <text x="0" y="34" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontWeight="700">
            {item.scene.leftLabel.slice(0, 18)}
          </text>
        </g>

        {/* CENTER ILLUSTRATED ACTION / VEHICLE / WAITER / PROP */}
        <g transform="translate(170, 62)">
          {showProblem ? (
            <>
              <circle cx="0" cy="0" r="18" fill="#7f1d1d" stroke="#ef4444" strokeWidth="2" />
              <path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke="#fca5a5" strokeWidth="3" strokeLinecap="round" />
              <text x="0" y="32" textAnchor="middle" fill="#f87171" fontSize="8.5" fontWeight="800">
                ¡SIN {item.term.slice(0, 12).toUpperCase()}!
              </text>
            </>
          ) : (
            <>
              {/* Dynamic Prop Drawing based on blueprintIcon */}
              {icon === 'bakery' && (
                <g>
                  <rect x="-24" y="-14" width="48" height="28" rx="6" fill="#78350f" stroke="#fbbf24" strokeWidth="2" />
                  <path d="M-12 10 C-12 -4 12 -4 12 10 Z" fill="#f97316" />
                </g>
              )}
              {icon === 'waiter' && (
                <g>
                  <circle cx="0" cy="-8" r="8" fill="#fde047" />
                  <rect x="-8" y="0" width="16" height="20" rx="3" fill="#1e293b" stroke="#ffffff" strokeWidth="1.2" />
                  <path d="M8 4 H26" stroke="#cbd5e1" strokeWidth="2.5" />
                  <path d="M10 4 C10 -4 24 -4 24 4 Z" fill="#38bdf8" />
                </g>
              )}
              {icon === 'highway' && (
                <g>
                  <rect x="-26" y="-10" width="52" height="24" rx="5" fill="#0284c7" stroke="#7dd3fc" strokeWidth="1.8" />
                  <circle cx="-14" cy="16" r="5" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.5" />
                  <circle cx="14" cy="16" r="5" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
              )}
              {(icon === 'shield' || icon === 'lock') && (
                <g>
                  <path d="M0 -18 L18 -12 V2 C18 12 10 19 0 22 C-10 19 -18 12 -18 2 V-12 L0 -18 Z" fill="#065f46" stroke="#34d399" strokeWidth="2" />
                  <path d="M-6 2 L-1 7 L8 -4" stroke="#ffffff" strokeWidth="2.5" fill="none" />
                </g>
              )}
              {(icon === 'vault' || icon === 'library') && (
                <g>
                  <rect x="-20" y="-16" width="40" height="34" rx="4" fill="#1e293b" stroke="#34d399" strokeWidth="2" />
                  <circle cx="0" cy="1" r="8" stroke="#fbbf24" strokeWidth="2" fill="none" />
                </g>
              )}
              {(icon === 'factory' || icon === 'ship' || icon === 'building' || icon === 'switchboard' || icon === 'brain') && (
                <g>
                  <rect x="-24" y="-14" width="48" height="30" rx="6" fill="#1e1b4b" stroke={color} strokeWidth="2" />
                  <circle cx="-8" cy="1" r="4" fill={color} />
                  <circle cx="8" cy="1" r="4" fill="#fde047" />
                </g>
              )}
              {/* Animated Dashed Arrows Left -> Center -> Right */}
              <line x1="-82" y1="2" x2="-32" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
              <line x1="32" y1="2" x2="82" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
              <polygon points="80,-2 88,2 80,6" fill={color} />
              <text x="0" y="34" textAnchor="middle" fill={color} fontSize="8" fontWeight="800">
                {item.scene.actionLabel.slice(0, 26)}
              </text>
            </>
          )}
        </g>

        {/* RIGHT ILLUSTRATED BUILDING / DESTINATION */}
        <g transform="translate(292, 68)">
          <polygon points="-28,-12 0,-28 28,-12" fill="#1e293b" stroke={color} strokeWidth="1.8" />
          <rect x="-24" y="-12" width="48" height="38" rx="3" fill="#0f172a" stroke={color} strokeWidth="1.8" />
          <rect x="-15" y="-4" width="10" height="10" rx="1.5" fill={showProblem ? '#ef4444' : '#fde047'} />
          <rect x="5" y="-4" width="10" height="10" rx="1.5" fill={showProblem ? '#ef4444' : '#fde047'} />
          <rect x="-6" y="12" width="12" height="14" fill={color} />
          <text x="0" y="38" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontWeight="700">
            {item.scene.rightLabel.slice(0, 18)}
          </text>
        </g>

        {/* Top Comic Speech Ribbon */}
        <rect x="12" y="8" width="316" height="22" rx="6" fill="#050811" stroke={showProblem ? '#ef4444' : color} strokeWidth="1.2" />
        <text x="170" y="22" textAnchor="middle" fill="#f8fafc" fontSize="8.8" fontWeight="700">
          {showProblem
            ? item.scene.withoutIt.slice(0, 68) + (item.scene.withoutIt.length > 68 ? '...' : '')
            : item.scene.withIt.slice(0, 68) + (item.scene.withIt.length > 68 ? '...' : '')}
        </text>
      </svg>

      {/* Story Caption beneath the comic strip */}
      <div
        style={{
          fontSize: '0.77rem',
          color: showProblem ? '#fca5a5' : '#cbd5e1',
          lineHeight: 1.45,
          background: '#0b0f19',
          padding: '0.5rem 0.65rem',
          borderRadius: '6px',
          borderLeft: `3px solid ${showProblem ? '#ef4444' : '#34d399'}`,
        }}
      >
        {showProblem ? item.scene.withoutIt : item.scene.withIt}
      </div>
    </div>
  );
}
