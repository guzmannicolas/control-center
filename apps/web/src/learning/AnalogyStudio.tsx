import { useMemo, useState } from 'react';
import {
  CITY_ARCHETYPES,
  CITY_DISTRICTS,
  type DistrictId,
  SOFTWARE_ANALOGIES,
} from './analogiesData.ts';
import {
  IllustratedConceptCartoon,
  SoftwareCityGame,
} from './SoftwareCityGame.tsx';

export function AnalogyStudio() {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | 'all'>('all');
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>(CITY_ARCHETYPES[0]!.id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnalogyId, setSelectedAnalogyId] = useState<string>('webhook');
  const [showArchetypes, setShowArchetypes] = useState<boolean>(true);

  const activeArchetype =
    CITY_ARCHETYPES.find((a) => a.id === selectedArchetypeId) ?? CITY_ARCHETYPES[0]!;
  const activeAnalogy =
    SOFTWARE_ANALOGIES.find((a) => a.id === selectedAnalogyId) ?? SOFTWARE_ANALOGIES[0]!;
  const activeAnalogyDistrict =
    CITY_DISTRICTS.find((d) => d.id === activeAnalogy.district) ?? CITY_DISTRICTS[0]!;

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
      {/* =====================================================================
          1. MAIN 2D INTERACTIVE VIDEO GAME / SIMULATOR CANVAS
      ===================================================================== */}
      <SoftwareCityGame
        onSelectConcept={(id) => {
          setSelectedAnalogyId(id);
        }}
      />

      {/* =====================================================================
          2. ILLUSTRATED ARCHITECTURAL DRAWINGS: CASAS, EDIFICIOS, BARRIOS Y FÁBRICAS
      ===================================================================== */}
      <div
        style={{
          background: '#050811',
          border: '1.5px solid #1e293b',
          borderRadius: '14px',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
              Arquitectura Dibujada
            </span>
            <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
              ¿Cada software es una Casa, un Edificio, un Barrio o una Fábrica?
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowArchetypes((s) => !s)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#cbd5e1',
              borderRadius: '8px',
              padding: '0.35rem 0.8rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {showArchetypes ? 'Ocultar Planos de Edificios' : 'Mostrar Planos de Edificios'}
          </button>
        </div>

        {showArchetypes && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.5rem' }}>
              {CITY_ARCHETYPES.map((arch) => {
                const isSelected = arch.id === activeArchetype.id;
                return (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => setSelectedArchetypeId(arch.id)}
                    style={{
                      background: isSelected ? '#0f172a' : '#0b0f19',
                      border: `2px solid ${isSelected ? arch.color : '#1e293b'}`,
                      borderRadius: '10px',
                      padding: '0.65rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? arch.color : '#f8fafc' }}>
                      {arch.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {arch.softwareEquivalent}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Drawn Cross-Section of the Selected Building Archetype */}
            <div
              style={{
                background: '#0b0f19',
                border: `1.5px solid ${activeArchetype.color}`,
                borderRadius: '12px',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              {/* Illustrated SVG Drawing of the Archetype */}
              <svg
                viewBox="0 0 420 190"
                style={{ width: '100%', height: 'auto', background: '#060c1a', borderRadius: '10px', border: '1px solid #1e293b' }}
              >
                <rect x="0" y="158" width="420" height="32" fill="#0f172a" />
                <line x1="0" y1="158" x2="420" y2="158" stroke={activeArchetype.color} strokeWidth="2.5" />
                {activeArchetype.diagramNodes.map((node, i) => {
                  const bx = 22 + i * 132;
                  return (
                    <g key={node.label} transform={`translate(${bx}, 32)`}>
                      {/* Drawn Roof & Building Box */}
                      <polygon points="0,24 56,2 112,24" fill="#1e293b" stroke={activeArchetype.color} strokeWidth="2" />
                      <rect x="6" y="24" width="100" height="102" rx="5" fill="#0f172a" stroke={activeArchetype.color} strokeWidth="2" />
                      {/* Drawn Windows */}
                      <rect x="18" y="36" width="18" height="16" rx="2" fill="#fde047" />
                      <rect x="76" y="36" width="18" height="16" rx="2" fill="#fde047" />
                      {/* Character inside */}
                      <circle cx="56" cy="52" r="9" fill="#38bdf8" />
                      <path d="M44 74 C44 60 68 60 68 74 Z" fill={activeArchetype.color} />
                      <text x="56" y="92" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800">
                        {node.label.slice(0, 17)}
                      </text>
                      <text x="56" y="106" textAnchor="middle" fill="#94a3b8" fontSize="7.5">
                        {node.sub.slice(0, 19)}
                      </text>
                      {i < 2 && (
                        <g>
                          <line x1="108" y1="72" x2="136" y2="72" stroke={activeArchetype.color} strokeWidth="2.5" strokeDasharray="4 3" />
                          <polygon points="133,67 140,72 133,77" fill={activeArchetype.color} />
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                  {activeArchetype.title}
                </h4>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                  {activeArchetype.summary}
                </p>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', background: '#050811', padding: '0.6rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ color: activeArchetype.color }}>Comunicación: </strong>
                  {activeArchetype.howTheyCommunicate}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.74rem', color: '#a7f3d0' }}>
                    <strong>Ventaja:</strong> {activeArchetype.pros}
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.74rem', color: '#fca5a5' }}>
                    <strong>Riesgo:</strong> {activeArchetype.risk}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* =====================================================================
          3. ILLUSTRATED COMIC STRIP GALLERY (ALL 100 CONCEPTS WITH DRAWINGS)
      ===================================================================== */}
      <div
        style={{
          background: '#050811',
          border: '1.5px solid #1e293b',
          borderRadius: '14px',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Spotlight Active Comic Strip */}
        <div
          style={{
            background: '#0b0f19',
            border: `2px solid ${activeAnalogyDistrict.color}`,
            borderRadius: '12px',
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '0.18rem 0.55rem',
                  borderRadius: '4px',
                  background: activeAnalogyDistrict.bgAccent,
                  color: activeAnalogyDistrict.color,
                }}
              >
                {activeAnalogyDistrict.name}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Lugar: <strong style={{ color: '#f8fafc' }}>{activeAnalogy.buildingName}</strong>
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
              {activeAnalogy.term}
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#fef08a', fontWeight: 600, lineHeight: 1.5 }}>
              &ldquo;{activeAnalogy.analogy}&rdquo;
            </p>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45 }}>
              <strong style={{ color: '#38bdf8' }}>Qué es en el sistema real: </strong>
              {activeAnalogy.technicalRole}
            </p>
          </div>

          <IllustratedConceptCartoon item={activeAnalogy} color={activeAnalogyDistrict.color} />
        </div>

        {/* Search & District Filter Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar historieta (ej. panadería, mozo, patovica, valija, pulsera, loro, webhook, RAG)..."
            style={{
              flex: 1,
              minWidth: '260px',
              background: '#0b0f19',
              border: '1.5px solid #334155',
              borderRadius: '8px',
              padding: '0.55rem 0.9rem',
              fontSize: '0.84rem',
              color: '#f8fafc',
            }}
          />
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Mostrando <strong style={{ color: '#f8fafc' }}>{filteredAnalogies.length}</strong> de {SOFTWARE_ANALOGIES.length} historietas ilustradas
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          <button
            type="button"
            onClick={() => setSelectedDistrict('all')}
            style={{
              background: selectedDistrict === 'all' ? '#0284c7' : '#0b0f19',
              border: `1.5px solid ${selectedDistrict === 'all' ? '#38bdf8' : '#334155'}`,
              color: '#ffffff',
              borderRadius: '999px',
              padding: '0.35rem 0.85rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Todos los Distritos ({districtCounts.all})
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
                  border: `1.5px solid ${active ? d.color : '#334155'}`,
                  color: active ? d.color : '#cbd5e1',
                  borderRadius: '999px',
                  padding: '0.35rem 0.85rem',
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

        {/* Grid of 100 Illustrated Comic Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1rem',
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
                  border: `2px solid ${isSelected ? dist.color : '#1e293b'}`,
                  borderRadius: '14px',
                  padding: '0.95rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.02rem', fontWeight: 800, color: '#f8fafc' }}>
                    {item.term}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      background: dist.bgAccent,
                      color: dist.color,
                    }}
                  >
                    {item.buildingName}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.84rem', color: '#fef9c3', fontWeight: 600, lineHeight: 1.45 }}>
                  {item.analogy}
                </p>

                {/* Every single card has its own interactive 2D cartoon drawing! */}
                <IllustratedConceptCartoon item={item} color={dist.color} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
