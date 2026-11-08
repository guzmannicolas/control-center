import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ArgentinePromo, ArgentinePromoCategory, PaymentMethod, PromotionsOverview } from '@cc/shared';
import { api } from '../api.ts';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function PromocionesPage() {
  const queryClient = useQueryClient();
  const [selectedDayFilter, setSelectedDayFilter] = useState<'today' | 'all' | number>('today');
  const [selectedCategory, setSelectedCategory] = useState<ArgentinePromoCategory | 'all'>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: overview, isLoading, error, isFetching } = useQuery<PromotionsOverview>({
    queryKey: ['promotions'],
    queryFn: () => api.promotions(),
  });

  const scrapeMutation = useMutation({
    mutationFn: () => api.scrapePromotions(),
    onSuccess: (data) => {
      queryClient.setQueryData(['promotions'], data);
    },
  });

  const todayIndex = overview?.todayDayIndex ?? new Date().getDay();
  const todayName = overview?.todayDayName ?? DAY_LABELS[todayIndex];

  const copyPromoText = (promo: ArgentinePromo) => {
    const text = `🎉 *${promo.title}*\n🏷️ Descuento: ${promo.discount}\n🏦 Entidad: ${promo.entity}\n🛒 Comercios: ${promo.applicableBusinesses.join(', ')}\n💰 Tope: ${promo.cashbackCap || 'Sin tope especificado'}\n📅 Días: ${promo.daysOfWeek.length === 0 ? 'Todos los días' : promo.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')}\nℹ️ ${promo.description}`;
    void navigator.clipboard.writeText(text);
    setCopiedId(promo.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filter promotions
  const filteredPromos = (overview?.promotions ?? []).filter((promo) => {
    // Day filter
    if (selectedDayFilter === 'today') {
      if (!promo.isTodayActive) return false;
    } else if (typeof selectedDayFilter === 'number') {
      if (promo.daysOfWeek.length > 0 && !promo.daysOfWeek.includes(selectedDayFilter)) {
        return false;
      }
    }

    // Category filter
    if (selectedCategory !== 'all' && promo.category !== selectedCategory) {
      return false;
    }

    // Entity filter
    if (selectedEntity !== 'all' && promo.entity.toLowerCase() !== selectedEntity.toLowerCase()) {
      return false;
    }

    // Payment method filter
    if (selectedPayment !== 'all' && promo.paymentMethod !== selectedPayment && promo.paymentMethod !== 'any') {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = promo.title.toLowerCase().includes(q);
      const matchEntity = promo.entity.toLowerCase().includes(q);
      const matchDesc = promo.description.toLowerCase().includes(q);
      const matchStores = promo.applicableBusinesses.some((b) => b.toLowerCase().includes(q));
      const matchDiscount = promo.discount.toLowerCase().includes(q);
      if (!matchTitle && !matchEntity && !matchDesc && !matchStores && !matchDiscount) {
        return false;
      }
    }

    return true;
  });

  const getCategoryIcon = (cat: ArgentinePromoCategory) => {
    switch (cat) {
      case 'supermarkets':
        return '🛒';
      case 'fuel':
        return '⛽';
      case 'gastronomy':
        return '🍔';
      case 'pharmacy':
        return '💊';
      case 'clothing':
        return '👗';
      case 'technology':
        return '💻';
      case 'entertainment':
        return '🎬';
      case 'services':
        return '⚡';
      default:
        return '🏷️';
    }
  };

  const getPaymentLabel = (m: PaymentMethod) => {
    switch (m) {
      case 'qr':
        return 'QR en Línea de Cajas';
      case 'credit':
        return 'Tarjeta de Crédito';
      case 'debit':
        return 'Tarjeta de Débito';
      case 'wallet_balance':
        return 'Dinero en Cuenta';
      default:
        return 'Cualquier medio de pago';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="card p-5 sm:p-6 border border-line bg-gradient-to-r from-card to-subtle/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              <span className="emoji-bw">🇦🇷</span> Promociones & Descuentos del Día
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-series/20 text-series border border-series/30">
              Argentina Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 max-w-2xl leading-relaxed">
            Scraping automático de beneficios bancarios, billeteras virtuales (Cuenta DNI, MODO, Mercado Pago, BNA+) y descuentos en supermercados y combustibles en Argentina.
          </p>
          <div className="flex items-center gap-3 pt-1 text-[11px] text-muted">
            <span>📅 {overview?.todayDateFormatted || 'Hoy'} ({todayName})</span>
            <span>•</span>
            <span>
              Último scraping:{' '}
              {overview?.lastScrapedAt
                ? new Date(overview.lastScrapedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                : 'Reciente'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={scrapeMutation.isPending || isFetching}
            onClick={() => scrapeMutation.mutate()}
            className="btn btn-primary text-xs px-3.5 py-2 flex items-center gap-2 shadow-sm"
          >
            <span className={`emoji-bw ${scrapeMutation.isPending ? 'animate-spin' : ''}`}>🔄</span>
            <span>{scrapeMutation.isPending ? 'Scrapeando el día...' : 'Actualizar Promos de Hoy'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Activas Hoy ({todayName})</span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-400 mt-0.5 block">
            {overview?.activeTodayCount ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">Disponibles para aprovechar hoy</span>
        </div>

        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Total Beneficios</span>
          <span className="text-xl sm:text-2xl font-bold text-ink mt-0.5 block">
            {overview?.totalPromos ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">En el radar semanal</span>
        </div>

        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Bancos & Billeteras</span>
          <span className="text-xl sm:text-2xl font-bold text-series mt-0.5 block">
            {overview?.topEntities.length ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">Cuenta DNI, MODO, MP y bancos</span>
        </div>

        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Mayor Descuento</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-400 mt-0.5 block">
            Hasta 40% OFF
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">En carnes y ferias locales</span>
        </div>
      </div>

      {/* Filters Section */}
      <div className="card p-4 border border-line bg-card/80 space-y-3.5">
        {/* Search Bar + Entity & Payment Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar comercio, banco, producto (ej. Coto, YPF, Axion, Carnicerías, 35%)..."
              className="input w-full text-xs py-1.5"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="input w-full text-xs py-1.5"
            >
              <option value="all">Todos los bancos y billeteras</option>
              {overview?.topEntities.map((ent) => (
                <option key={ent.name} value={ent.name}>
                  {ent.name} ({ent.count})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value as PaymentMethod | 'all')}
              className="input w-full text-xs py-1.5"
            >
              <option value="all">Cualquier medio de pago</option>
              <option value="qr">Pago con QR (MODO / Cuenta DNI / MP)</option>
              <option value="credit">Tarjeta de Crédito</option>
              <option value="debit">Tarjeta de Débito</option>
              <option value="wallet_balance">Dinero en Cuenta</option>
            </select>
          </div>
        </div>

        {/* Day Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 text-xs">
          <span className="text-muted text-[11px] mr-1 flex-shrink-0 font-medium">Día:</span>
          <button
            type="button"
            onClick={() => setSelectedDayFilter('today')}
            className={`px-2.5 py-1 rounded-md transition flex-shrink-0 font-medium ${
              selectedDayFilter === 'today'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-ink-2 hover:bg-subtle hover:text-ink'
            }`}
          >
            ● Solo Hoy ({todayName})
          </button>
          <button
            type="button"
            onClick={() => setSelectedDayFilter('all')}
            className={`px-2.5 py-1 rounded-md transition flex-shrink-0 ${
              selectedDayFilter === 'all'
                ? 'bg-series text-white font-medium'
                : 'text-ink-2 hover:bg-subtle hover:text-ink'
            }`}
          >
            Toda la Semana
          </button>
          {DAY_LABELS.map((d, idx) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDayFilter(idx)}
              className={`px-2.5 py-1 rounded-md transition flex-shrink-0 ${
                selectedDayFilter === idx
                  ? 'bg-series text-white font-medium'
                  : 'text-ink-2 hover:bg-subtle hover:text-ink'
              }`}
            >
              {d.slice(0, 3)}
              {idx === todayIndex && <span className="ml-1 text-[9px] opacity-80">(Hoy)</span>}
            </button>
          ))}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 text-xs">
          <span className="text-muted text-[11px] mr-1 flex-shrink-0 font-medium">Rubro:</span>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-md transition flex-shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-ink text-page font-medium'
                : 'text-ink-2 hover:bg-subtle hover:text-ink'
            }`}
          >
            Todos ({overview?.promotions.length ?? 0})
          </button>
          {overview?.categories
            .filter((c) => c.count > 0)
            .map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md transition flex-shrink-0 flex items-center gap-1 ${
                  selectedCategory === cat.id
                    ? 'bg-ink text-page font-medium'
                    : 'text-ink-2 hover:bg-subtle hover:text-ink'
                }`}
              >
                <span className="emoji-bw">{getCategoryIcon(cat.id)}</span>
                <span>{cat.label.split(' ')[0]}</span>
                <span className="text-[10px] opacity-70">({cat.count})</span>
              </button>
            ))}
        </div>
      </div>

      {/* Promotions Cards Grid */}
      {isLoading ? (
        <div className="card p-12 text-center text-sm text-ink-2">
          <div className="emoji-bw text-2xl animate-spin mb-2">🔄</div>
          Cargando promociones del día...
        </div>
      ) : error ? (
        <div className="card p-6 border-danger/40 text-danger text-sm">
          Error al cargar promociones: {(error as any).message || 'Error desconocido'}
        </div>
      ) : filteredPromos.length === 0 ? (
        <div className="card p-12 text-center space-y-2 border border-line">
          <div className="emoji-bw text-3xl">🔍</div>
          <p className="text-sm font-semibold text-ink">No se encontraron promociones con estos filtros</p>
          <p className="text-xs text-ink-2 max-w-sm mx-auto">
            Prueba seleccionando "Toda la Semana" o limpiando el campo de búsqueda para ver más ofertas.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedDayFilter('all');
              setSelectedCategory('all');
              setSelectedEntity('all');
              setSelectedPayment('all');
              setSearchQuery('');
            }}
            className="btn btn-secondary text-xs px-3 py-1.5 mt-2 inline-flex items-center gap-1"
          >
            Restablecer Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPromos.map((promo) => {
            const isCopied = copiedId === promo.id;

            return (
              <div
                key={promo.id}
                className={`card p-4 border rounded-xl flex flex-col justify-between transition hover:shadow-md ${
                  promo.isTodayActive
                    ? 'border-emerald-500/30 bg-card/90 shadow-sm'
                    : 'border-line/70 bg-card/60 opacity-90'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {promo.discount}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-subtle text-ink-2 border border-line">
                        {promo.entity}
                      </span>
                    </div>

                    {promo.isTodayActive ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex-shrink-0 animate-pulse">
                        ● ACTIVA HOY
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-subtle text-muted flex-shrink-0">
                        {promo.daysOfWeek.map((d) => DAY_LABELS[d]?.slice(0, 3)).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-semibold text-xs text-ink leading-snug">{promo.title}</h3>
                    <p className="text-[11px] text-ink-2 mt-1 leading-relaxed line-clamp-2">
                      {promo.description}
                    </p>
                  </div>

                  {/* Stores tags */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted block font-medium">Válido en:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {promo.applicableBusinesses.slice(0, 3).map((b) => (
                        <span
                          key={b}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-subtle/80 text-ink-2 font-mono border border-line truncate max-w-[140px]"
                        >
                          {b}
                        </span>
                      ))}
                      {promo.applicableBusinesses.length > 3 && (
                        <span className="text-[10px] text-muted font-mono">
                          +{promo.applicableBusinesses.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cashback Cap & Payment Method */}
                  <div className="p-2 rounded-lg bg-page border border-line/60 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Tope de reintegro:</span>
                      <strong className="text-ink font-semibold truncate ml-2">
                        {promo.cashbackCap || 'Sin tope'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Medio de pago:</span>
                      <span className="text-ink-2 truncate ml-2">
                        {getPaymentLabel(promo.paymentMethod)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 mt-3 border-t border-line/60 flex items-center justify-between gap-2">
                  {promo.termsUrl ? (
                    <a
                      href={promo.termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-series hover:underline flex items-center gap-1"
                    >
                      <span className="emoji-bw">🔗</span> Ver términos
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted">Beneficio directo</span>
                  )}

                  <button
                    type="button"
                    onClick={() => copyPromoText(promo)}
                    className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                    title="Copiar detalles de la promoción"
                  >
                    <span className="emoji-bw">{isCopied ? '✓' : '📋'}</span>
                    <span className="text-[11px]">{isCopied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
