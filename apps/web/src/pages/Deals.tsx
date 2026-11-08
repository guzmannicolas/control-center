import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ArgentinePromo,
  ArgentinePromoCategory,
  PaymentMethod,
  PromotionsOverview,
  SavingsCalculationResult,
} from '@cc/shared';
import { api } from '../api.ts';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function RefreshIcon({ spin }: { spin?: boolean }) {
  return (
    <svg
      className={`size-4 ${spin ? 'animate-spin' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      className={`size-4 ${filled ? 'fill-amber-400 text-amber-400' : 'text-muted hover:text-ink'}`}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function DealsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'deals' | 'calculator' | 'schedule'>('deals');
  const [selectedDayFilter, setSelectedDayFilter] = useState<'today' | 'all' | number>('today');
  const [selectedCategory, setSelectedCategory] = useState<ArgentinePromoCategory | 'all'>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cc_favorite_deals');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Savings Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(45000);
  const [calcCategory, setCalcCategory] = useState<ArgentinePromoCategory>('supermarkets');
  const [calcResults, setCalcResults] = useState<SavingsCalculationResult[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);

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

  const calcMutation = useMutation({
    mutationFn: api.calculateSavings,
    onSuccess: (data) => {
      setCalcResults(data.results);
      setCalcLoading(false);
    },
    onError: () => {
      setCalcLoading(false);
    },
  });

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('cc_favorite_deals', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleCalculate = () => {
    if (calcAmount <= 0) return;
    setCalcLoading(true);
    calcMutation.mutate({
      amount: calcAmount,
      category: calcCategory,
      dayIndex: overview?.todayDayIndex ?? new Date().getDay(),
    });
  };

  useEffect(() => {
    if (activeTab === 'calculator' && calcResults.length === 0) {
      handleCalculate();
    }
  }, [activeTab]);

  const todayIndex = overview?.todayDayIndex ?? new Date().getDay();
  const todayName = overview?.todayDayName ?? DAY_LABELS[todayIndex] ?? 'Today';

  const copyPromoText = (promo: ArgentinePromo) => {
    const text = `[DEAL] ${promo.title}\nDiscount: ${promo.discount}\nBank/Wallet: ${promo.entity}\nEligible Stores: ${promo.applicableBusinesses.join(', ')}\nCashback Cap: ${promo.cashbackCap || 'No cap specified'}\nDays: ${promo.daysOfWeek.length === 0 ? 'Every day' : promo.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')}\nDetails: ${promo.description}`;
    void navigator.clipboard.writeText(text);
    setCopiedId(promo.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filter promotions
  const filteredPromos = (overview?.promotions ?? []).filter((promo) => {
    if (showFavoritesOnly && !favorites.has(promo.id)) return false;

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

  // Sort favorites first
  filteredPromos.sort((a, b) => {
    const aFav = favorites.has(a.id);
    const bFav = favorites.has(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const getPaymentLabel = (m: PaymentMethod) => {
    switch (m) {
      case 'qr':
        return 'QR Code at Cashier';
      case 'credit':
        return 'Credit Card';
      case 'debit':
        return 'Debit Card';
      case 'wallet_balance':
        return 'Wallet Balance';
      default:
        return 'Any Payment Method';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="card p-5 sm:p-6 border border-line bg-gradient-to-r from-card to-subtle/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              Argentina Daily Deals & Bank Discounts
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-series/20 text-series border border-series/30">
              Live Scraper
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 max-w-2xl leading-relaxed">
            Real-time daily deal tracking for Argentina banking promotions, digital wallets (Cuenta DNI, MODO, Mercado Pago, BNA+), supermarkets, and fuel fill-ups.
          </p>
          <div className="flex items-center gap-3 pt-1 text-[11px] text-muted">
            <span>Date: {overview?.todayDateFormatted || 'Today'} ({todayName})</span>
            <span>•</span>
            <span>
              Last Scrape:{' '}
              {overview?.lastScrapedAt
                ? new Date(overview.lastScrapedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : 'Recent'}
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
            <RefreshIcon spin={scrapeMutation.isPending || isFetching} />
            <span>{scrapeMutation.isPending ? 'Scraping Deals...' : 'Refresh Live Deals'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Active Today ({todayName})</span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-400 mt-0.5 block">
            {overview?.activeTodayCount ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">Ready to use right now</span>
        </div>

        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Total Monitored Deals</span>
          <span className="text-xl sm:text-2xl font-bold text-ink mt-0.5 block">
            {overview?.totalPromos ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">Across all weekly cycles</span>
        </div>

        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Covered Entities</span>
          <span className="text-xl sm:text-2xl font-bold text-series mt-0.5 block">
            {overview?.topEntities.length ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">Banks, wallets & gas networks</span>
        </div>

        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Maximum Discount</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-400 mt-0.5 block">
            Up to 40% OFF
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">On butchers & local fairs</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('deals')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'deals' ? 'bg-series text-white' : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          Explore Deals ({overview?.promotions.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'calculator' ? 'bg-series text-white' : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          Savings Optimizer
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeTab === 'schedule' ? 'bg-series text-white' : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          Weekly Schedule Matrix
        </button>
      </div>

      {/* =========================================================================
          TAB 1: DEALS EXPLORER
          ========================================================================= */}
      {activeTab === 'deals' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="card p-4 border border-line bg-card/80 space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stores, banks, products (e.g. Coto, YPF, Axion, Butchers, 35%)..."
                  className="input w-full text-xs py-1.5"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="input w-full text-xs py-1.5"
                >
                  <option value="all">All Banks & Wallets</option>
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
                  <option value="all">Any Payment Method</option>
                  <option value="qr">QR Code (MODO / Cuenta DNI / MP)</option>
                  <option value="credit">Credit Card</option>
                  <option value="debit">Debit Card</option>
                  <option value="wallet_balance">Wallet Balance</option>
                </select>
              </div>
            </div>

            {/* Day Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 text-xs">
              <span className="text-muted text-[11px] mr-1 flex-shrink-0 font-medium">Day:</span>
              <button
                type="button"
                onClick={() => setSelectedDayFilter('today')}
                className={`px-2.5 py-1 rounded transition flex-shrink-0 font-semibold ${
                  selectedDayFilter === 'today'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-ink-2 hover:bg-subtle hover:text-ink'
                }`}
              >
                Active Today ({todayName})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayFilter('all')}
                className={`px-2.5 py-1 rounded transition flex-shrink-0 ${
                  selectedDayFilter === 'all'
                    ? 'bg-series text-white font-medium'
                    : 'text-ink-2 hover:bg-subtle hover:text-ink'
                }`}
              >
                All Days
              </button>
              {DAY_LABELS.map((d, idx) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDayFilter(idx)}
                  className={`px-2.5 py-1 rounded transition flex-shrink-0 ${
                    selectedDayFilter === idx
                      ? 'bg-series text-white font-medium'
                      : 'text-ink-2 hover:bg-subtle hover:text-ink'
                  }`}
                >
                  {d.slice(0, 3)}
                  {idx === todayIndex && <span className="ml-1 text-[9px] opacity-80">(Today)</span>}
                </button>
              ))}

              <div className="h-4 w-px bg-line mx-1" />

              <button
                type="button"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-2.5 py-1 rounded transition flex-shrink-0 flex items-center gap-1.5 ${
                  showFavoritesOnly
                    ? 'bg-amber-500 text-white font-medium'
                    : 'text-ink-2 hover:bg-subtle hover:text-ink'
                }`}
              >
                <StarIcon filled={showFavoritesOnly} />
                <span>Favorites ({favorites.size})</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 text-xs">
              <span className="text-muted text-[11px] mr-1 flex-shrink-0 font-medium">Category:</span>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded transition flex-shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-ink text-page font-medium'
                    : 'text-ink-2 hover:bg-subtle hover:text-ink'
                }`}
              >
                All ({overview?.promotions.length ?? 0})
              </button>
              {overview?.categories
                .filter((c) => c.count > 0)
                .map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded transition flex-shrink-0 flex items-center gap-1 ${
                      selectedCategory === cat.id
                        ? 'bg-ink text-page font-medium'
                        : 'text-ink-2 hover:bg-subtle hover:text-ink'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[10px] opacity-70">({cat.count})</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div className="card p-12 text-center text-sm text-ink-2">
              <RefreshIcon spin />
              <span className="mt-2 block">Loading daily promotions feed...</span>
            </div>
          ) : error ? (
            <div className="card p-6 border-danger/40 text-danger text-sm">
              Failed to load promotions: {(error as any).message || 'Unknown error'}
            </div>
          ) : filteredPromos.length === 0 ? (
            <div className="card p-12 text-center space-y-2 border border-line">
              <p className="text-sm font-semibold text-ink">No deals found matching current filters</p>
              <p className="text-xs text-ink-2 max-w-sm mx-auto">
                Try selecting "All Days" or clearing your search query to explore more banking discounts.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDayFilter('all');
                  setSelectedCategory('all');
                  setSelectedEntity('all');
                  setSelectedPayment('all');
                  setSearchQuery('');
                  setShowFavoritesOnly(false);
                }}
                className="btn btn-secondary text-xs px-3 py-1.5 mt-2"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPromos.map((promo) => {
                const isCopied = copiedId === promo.id;
                const isFav = favorites.has(promo.id);

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
                          <span className="text-base font-extrabold px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {promo.discount}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-subtle text-ink-2 border border-line">
                            {promo.entity}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {promo.isTodayActive ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                              Active Today
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-subtle text-muted">
                              {promo.daysOfWeek.map((d) => DAY_LABELS[d]?.slice(0, 3)).join(', ')}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleFavorite(promo.id)}
                            className="p-1 text-muted hover:text-amber-400 transition"
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <StarIcon filled={isFav} />
                          </button>
                        </div>
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
                        <span className="text-[10px] text-muted block font-medium">Valid at:</span>
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
                              +{promo.applicableBusinesses.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cashback Cap & Payment Method */}
                      <div className="p-2 rounded bg-page border border-line/60 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Cashback Cap:</span>
                          <strong className="text-ink font-semibold truncate ml-2">
                            {promo.cashbackCap || 'No Cap'}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Payment:</span>
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
                          <span>Official Terms</span>
                          <ExternalLinkIcon />
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted">Direct merchant offer</span>
                      )}

                      <button
                        type="button"
                        onClick={() => copyPromoText(promo)}
                        className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                        title="Copy deal details"
                      >
                        {isCopied ? <CheckIcon /> : <CopyIcon />}
                        <span className="text-[11px]">{isCopied ? 'Copied' : 'Copy Info'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: SAVINGS OPTIMIZER (CALCULATOR)
          ========================================================================= */}
      {activeTab === 'calculator' && (
        <div className="space-y-5">
          <div className="card p-5 border border-line bg-card/80 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-ink">Cashback & Savings Optimizer</h2>
              <p className="text-xs text-ink-2 mt-0.5">
                Enter your planned purchase amount to find the highest-saving bank, card, or wallet active today.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5 space-y-1">
                <label className="text-xs font-medium text-ink-2">Planned Spending Amount (ARS)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-muted font-mono">$</span>
                  <input
                    type="number"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(Number(e.target.value))}
                    step={1000}
                    min={100}
                    className="input w-full pl-7 text-xs font-mono"
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>

              <div className="sm:col-span-5 space-y-1">
                <label className="text-xs font-medium text-ink-2">Merchant Category</label>
                <select
                  value={calcCategory}
                  onChange={(e) => setCalcCategory(e.target.value as ArgentinePromoCategory)}
                  className="input w-full text-xs"
                >
                  <option value="supermarkets">Supermarkets & Groceries</option>
                  <option value="fuel">Fuel & Gas Stations</option>
                  <option value="gastronomy">Restaurants & Dining</option>
                  <option value="pharmacy">Pharmacies & Health</option>
                  <option value="clothing">Apparel & Shopping</option>
                  <option value="technology">Electronics & Tech</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={calcLoading}
                  onClick={handleCalculate}
                  className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  <RefreshIcon spin={calcLoading} />
                  <span>Calculate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
              Optimal Deals Ranked by Net Savings (for ${calcAmount.toLocaleString('en-US')} ARS)
            </h3>

            {calcResults.length === 0 ? (
              <div className="card p-8 text-center text-xs text-ink-2 border border-line">
                No active capped deals matched this category on {todayName}.
              </div>
            ) : (
              <div className="space-y-2.5">
                {calcResults.map((result, idx) => (
                  <div
                    key={result.promoId}
                    className={`card p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                      idx === 0
                        ? 'border-emerald-500/50 bg-emerald-500/5 shadow-sm'
                        : 'border-line bg-card'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {idx === 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500 text-white">
                            BEST CHOICE
                          </span>
                        )}
                        <span className="text-xs font-bold text-ink">{result.entity}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-ink-2 font-mono border border-line">
                          {result.discountPercent}% OFF
                        </span>
                        <span className="text-[10px] text-muted">
                          via {getPaymentLabel(result.paymentMethod)}
                        </span>
                      </div>
                      <p className="text-xs text-ink-2 truncate">{result.promoTitle}</p>
                      <p className="text-[11px] text-emerald-400 font-medium">
                        {result.recommendation}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-line pt-2 md:pt-0 md:pl-6 text-right flex-shrink-0">
                      <div>
                        <span className="text-[10px] text-muted block uppercase">You Save</span>
                        <span className="text-base font-extrabold text-emerald-400 font-mono">
                          ${result.calculatedSavings.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block uppercase">Final Net Total</span>
                        <span className="text-base font-bold text-ink font-mono">
                          ${result.finalPrice.toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: WEEKLY SCHEDULE MATRIX
          ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="card p-4 border border-line bg-card/80">
            <h2 className="text-sm font-bold text-ink">Weekly Deal Rotation Calendar</h2>
            <p className="text-xs text-ink-2 mt-0.5">
              Standard recurring day-by-day promotion planner for major Argentine banks, supermarkets and fuel stations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {[
              { day: 'Monday', idx: 1, highlights: ['BNA+ Pharmacies (10% + 3 cuotas)', 'Uala Groceries (20% Dia & Coto)', 'Cuenta DNI Local Groceries (20%)', 'Galicia YPF (15%)'] },
              { day: 'Tuesday', idx: 2, highlights: ['Mercado Pago Coto (15% QR)', 'Santander Farmacity & Pigmento (20%)', 'MODO Supermarkets (25%)', 'Cuenta DNI Local Stores (20%)'] },
              { day: 'Wednesday', idx: 3, highlights: ['Shell BOX V-Power (10%)', 'Santander Supermarkets (25%)', 'BNA+ Supermarkets (20%)', 'Macro YPF Infinia (20%)'] },
              { day: 'Thursday', idx: 4, highlights: ['Galicia Vamos los Jueves (25% + 3 cuotas)', 'Santander YPF Fuel (15%)', 'Axion ON Quantium (10%)', 'Mercado Pago Coto (15%)'] },
              { day: 'Friday', idx: 5, highlights: ['BNA+ Fuel Fridays (10% all stations)', 'Galicia Coto Fridays (20%)', 'MODO Weekend Dining (30%)', 'PedidosYa MP Delivery (20%)'] },
              { day: 'Saturday', idx: 6, highlights: ['Cuenta DNI Butchers (35% up to $6k)', 'BNA+ Restaurants & Bars (30%)', 'MODO Dining (30%)', 'Farmers Markets (40%)'] },
              { day: 'Sunday', idx: 0, highlights: ['Cuenta DNI Butchers (35% up to $6k)', 'Axion MP Fuel (10%)', 'MODO Dining (30%)', 'YPF In-App Balance (12%)'] },
            ].map((col) => {
              const isToday = col.idx === todayIndex;

              return (
                <div
                  key={col.day}
                  className={`card p-3 border rounded-xl flex flex-col justify-between space-y-3 ${
                    isToday ? 'border-series bg-series/5 shadow-sm' : 'border-line bg-card/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-line pb-1.5">
                      <span className={`text-xs font-bold ${isToday ? 'text-series' : 'text-ink'}`}>
                        {col.day}
                      </span>
                      {isToday && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-series text-white">
                          TODAY
                        </span>
                      )}
                    </div>

                    <ul className="space-y-1.5">
                      {col.highlights.map((item, hIdx) => (
                        <li
                          key={hIdx}
                          className="text-[11px] p-1.5 rounded bg-page border border-line/50 text-ink leading-tight"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDayFilter(col.idx);
                      setActiveTab('deals');
                    }}
                    className="btn btn-secondary w-full text-[10px] py-1"
                  >
                    View All {col.day.slice(0, 3)} Deals
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
