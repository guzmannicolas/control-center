import { useEffect, useMemo, useState } from 'react';
import {
  CITY_ARCHETYPES,
  CITY_DISTRICTS,
  CITY_JOURNEYS,
  type AnalogyVisualScene,
  type DistrictId,
  SOFTWARE_ANALOGIES,
  type SoftwareAnalogy,
} from './analogiesData.ts';

function BlueprintSvgIcon({
  type,
  color,
  size = 42,
}: {
  type: AnalogyVisualScene['blueprintIcon'];
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="44" height="44" rx="10" fill="#050811" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      {type === 'bakery' && (
        <>
          <path d="M12 32H36V36H12V32Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.8" />
          <path d="M14 32C14 23 34 23 34 32" stroke={color} strokeWidth="1.8" />
          <path d="M19 19C19 16 21 15 21 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M24 19C24 16 26 15 26 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M29 19C29 16 31 15 31 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {type === 'waiter' && (
        <>
          <circle cx="24" cy="15" r="5" stroke={color} strokeWidth="1.8" />
          <path d="M15 36C15 29 33 29 33 36" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M11 24H25" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M13 24C13 20 23 20 23 24" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" />
        </>
      )}
      {type === 'highway' && (
        <>
          <path d="M16 10L10 38" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M32 10L38 38" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M24 12V18M24 22V28M24 32V37" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <rect x="17" y="19" width="14" height="8" rx="2" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" />
        </>
      )}
      {type === 'shield' && (
        <>
          <path
            d="M24 10L35 14V23C35 30.5 30 35.8 24 38C18 35.8 13 30.5 13 23V14L24 10Z"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="1.8"
          />
          <path d="M20 24L23 27L29 20" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {type === 'vault' && (
        <>
          <rect x="11" y="12" width="26" height="24" rx="3" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.8" />
          <circle cx="24" cy="24" r="6" stroke={color} strokeWidth="1.8" />
          <circle cx="24" cy="24" r="2" fill={color} />
          <path d="M24 18V15M24 33V30M18 24H15M33 24H30" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {type === 'factory' && (
        <>
          <path
            d="M10 36V22L18 26V20L26 26V14H36V36H10Z"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <rect x="15" y="30" width="4" height="6" fill={color} />
          <rect x="23" y="30" width="4" height="6" fill={color} />
          <rect x="30" y="22" width="3" height="4" fill={color} />
        </>
      )}
      {type === 'ship' && (
        <>
          <rect x="13" y="18" width="10" height="7" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" />
          <rect x="24" y="18" width="10" height="7" fill={color} fillOpacity="0.4" stroke={color} strokeWidth="1.5" />
          <rect x="18" y="11" width="11" height="7" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
          <path d="M9 26H39L35 35H13L9 26Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.8" />
        </>
      )}
      {type === 'brain' && (
        <>
          <circle cx="18" cy="18" r="3" fill={color} />
          <circle cx="30" cy="18" r="3" fill={color} />
          <circle cx="24" cy="29" r="3" fill={color} />
          <circle cx="14" cy="29" r="2.5" stroke={color} strokeWidth="1.6" />
          <circle cx="34" cy="29" r="2.5" stroke={color} strokeWidth="1.6" />
          <path d="M18 18L30 18L24 29L18 18Z" stroke={color} strokeWidth="1.5" />
          <path d="M18 18L14 29M30 18L34 29" stroke={color} strokeWidth="1.4" />
        </>
      )}
      {type === 'switchboard' && (
        <>
          <rect x="11" y="13" width="26" height="22" rx="3" stroke={color} strokeWidth="1.8" />
          <circle cx="17" cy="20" r="2.5" fill={color} />
          <circle cx="24" cy="20" r="2.5" stroke={color} strokeWidth="1.5" />
          <circle cx="31" cy="20" r="2.5" fill={color} />
          <path d="M16 29H32" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="27" cy="29" r="3" fill="#050811" stroke={color} strokeWidth="1.8" />
        </>
      )}
      {type === 'library' && (
        <>
          <rect x="12" y="13" width="6" height="22" rx="1" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" />
          <rect x="19" y="13" width="6" height="22" rx="1" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.6" />
          <path d="M27 14L33 13L36 34L30 35L27 14Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.6" />
        </>
      )}
      {type === 'building' && (
        <>
          <rect x="13" y="10" width="22" height="28" rx="2" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.8" />
          <rect x="17" y="15" width="4" height="4" fill={color} />
          <rect x="27" y="15" width="4" height="4" fill={color} />
          <rect x="17" y="23" width="4" height="4" fill={color} />
          <rect x="27" y="23" width="4" height="4" fill={color} />
          <rect x="21" y="31" width="6" height="7" fill={color} />
        </>
      )}
      {type === 'lock' && (
        <>
          <rect x="13" y="22" width="22" height="15" rx="3" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.8" />
          <path d="M17 22V16C17 12.5 31 12.5 31 16V22" stroke={color} strokeWidth="1.8" />
          <circle cx="24" cy="29" r="2.2" fill={color} />
        </>
      )}
    </svg>
  );
}

function VisualConceptDiagram({
  item,
  color,
  compact = false,
}: {
  item: SoftwareAnalogy;
  color: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background: '#050811',
        border: `1px solid ${compact ? '#1e293b' : color}`,
        borderRadius: '10px',
        padding: compact ? '0.65rem' : '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '0.55rem' : '0.85rem',
      }}
    >
      {/* Visual 3-Part Moving Flow Scene */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#0b0f19',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: compact ? '0.55rem' : '0.85rem',
        }}
      >
        {/* Left Real-World Actor */}
        <div
          style={{
            background: '#0f172a',
            border: `1px solid ${color}`,
            borderRadius: '8px',
            padding: compact ? '0.45rem 0.55rem' : '0.65rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.15rem',
          }}
        >
          <span style={{ fontSize: compact ? '0.73rem' : '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
            {item.scene.leftLabel}
          </span>
          <span style={{ fontSize: compact ? '0.66rem' : '0.74rem', color: '#94a3b8' }}>
            {item.scene.leftSub}
          </span>
        </div>

        {/* Center Animated Flow Arrow & Action */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0 0.35rem',
            minWidth: compact ? '110px' : '170px',
          }}
        >
          <span
            style={{
              fontSize: compact ? '0.64rem' : '0.72rem',
              fontWeight: 700,
              color,
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.9)',
              border: `1px solid ${color}`,
              borderRadius: '999px',
              padding: '0.15rem 0.55rem',
            }}
          >
            {item.scene.actionLabel}
          </span>
          <svg width="100%" height="18" viewBox="0 0 140 18" fill="none" aria-hidden="true">
            <line x1="4" y1="9" x2="128" y2="9" stroke={color} strokeWidth="2" strokeDasharray="5 4" />
            <polygon points="126,4 136,9 126,14" fill={color} />
            <circle cx="68" cy="9" r="3.5" fill={color} />
          </svg>
        </div>

        {/* Right Real-World Building / Destination */}
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: compact ? '0.45rem 0.55rem' : '0.65rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.15rem',
            textAlign: 'right',
          }}
        >
          <span style={{ fontSize: compact ? '0.73rem' : '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
            {item.scene.rightLabel}
          </span>
          <span style={{ fontSize: compact ? '0.66rem' : '0.74rem', color: '#94a3b8' }}>
            {item.scene.rightSub}
          </span>
        </div>
      </div>

      {/* Contrast Boxes: Without It vs With It */}
      {!compact && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem' }}>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.07)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '8px',
              padding: '0.65rem 0.8rem',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
              Sin esto en la vida real (El Problema)
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              {item.scene.withoutIt}
            </p>
          </div>

          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '8px',
              padding: '0.65rem 0.8rem',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
              Con esto en acción (La Solución)
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              {item.scene.withIt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalogyStudio() {
  const [viewMode, setViewMode] = useState<'city-overview' | 'journeys' | 'atlas'>('city-overview');
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | 'all'>('all');
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>(CITY_ARCHETYPES[0]!.id);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(CITY_JOURNEYS[0]!.id);
  const [journeyStepIdx, setJourneyStepIdx] = useState<number>(0);
  const [isJourneyPlaying, setIsJourneyPlaying] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnalogyId, setSelectedAnalogyId] = useState<string>('webhook');

  const activeArchetype =
    CITY_ARCHETYPES.find((a) => a.id === selectedArchetypeId) ?? CITY_ARCHETYPES[0]!;
  const activeJourney =
    CITY_JOURNEYS.find((j) => j.id === selectedJourneyId) ?? CITY_JOURNEYS[0]!;
  const activeJourneyStep =
    activeJourney.steps[journeyStepIdx] ?? activeJourney.steps[0]!;
  const activeAnalogy =
    SOFTWARE_ANALOGIES.find((a) => a.id === selectedAnalogyId) ?? SOFTWARE_ANALOGIES[0]!;
  const activeAnalogyDistrict =
    CITY_DISTRICTS.find((d) => d.id === activeAnalogy.district) ?? CITY_DISTRICTS[0]!;

  useEffect(() => {
    setJourneyStepIdx(0);
    setIsJourneyPlaying(false);
  }, [selectedJourneyId]);

  useEffect(() => {
    if (!isJourneyPlaying) return;
    const timer = setInterval(() => {
      setJourneyStepIdx((prev) => {
        if (prev >= activeJourney.steps.length - 1) {
          setIsJourneyPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2400);
    return () => clearInterval(timer);
  }, [isJourneyPlaying, activeJourney.steps.length]);

  const filteredAnalogies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SOFTWARE_ANALOGIES.filter((item) => {
      const matchesDistrict = selectedDistrict === 'all' || item.district === selectedDistrict;
      if (!matchesDistrict) return false;
      if (!q) return true;
      return (
        item.term.toLowerCase().includes(q) ||
        item.analogy.toLowerCase().includes(q) ||
        item.buildingName.toLowerCase().includes(q) ||
        item.technicalRole.toLowerCase().includes(q)
      );
    });
  }, [selectedDistrict, searchQuery]);

  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = { all: SOFTWARE_ANALOGIES.length };
    for (const d of CITY_DISTRICTS) {
      counts[d.id] = SOFTWARE_ANALOGIES.filter((a) => a.district === d.id).length;
    }
    return counts;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Hero Banner: La Metrópolis del Software */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0b0f19 0%, #111c38 55%, #071b2e 100%)',
          border: '1px solid #1e293b',
          borderRadius: '14px',
          padding: '1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0.18rem 0.55rem',
                  borderRadius: '999px',
                  background: '#082f49',
                  border: '1px solid #0284c7',
                  color: '#38bdf8',
                }}
              >
                Metáfora Visual Completa
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {SOFTWARE_ANALOGIES.length} conceptos conectados como una ciudad real
              </span>
            </div>
            <h2 style={{ margin: '0.4rem 0 0', fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
              La Ciudad del Software: Casas, Edificios, Barrios, Fábricas y Autopistas
            </h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.86rem', color: '#cbd5e1', maxWidth: '880px', lineHeight: 1.5 }}>
              Imaginá todo el mundo del software como una ciudad viva: tu celular es tu casa, un programa chico es un edificio todo-en-uno, un sistema grande es un barrio de locales conectados por mozos y camiones blindados, y los servidores en la nube son la red eléctrica municipal.
            </p>
          </div>

          {/* 3 Main Sub-View Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <button
              type="button"
              onClick={() => setViewMode('city-overview')}
              style={{
                background: viewMode === 'city-overview' ? '#0284c7' : '#0b0f19',
                border: `1px solid ${viewMode === 'city-overview' ? '#38bdf8' : '#334155'}`,
                color: viewMode === 'city-overview' ? '#ffffff' : '#cbd5e1',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              1. Plano de la Ciudad (Casas, Edificios y Fábricas)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('journeys')}
              style={{
                background: viewMode === 'journeys' ? '#059669' : '#0b0f19',
                border: `1px solid ${viewMode === 'journeys' ? '#34d399' : '#334155'}`,
                color: viewMode === 'journeys' ? '#ffffff' : '#cbd5e1',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              2. Recorridos en Movimiento (4 Historias)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('atlas')}
              style={{
                background: viewMode === 'atlas' ? '#7c3aed' : '#0b0f19',
                border: `1px solid ${viewMode === 'atlas' ? '#a78bfa' : '#334155'}`,
                color: viewMode === 'atlas' ? '#ffffff' : '#cbd5e1',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              3. Atlas Visual ({SOFTWARE_ANALOGIES.length} Analogías Ilustradas)
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          VIEW MODE 1: CITY BLUEPRINT & BUILDING ARCHETYPES
      ===================================================================== */}
      {viewMode === 'city-overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Interactive Question Answerer: ¿Cada software es una casa, edificio o fábrica? */}
          <div
            style={{
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                La Gran Escala Urbana
              </span>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                ¿Cada software es una casa, un departamento, un edificio o una fábrica?
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.83rem', color: '#94a3b8' }}>
                Hacé clic en cada estructura para ver cómo se organiza por dentro y cómo se comunica con los demás edificios:
              </p>
            </div>

            {/* 5 Archetype Selector Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.55rem' }}>
              {CITY_ARCHETYPES.map((arch) => {
                const isSelected = arch.id === activeArchetype.id;
                return (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => setSelectedArchetypeId(arch.id)}
                    style={{
                      background: isSelected ? '#0f172a' : '#0b0f19',
                      border: `1.5px solid ${isSelected ? arch.color : '#1e293b'}`,
                      boxShadow: isSelected ? `0 0 14px ${arch.color}33` : 'none',
                      borderRadius: '10px',
                      padding: '0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? arch.color : '#f8fafc' }}>
                      {arch.title}
                    </span>
                    <span style={{ fontSize: '0.71rem', color: '#94a3b8', lineHeight: 1.35 }}>
                      {arch.softwareEquivalent}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Archetype Blueprint Visualizer */}
            <div
              style={{
                background: '#0b0f19',
                border: `1px solid ${activeArchetype.color}`,
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: activeArchetype.color, textTransform: 'uppercase' }}>
                  Metáfora del Mundo Real: {activeArchetype.realWorldMetaphor}
                </div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {activeArchetype.title}
                </h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  {activeArchetype.summary}
                </p>
                <div
                  style={{
                    background: '#050811',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                    color: '#cbd5e1',
                  }}
                >
                  <strong style={{ color: activeArchetype.color }}>Cómo se comunica con otros edificios: </strong>
                  {activeArchetype.howTheyCommunicate}
                </div>
              </div>

              {/* Blueprint Diagram of the 3 Internal Nodes + Pros/Risk */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    background: '#050811',
                    border: '1px solid #1e293b',
                    borderRadius: '10px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Corte Transversal del Edificio (Plano Interno)
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {activeArchetype.diagramNodes.map((node, i) => (
                      <div
                        key={node.label}
                        style={{
                          background: '#0f172a',
                          border: `1px solid ${activeArchetype.color}`,
                          borderRadius: '8px',
                          padding: '0.6rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                        }}
                      >
                        <span style={{ fontSize: '0.66rem', color: activeArchetype.color, fontWeight: 700 }}>
                          SECTOR {i + 1}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
                          {node.label}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#cbd5e1', lineHeight: 1.3 }}>
                          {node.role}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace', marginTop: 'auto' }}>
                          {node.sub}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '0.6rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#34d399' }}>VENTAJA PRINCIPAL</div>
                    <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{activeArchetype.pros}</div>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.6rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171' }}>PELIGRO A CUIDAR</div>
                    <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{activeArchetype.risk}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive SVG Master Map of the 6 Districts of Software City */}
          <div
            style={{
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  Mapa Interactivo de los 6 Distritos de la Ciudad del Software
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Hacé clic en cualquier distrito del plano para explorar sus edificios y sus analogías ilustradas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('atlas')}
                style={{
                  background: '#1e293b',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Abrir Atlas Completo ({SOFTWARE_ANALOGIES.length} Conceptos) &rarr;
              </button>
            </div>

            {/* SVG Metropolis Map */}
            <div
              style={{
                background: '#070c18',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '0.75rem',
                overflowX: 'auto',
              }}
            >
              <svg
                viewBox="0 0 960 400"
                style={{ width: '100%', minWidth: '680px', height: 'auto', display: 'block' }}
                role="img"
                aria-label="Mapa de los 6 Distritos de la Ciudad del Software"
              >
                {/* Background Grid */}
                <defs>
                  <pattern id="cityGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.6" />
                  </pattern>
                </defs>
                <rect width="960" height="400" fill="url(#cityGrid)" rx="10" />

                {/* Highway Roads Connecting Districts */}
                <line x1="310" y1="105" x2="340" y2="105" stroke="#38bdf8" strokeWidth="4" strokeDasharray="6 4" />
                <line x1="620" y1="105" x2="650" y2="105" stroke="#34d399" strokeWidth="4" strokeDasharray="6 4" />
                <line x1="310" y1="290" x2="340" y2="290" stroke="#fbbf24" strokeWidth="4" strokeDasharray="6 4" />
                <line x1="620" y1="290" x2="650" y2="290" stroke="#f87171" strokeWidth="4" strokeDasharray="6 4" />
                <line x1="170" y1="185" x2="170" y2="215" stroke="#38bdf8" strokeWidth="4" strokeDasharray="6 4" />
                <line x1="480" y1="185" x2="480" y2="215" stroke="#34d399" strokeWidth="4" strokeDasharray="6 4" />
                <line x1="790" y1="185" x2="790" y2="215" stroke="#a78bfa" strokeWidth="4" strokeDasharray="6 4" />

                {/* Central Ring Avenue Label */}
                <rect x="375" y="188" width="210" height="24" rx="12" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
                <text x="480" y="204" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
                  AUTOPISTA CENTRAL HTTPS / MCP
                </text>

                {/* Render 6 Clickable District Blocks */}
                {CITY_DISTRICTS.map((dist) => {
                  const { x, y, w, h } = dist.mapCoords;
                  const count = districtCounts[dist.id] ?? 0;
                  return (
                    <g
                      key={dist.id}
                      onClick={() => {
                        setSelectedDistrict(dist.id);
                        setViewMode('atlas');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx="12"
                        fill="#0b0f19"
                        stroke={dist.color}
                        strokeWidth="2"
                      />
                      <rect
                        x={x + 10}
                        y={y + 10}
                        width={w - 20}
                        height="24"
                        rx="6"
                        fill={dist.bgAccent}
                      />
                      <text x={x + 20} y={y + 26} fill={dist.color} fontSize="11" fontWeight="700">
                        {dist.cityZone}
                      </text>
                      <text x={x + 16} y={y + 56} fill="#f8fafc" fontSize="13.5" fontWeight="700">
                        {dist.name}
                      </text>
                      {/* Mini Building Skyline inside each District */}
                      <rect x={x + 18} y={y + 74} width="34" height="44" rx="3" fill={dist.bgAccent} stroke={dist.color} strokeWidth="1.2" />
                      <rect x={x + 58} y={y + 84} width="42" height="34" rx="3" fill={dist.bgAccent} stroke={dist.color} strokeWidth="1.2" />
                      <rect x={x + 106} y={y + 70} width="38" height="48" rx="3" fill={dist.bgAccent} stroke={dist.color} strokeWidth="1.2" />

                      <rect x={x + 158} y={y + 84} width="104" height="32" rx="6" fill="#0f172a" stroke={dist.color} strokeWidth="1" />
                      <text x={x + 210} y={y + 104} textAnchor="middle" fill={dist.color} fontSize="11.5" fontWeight="700">
                        Ver {count} edificios &rarr;
                      </text>
                      <text x={x + 16} y={y + 140} fill="#94a3b8" fontSize="10.5">
                        Click para inspeccionar analogías
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW MODE 2: ANIMATED MOVING JOURNEYS ACROSS THE CITY
      ===================================================================== */}
      {viewMode === 'journeys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Journey Selector Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
            {CITY_JOURNEYS.map((j) => {
              const isSelected = j.id === activeJourney.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedJourneyId(j.id)}
                  style={{
                    background: isSelected ? '#0f172a' : '#050811',
                    border: `1.5px solid ${isSelected ? '#34d399' : '#1e293b'}`,
                    borderRadius: '10px',
                    padding: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <span style={{ fontSize: '0.83rem', fontWeight: 700, color: isSelected ? '#34d399' : '#f8fafc' }}>
                    {j.title}
                  </span>
                  <span style={{ fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.35 }}>
                    {j.subtitle}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Interactive Journey Stage & Playback Controls */}
          <div
            style={{
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  {activeJourney.title}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  {activeJourney.subtitle}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={journeyStepIdx === 0}
                  onClick={() => setJourneyStepIdx((p) => Math.max(0, p - 1))}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: journeyStepIdx === 0 ? '#475569' : '#f8fafc',
                    borderRadius: '6px',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: journeyStepIdx === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  &larr; Parada Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setIsJourneyPlaying((p) => !p)}
                  style={{
                    background: isJourneyPlaying ? '#854d0e' : '#059669',
                    border: `1px solid ${isJourneyPlaying ? '#eab308' : '#34d399'}`,
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.4rem 0.95rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isJourneyPlaying ? 'Pausar Recorrido' : 'Reproducir Recorrido Animado'}
                </button>
                <button
                  type="button"
                  disabled={journeyStepIdx === activeJourney.steps.length - 1}
                  onClick={() => setJourneyStepIdx((p) => Math.min(activeJourney.steps.length - 1, p + 1))}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: journeyStepIdx === activeJourney.steps.length - 1 ? '#475569' : '#f8fafc',
                    borderRadius: '6px',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: journeyStepIdx === activeJourney.steps.length - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Siguiente Parada &rarr;
                </button>
              </div>
            </div>

            {/* Visual Timeline Highway with Moving Vehicle Indicator */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${activeJourney.steps.length}, minmax(135px, 1fr))`,
                gap: '0.5rem',
                overflowX: 'auto',
                paddingBottom: '0.25rem',
              }}
            >
              {activeJourney.steps.map((st, idx) => {
                const isCurrent = idx === journeyStepIdx;
                const isPassed = idx < journeyStepIdx;
                return (
                  <button
                    key={st.stepNumber}
                    type="button"
                    onClick={() => {
                      setIsJourneyPlaying(false);
                      setJourneyStepIdx(idx);
                    }}
                    style={{
                      background: isCurrent ? '#0f172a' : '#0b0f19',
                      border: `2px solid ${isCurrent ? st.color : isPassed ? '#10b981' : '#1e293b'}`,
                      boxShadow: isCurrent ? `0 0 15px ${st.color}44` : 'none',
                      borderRadius: '10px',
                      padding: '0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isCurrent ? st.color : isPassed ? '#34d399' : '#64748b' }}>
                        PARADA {st.stepNumber}
                      </span>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: isCurrent ? st.color : isPassed ? '#10b981' : '#334155',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                      {st.building}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: st.color, fontWeight: 600 }}>
                      {st.concept}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Stop Side-by-Side Comparison: Mundo Real vs Software */}
            <div
              style={{
                background: '#0b0f19',
                border: `1.5px solid ${activeJourneyStep.color}`,
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  background: '#050811',
                  border: '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: activeJourneyStep.color, textTransform: 'uppercase' }}>
                  En la Ciudad Real (La Analogía) — {activeJourneyStep.building}
                </span>
                <p style={{ margin: 0, fontSize: '0.92rem', color: '#f8fafc', lineHeight: 1.55, fontWeight: 500 }}>
                  {activeJourneyStep.realWorldAction}
                </p>
              </div>

              <div
                style={{
                  background: '#050811',
                  border: '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                  Lo que ocurre en el Software — {activeJourneyStep.concept}
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                  {activeJourneyStep.softwareAction}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW MODE 3: COMPLETE VISUAL ATLAS OF ALL 100 ANALOGIES
      ===================================================================== */}
      {viewMode === 'atlas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Featured Interactive Visual Stage (Selected Concept Spotlight) */}
          <div
            style={{
              background: '#0b0f19',
              border: `1.5px solid ${activeAnalogyDistrict.color}`,
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <BlueprintSvgIcon type={activeAnalogy.scene.blueprintIcon} color={activeAnalogyDistrict.color} size={52} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: activeAnalogyDistrict.bgAccent,
                        color: activeAnalogyDistrict.color,
                      }}
                    >
                      {activeAnalogyDistrict.name}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      Edificio en la Ciudad: <strong style={{ color: '#e2e8f0' }}>{activeAnalogy.buildingName}</strong>
                    </span>
                  </div>
                  <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
                    {activeAnalogy.term}
                  </h3>
                </div>
              </div>
              <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                Escenario Visual Activo (Tocá cualquier tarjeta abajo para cambiar)
              </span>
            </div>

            {/* Main Analogy Quote + Technical Equivalent */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              <div
                style={{
                  background: '#050811',
                  borderLeft: `4px solid ${activeAnalogyDistrict.color}`,
                  borderRadius: '8px',
                  padding: '0.9rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: activeAnalogyDistrict.color, textTransform: 'uppercase' }}>
                  Analogía de la Vida Real
                </div>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.5 }}>
                  {activeAnalogy.analogy}
                </p>
              </div>

              <div
                style={{
                  background: '#050811',
                  borderLeft: '4px solid #38bdf8',
                  borderRadius: '8px',
                  padding: '0.9rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                  Qué hace realmente en el Software
                </div>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {activeAnalogy.technicalRole}
                </p>
              </div>
            </div>

            {/* Full Visual Flow Diagram & Before/After Comparison */}
            <VisualConceptDiagram item={activeAnalogy} color={activeAnalogyDistrict.color} compact={false} />
          </div>

          {/* Search & District Filter Bar */}
          <div
            style={{
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar concepto o analogía (ej. panadería, mozo, valija, pulsera, webhook, RAG, Docker)..."
                style={{
                  flex: 1,
                  minWidth: '260px',
                  background: '#0b0f19',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.55rem 0.9rem',
                  fontSize: '0.84rem',
                  color: '#f8fafc',
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Mostrando <strong style={{ color: '#f8fafc' }}>{filteredAnalogies.length}</strong> de {SOFTWARE_ANALOGIES.length} conceptos
              </span>
            </div>

            {/* District Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              <button
                type="button"
                onClick={() => setSelectedDistrict('all')}
                style={{
                  background: selectedDistrict === 'all' ? '#1e293b' : '#0b0f19',
                  border: `1px solid ${selectedDistrict === 'all' ? '#38bdf8' : '#334155'}`,
                  color: selectedDistrict === 'all' ? '#f8fafc' : '#94a3b8',
                  borderRadius: '999px',
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Toda la Ciudad ({districtCounts.all})
              </button>
              {CITY_DISTRICTS.map((d) => {
                const active = selectedDistrict === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDistrict(d.id)}
                    style={{
                      background: active ? d.bgAccent : '#0b0f19',
                      border: `1px solid ${active ? d.color : '#334155'}`,
                      color: active ? d.color : '#94a3b8',
                      borderRadius: '999px',
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {d.name} ({districtCounts[d.id]})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid of Visual Concept Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
              gap: '0.9rem',
            }}
          >
            {filteredAnalogies.map((item) => {
              const dist = CITY_DISTRICTS.find((d) => d.id === item.district) ?? CITY_DISTRICTS[0]!;
              const isSelected = item.id === activeAnalogy.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedAnalogyId(item.id)}
                  style={{
                    background: isSelected ? '#0f172a' : '#0b0f19',
                    border: `1.5px solid ${isSelected ? dist.color : '#1e293b'}`,
                    boxShadow: isSelected ? `0 0 16px ${dist.color}30` : 'none',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.7rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Card Header: Icon + Term + Building */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
                    <BlueprintSvgIcon type={item.scene.blueprintIcon} color={dist.color} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                          {item.term}
                        </span>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            background: dist.bgAccent,
                            color: dist.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.buildingName}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{dist.name}</span>
                    </div>
                  </div>

                  {/* Analogy Text */}
                  <p style={{ margin: 0, fontSize: '0.83rem', color: '#e2e8f0', lineHeight: 1.5, fontWeight: 500 }}>
                    {item.analogy}
                  </p>

                  {/* Mini Visual Flow Diagram inside every card */}
                  <VisualConceptDiagram item={item} color={dist.color} compact={true} />

                  {/* Technical Subtitle */}
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    <strong style={{ color: dist.color }}>En código: </strong>
                    {item.technicalRole}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
