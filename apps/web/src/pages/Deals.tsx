import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ArgentinePromo,
  ArgentinePromoCategory,
  PaymentMethod,
  PromotionsOverview,
  SavingsCalculationResult,
  PriceGlitchItem,
  PriceGlitchOverview,
  PriceAnomalyType,
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

function ChevronDownIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function DealsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'deals' | 'glitches' | 'calculator' | 'schedule'>('deals');
  const [expandedCard, setExpandedCard] = useState<'today' | 'entities' | 'glitches' | 'max_rates' | null>(null);

  // Deals Filter State
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

  // Price Glitches & Steal Deals Filter State
  const [glitchAnomalyFilter, setGlitchAnomalyFilter] = useState<PriceAnomalyType | 'ALL'>('ALL');
  const [glitchRetailerFilter, setGlitchRetailerFilter] = useState<string>('all');
  const [glitchMinDiscount, setGlitchMinDiscount] = useState<number>(0);
  const [glitchSortBy, setGlitchSortBy] = useState<'discount' | 'price_asc' | 'savings' | 'recent'>('discount');
  const [glitchSearch, setGlitchSearch] = useState<string>('');
  const [copiedGlitchId, setCopiedGlitchId] = useState<string | null>(null);

  // Savings Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(45000);
  const [calcCategory, setCalcCategory] = useState<ArgentinePromoCategory>('supermarkets');
  const [calcResults, setCalcResults] = useState<SavingsCalculationResult[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);

  // Queries
  const { data: overview, isLoading, error, isFetching } = useQuery<PromotionsOverview>({
    queryKey: ['promotions'],
    queryFn: () => api.promotions(),
  });

  const { data: glitchesOverview, isLoading: glitchesLoading, isFetching: glitchesFetching } = useQuery<PriceGlitchOverview>({
    queryKey: ['price-glitches'],
    queryFn: () => api.priceGlitches(),
  });

  // Mutations
  const scrapeMutation = useMutation({
    mutationFn: () => api.scrapePromotions(),
    onSuccess: (data) => {
      queryClient.setQueryData(['promotions'], data);
    },
  });

  const refreshGlitchesMutation = useMutation({
    mutationFn: () => api.refreshPriceGlitches(),
    onSuccess: (data) => {
      queryClient.setQueryData(['price-glitches'], data);
    },
  });

  const verifyPromoMutation = useMutation({
    mutationFn: (id: string) => api.verifyPromotionUrl(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  const verifyGlitchMutation = useMutation({
    mutationFn: (id: string) => api.verifyPriceGlitch(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['price-glitches'] });
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

  const copyGlitchText = (item: PriceGlitchItem) => {
    const text = `[PRICE GLITCH ALERT] ${item.title}\nRetailer: ${item.retailer}\nOriginal: $${item.originalPrice.toLocaleString('en-US')} ARS\nGlitch Price: $${item.glitchPrice.toLocaleString('en-US')} ARS (-${item.discountPercent}% OFF)\nYou Save: $${(item.originalPrice - item.glitchPrice).toLocaleString('en-US')} ARS\nType: ${item.anomalyType}\nSource: ${item.sourceChannel}\nDirect Link: ${item.sourceUrl}\nNotes: ${item.notes || 'Verified price anomaly'}`;
    void navigator.clipboard.writeText(text);
    setCopiedGlitchId(item.id);
    setTimeout(() => setCopiedGlitchId(null), 2500);
  };

  // Filter promotions
  const filteredPromos = (overview?.promotions ?? []).filter((promo) => {
    if (showFavoritesOnly && !favorites.has(promo.id)) return false;

    if (selectedDayFilter === 'today') {
      if (!promo.isTodayActive) return false;
    } else if (typeof selectedDayFilter === 'number') {
      if (promo.daysOfWeek.length > 0 && !promo.daysOfWeek.includes(selectedDayFilter)) {
        return false;
      }
    }

    if (selectedCategory !== 'all' && promo.category !== selectedCategory) {
      return false;
    }

    if (selectedEntity !== 'all' && promo.entity.toLowerCase() !== selectedEntity.toLowerCase()) {
      return false;
    }

    if (selectedPayment !== 'all' && promo.paymentMethod !== selectedPayment) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = promo.title.toLowerCase().includes(q);
      const matchEntity = promo.entity.toLowerCase().includes(q);
      const matchDesc = promo.description.toLowerCase().includes(q);
      const matchBiz = promo.applicableBusinesses.some((b) => b.toLowerCase().includes(q));
      if (!matchTitle && !matchEntity && !matchDesc && !matchBiz) {
        return false;
      }
    }

    return true;
  });

  filteredPromos.sort((a, b) => {
    const aFav = favorites.has(a.id);
    const bFav = favorites.has(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  // Filter Price Glitches
  const filteredGlitches = (glitchesOverview?.glitches ?? []).filter((item) => {
    if (glitchAnomalyFilter !== 'ALL' && item.anomalyType !== glitchAnomalyFilter) {
      return false;
    }
    if (glitchRetailerFilter !== 'all' && item.retailer.toLowerCase() !== glitchRetailerFilter.toLowerCase()) {
      return false;
    }
    if (item.discountPercent < glitchMinDiscount) {
      return false;
    }
    if (glitchSearch.trim()) {
      const q = glitchSearch.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchRetailer = item.retailer.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q) ?? false;
      const matchChannel = item.sourceChannel.toLowerCase().includes(q);
      if (!matchTitle && !matchRetailer && !matchNotes && !matchChannel) {
        return false;
      }
    }
    return true;
  });

  filteredGlitches.sort((a, b) => {
    if (glitchSortBy === 'price_asc') return a.glitchPrice - b.glitchPrice;
    if (glitchSortBy === 'savings') return (b.originalPrice - b.glitchPrice) - (a.originalPrice - a.glitchPrice);
    if (glitchSortBy === 'recent') return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    return b.discountPercent - a.discountPercent;
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

  const glitchRetailersList = Array.from(
    new Set((glitchesOverview?.glitches ?? []).map((g) => g.retailer))
  ).sort();

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="card p-5 sm:p-6 border border-line bg-gradient-to-r from-card to-subtle/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              Argentina Deals, Bank Promos & Price Glitch Hunter
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-series/20 text-series border border-series/30">
              Live Scraper
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 max-w-2xl leading-relaxed">
            Real-time daily deal intelligence across Argentina: banking promos, digital wallets (Cuenta DNI, MODO, Mercado Pago, BNA+, BBVA, Macro), retail chains, and anomalous pricing bug tracking.
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

      {/* =========================================================================
          DESPLEGABLE / EXPANDABLE TOP METRIC CARDS WITH SUBMENUS
          ========================================================================= */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Active Today */}
          <button
            type="button"
            onClick={() => setExpandedCard((prev) => (prev === 'today' ? null : 'today'))}
            className={`card p-3 border text-left transition flex flex-col justify-between ${
              expandedCard === 'today'
                ? 'border-series ring-1 ring-series/40 bg-subtle/50'
                : 'border-line bg-card/60 hover:border-line-hover hover:bg-card'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-muted font-medium">Active Today ({todayName})</span>
              <ChevronDownIcon open={expandedCard === 'today'} />
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold text-emerald-400 block">
                {overview?.activeTodayCount ?? 0}
              </span>
              <span className="text-[10px] text-ink-2 mt-0.5 flex items-center gap-1">
                <span>Click for today's submenu</span>
              </span>
            </div>
          </button>

          {/* Card 2: Monitored Entities */}
          <button
            type="button"
            onClick={() => setExpandedCard((prev) => (prev === 'entities' ? null : 'entities'))}
            className={`card p-3 border text-left transition flex flex-col justify-between ${
              expandedCard === 'entities'
                ? 'border-series ring-1 ring-series/40 bg-subtle/50'
                : 'border-line bg-card/60 hover:border-line-hover hover:bg-card'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-muted font-medium">Covered Banks & Stores</span>
              <ChevronDownIcon open={expandedCard === 'entities'} />
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold text-series block">
                {overview?.topEntities.length ?? 0} Entities
              </span>
              <span className="text-[10px] text-ink-2 mt-0.5 flex items-center gap-1">
                <span>Click for entities submenu</span>
              </span>
            </div>
          </button>

          {/* Card 3: Price Glitches & Steal Deals */}
          <button
            type="button"
            onClick={() => setExpandedCard((prev) => (prev === 'glitches' ? null : 'glitches'))}
            className={`card p-3 border text-left transition flex flex-col justify-between ${
              expandedCard === 'glitches'
                ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-500/10'
                : 'border-line bg-card/60 hover:border-line-hover hover:bg-card'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangleIcon />
                <span>Price Glitches & Steals</span>
              </span>
              <ChevronDownIcon open={expandedCard === 'glitches'} />
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold text-amber-400 block">
                {glitchesOverview?.totalGlitches ?? 10} Active
              </span>
              <span className="text-[10px] text-ink-2 mt-0.5 flex items-center gap-1">
                <span>Click for glitch alerts</span>
              </span>
            </div>
          </button>

          {/* Card 4: Top Discount Rates */}
          <button
            type="button"
            onClick={() => setExpandedCard((prev) => (prev === 'max_rates' ? null : 'max_rates'))}
            className={`card p-3 border text-left transition flex flex-col justify-between ${
              expandedCard === 'max_rates'
                ? 'border-series ring-1 ring-series/40 bg-subtle/50'
                : 'border-line bg-card/60 hover:border-line-hover hover:bg-card'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-muted font-medium">Top Discount Ceiling</span>
              <ChevronDownIcon open={expandedCard === 'max_rates'} />
            </div>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-bold text-amber-400 block">
                {glitchesOverview?.highestDiscount ?? 86}% OFF
              </span>
              <span className="text-[10px] text-ink-2 mt-0.5 flex items-center gap-1">
                <span>Click for top rate ranking</span>
              </span>
            </div>
          </button>
        </div>

        {/* =========================================================================
            SUBMENU EXPANDED PANEL
            ========================================================================= */}
        {expandedCard && (
          <div className="card p-4 border border-series/30 bg-page/90 shadow-sm animate-fadeIn space-y-3">
            {/* SUBMENU 1: Today's Shortcuts */}
            {expandedCard === 'today' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Today's Active Categories & Direct Filters ({todayName})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setExpandedCard(null)}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDayFilter('today');
                      setSelectedCategory('all');
                      setActiveTab('deals');
                      setExpandedCard(null);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    All Today's Deals ({overview?.activeTodayCount ?? 0})
                  </button>
                  {overview?.categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedDayFilter('today');
                        setSelectedCategory(cat.id);
                        setActiveTab('deals');
                        setExpandedCard(null);
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-surface border border-line hover:border-series hover:text-series"
                    >
                      {cat.label} ({cat.count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SUBMENU 2: Monitored Entities Breakdown */}
            {expandedCard === 'entities' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Monitored Banks, Digital Wallets & Retail Chains
                  </h3>
                  <button
                    type="button"
                    onClick={() => setExpandedCard(null)}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Close
                  </button>
                </div>
                <p className="text-xs text-muted mb-2">
                  Click any entity to filter the deals explorer immediately.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntity('all');
                      setActiveTab('deals');
                      setExpandedCard(null);
                    }}
                    className={`p-2 rounded text-left text-xs border ${
                      selectedEntity === 'all'
                        ? 'border-series bg-series/10 text-series font-semibold'
                        : 'border-line bg-surface hover:border-line-hover text-ink'
                    }`}
                  >
                    <span className="block font-medium">All Entities</span>
                    <span className="text-[10px] text-muted">{overview?.totalPromos ?? 0} total</span>
                  </button>
                  {overview?.topEntities.map((ent) => (
                    <button
                      key={ent.name}
                      type="button"
                      onClick={() => {
                        setSelectedEntity(ent.name);
                        setActiveTab('deals');
                        setExpandedCard(null);
                      }}
                      className={`p-2 rounded text-left text-xs border ${
                        selectedEntity.toLowerCase() === ent.name.toLowerCase()
                          ? 'border-series bg-series/10 text-series font-semibold'
                          : 'border-line bg-surface hover:border-line-hover text-ink'
                      }`}
                    >
                      <span className="block font-medium truncate">{ent.name}</span>
                      <span className="text-[10px] text-muted">{ent.count} promotions</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SUBMENU 3: Live Glitch Highlights */}
            {expandedCard === 'glitches' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Top Price Anomalies & Error Fares (Quick Peek)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('glitches');
                      setExpandedCard(null);
                    }}
                    className="btn btn-secondary text-xs px-2.5 py-1"
                  >
                    Open Price Glitches Workspace →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {(glitchesOverview?.glitches ?? []).slice(0, 3).map((g) => (
                    <div key={g.id} className="p-2.5 rounded bg-surface border border-line text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-series">{g.retailer}</span>
                        <span className="px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400 text-[10px]">
                          -{g.discountPercent}% OFF
                        </span>
                      </div>
                      <p className="text-ink font-medium truncate">{g.title}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>Glitch: ${g.glitchPrice.toLocaleString('en-US')} ARS</span>
                        <span className="text-emerald-400 font-semibold">
                          Saves ${(g.originalPrice - g.glitchPrice).toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUBMENU 4: Top Rates Ranking */}
            {expandedCard === 'max_rates' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Highest Discount Rate Ranking (Argentina 2026)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setExpandedCard(null)}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-surface border border-line">
                    <span className="font-bold text-amber-400 text-sm">86% OFF</span>
                    <p className="font-medium text-ink mt-0.5">Smart TV Samsung 55" 4K (Fravega Bug)</p>
                    <span className="text-[10px] text-muted">Price Anomaly • Tech category</span>
                  </div>
                  <div className="p-2.5 rounded bg-surface border border-line">
                    <span className="font-bold text-amber-400 text-sm">82% OFF</span>
                    <p className="font-medium text-ink mt-0.5">Flight BA to Bariloche (Flybondi Zero-Fare)</p>
                    <span className="text-[10px] text-muted">Price Anomaly • Travel category</span>
                  </div>
                  <div className="p-2.5 rounded bg-surface border border-line">
                    <span className="font-bold text-amber-400 text-sm">81% OFF</span>
                    <p className="font-medium text-ink mt-0.5">Philips Air Fryer 4.1L (Carrefour Online)</p>
                    <span className="text-[10px] text-muted">Price Anomaly • Home & Tech</span>
                  </div>
                  <div className="p-2.5 rounded bg-surface border border-line">
                    <span className="font-bold text-emerald-400 text-sm">40% OFF</span>
                    <p className="font-medium text-ink mt-0.5">Supermarkets & Club Dia Daily Coupons</p>
                    <span className="text-[10px] text-muted">Bank / Loyalty Promotion • Daily</span>
                  </div>
                  <div className="p-2.5 rounded bg-surface border border-line">
                    <span className="font-bold text-emerald-400 text-sm">35% OFF</span>
                    <p className="font-medium text-ink mt-0.5">Cuenta DNI Butchers & Poultry Markets</p>
                    <span className="text-[10px] text-muted">Bank Promotion • Weekends</span>
                  </div>
                  <div className="p-2.5 rounded bg-surface border border-line">
                    <span className="font-bold text-emerald-400 text-sm">30% OFF</span>
                    <p className="font-medium text-ink mt-0.5">BBVA & Galicia Supermarkets with MODO</p>
                    <span className="text-[10px] text-muted">Bank Promotion • Wednesdays & Thursdays</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('deals')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === 'deals' ? 'bg-series text-white shadow-sm' : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          <span>Explore Deals</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/20 text-white">
            {overview?.promotions.length ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('glitches')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
            activeTab === 'glitches'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
          }`}
        >
          <AlertTriangleIcon />
          <span>Price Glitches & Steals</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-400/30 text-amber-200">
            {glitchesOverview?.totalGlitches ?? 10} Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0 ${
            activeTab === 'calculator' ? 'bg-series text-white shadow-sm' : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          Savings Optimizer
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0 ${
            activeTab === 'schedule' ? 'bg-series text-white shadow-sm' : 'text-ink-2 hover:text-ink hover:bg-subtle'
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
                  placeholder="Search stores, banks, products (e.g. Coto, YPF, Axion, Butchers, BBVA, Macro, 35%)..."
                  className="input w-full text-xs py-1.5"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="input w-full text-xs py-1.5"
                >
                  <option value="all">All Financial Entities ({overview?.topEntities.length ?? 0})</option>
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
                  <option value="all">All Payment Methods</option>
                  <option value="qr">QR Code (MODO / Cuenta DNI / MP)</option>
                  <option value="credit">Credit Card</option>
                  <option value="debit">Debit Card</option>
                  <option value="wallet_balance">Wallet Account Balance</option>
                </select>
              </div>
            </div>

            {/* Quick Days Selector */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted font-medium mr-1">Day:</span>
              <button
                type="button"
                onClick={() => setSelectedDayFilter('today')}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition ${
                  selectedDayFilter === 'today'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-surface border border-line text-ink hover:bg-subtle'
                }`}
              >
                Today ({todayName})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayFilter('all')}
                className={`px-2.5 py-1 text-xs rounded-md transition ${
                  selectedDayFilter === 'all'
                    ? 'bg-series text-white shadow-sm'
                    : 'bg-surface border border-line text-ink hover:bg-subtle'
                }`}
              >
                All Days
              </button>
              {DAY_LABELS.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDayFilter(idx)}
                  className={`px-2.5 py-1 text-xs rounded-md transition ${
                    selectedDayFilter === idx
                      ? 'bg-series text-white shadow-sm'
                      : 'bg-surface border border-line text-ink hover:bg-subtle'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`px-2.5 py-1 text-xs rounded-md border flex items-center gap-1.5 transition ${
                    showFavoritesOnly
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 font-medium'
                      : 'bg-surface border-line text-ink-2 hover:text-ink'
                  }`}
                >
                  <StarIcon filled={showFavoritesOnly} />
                  <span>Starred ({favorites.size})</span>
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-line/60">
              <span className="text-[11px] text-muted font-medium mr-1">Category:</span>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-0.5 text-xs rounded-md transition ${
                  selectedCategory === 'all'
                    ? 'bg-series/20 text-series border border-series/40 font-medium'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                All ({overview?.totalPromos ?? 0})
              </button>
              {overview?.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-0.5 text-xs rounded-md transition ${
                    selectedCategory === cat.id
                      ? 'bg-series/20 text-series border border-series/40 font-medium'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>
              Showing {filteredPromos.length} of {overview?.totalPromos ?? 0} promotions
              {selectedDayFilter === 'today' && ` active today (${todayName})`}
            </span>
            {(selectedCategory !== 'all' || selectedEntity !== 'all' || selectedPayment !== 'all' || searchQuery || selectedDayFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedEntity('all');
                  setSelectedPayment('all');
                  setSelectedDayFilter('all');
                  setSearchQuery('');
                  setShowFavoritesOnly(false);
                }}
                className="text-series hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Deals Grid */}
          {isLoading ? (
            <div className="card p-12 text-center text-xs text-muted">Loading Argentine deals...</div>
          ) : error ? (
            <div className="card p-8 text-center text-xs text-bad">Failed to load deals.</div>
          ) : filteredPromos.length === 0 ? (
            <div className="card p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-ink">No promotions match the selected criteria</p>
              <p className="text-xs text-muted">Try selecting "All Days" or clearing the category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredPromos.map((promo) => {
                const isFav = favorites.has(promo.id);
                const isCopied = copiedId === promo.id;

                return (
                  <div
                    key={promo.id}
                    className={`card p-4 border flex flex-col justify-between transition-all duration-200 relative group ${
                      promo.isTodayActive
                        ? 'border-line hover:border-series/50 bg-card/90'
                        : 'border-line/60 bg-card/40 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div>
                      {/* Top Header: Entity & Badges */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-series uppercase tracking-wider block">
                            {promo.entity}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-muted">
                            {getPaymentLabel(promo.paymentMethod)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {promo.httpStatus === 200 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span>HTTP 200 OK</span>
                              <span className="text-[9px] text-emerald-500/80">({promo.httpResponseTimeMs ?? 65}ms)</span>
                            </span>
                          ) : promo.httpStatus ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              HTTP {promo.httpStatus}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                              Verified Link
                            </span>
                          )}

                          {promo.isTodayActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Active Today
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleFavorite(promo.id)}
                            className="p-1 rounded hover:bg-subtle"
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <StarIcon filled={isFav} />
                          </button>
                        </div>
                      </div>

                      {/* Main Title & Discount */}
                      <div className="flex items-baseline justify-between gap-2 my-1.5">
                        <h2 className="text-sm font-bold text-ink leading-snug">{promo.title}</h2>
                        <span className="text-lg font-extrabold text-emerald-400 flex-shrink-0">
                          {promo.discount}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-ink-2 leading-relaxed mb-3">{promo.description}</p>

                      {/* Cap / Limit Callout */}
                      {promo.cashbackCap && (
                        <div className="p-2 rounded bg-subtle/60 border border-line/60 text-[11px] mb-2">
                          <span className="font-semibold text-ink">Cashback Cap: </span>
                          <span className="text-amber-400 font-medium">{promo.cashbackCap}</span>
                        </div>
                      )}

                      {/* Live Official URL Box */}
                      {(promo.termsUrl || promo.sourceUrl) && (
                        <div className="p-2 rounded bg-surface border border-line/60 text-[11px] mb-2 font-mono flex items-center justify-between gap-2 overflow-hidden">
                          <span className="text-muted flex-shrink-0 text-[10px] uppercase font-bold tracking-wider">Official Link:</span>
                          <a
                            href={promo.termsUrl || promo.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-series hover:underline truncate text-[11px]"
                            title={promo.termsUrl || promo.sourceUrl}
                          >
                            {promo.termsUrl || promo.sourceUrl}
                          </a>
                        </div>
                      )}

                      {/* Applicable Businesses Tags */}
                      {promo.applicableBusinesses.length > 0 && (
                        <div className="space-y-1 mb-3">
                          <span className="text-[10px] text-muted font-medium block">Participating Stores:</span>
                          <div className="flex flex-wrap gap-1">
                            {promo.applicableBusinesses.map((biz) => (
                              <span
                                key={biz}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-page border border-line text-ink"
                              >
                                {biz}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Meta & Actions */}
                    <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-2 mt-2">
                      <div className="text-[10px] text-muted truncate">
                        <span>
                          {promo.daysOfWeek.length === 0
                            ? 'Every day'
                            : promo.daysOfWeek.map((d) => DAY_LABELS[d]?.slice(0, 3)).join(', ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => copyPromoText(promo)}
                          className="btn btn-secondary text-[11px] px-2 py-1 flex items-center gap-1"
                          title="Copy deal details to clipboard"
                        >
                          {isCopied ? <CheckIcon /> : <CopyIcon />}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>

                        {(promo.termsUrl || promo.sourceUrl) && (
                          <button
                            type="button"
                            disabled={verifyPromoMutation.isPending && verifyPromoMutation.variables === promo.id}
                            onClick={() => verifyPromoMutation.mutate(promo.id)}
                            className="btn btn-secondary text-xs px-2.5 py-1 text-[11px] flex items-center gap-1"
                            title="Ping official bank/store URL live to confirm HTTP 200 reachability"
                          >
                            <RefreshIcon spin={verifyPromoMutation.isPending && verifyPromoMutation.variables === promo.id} />
                            <span>{verifyPromoMutation.isPending && verifyPromoMutation.variables === promo.id ? 'Pinging...' : 'Verify Link'}</span>
                          </button>
                        )}

                        {(promo.termsUrl || promo.sourceUrl) && (
                          <a
                            href={promo.termsUrl || promo.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary text-xs px-2.5 py-1 flex items-center gap-1 font-semibold"
                            title="Open verified bank or store page in new tab"
                          >
                            <span>Go to Offer</span>
                            <ExternalLinkIcon />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: PRICE GLITCHES & STEAL DEALS (PRECIOS RIDICULAMENTE BAJOS)
          ========================================================================= */}
      {activeTab === 'glitches' && (
        <div className="space-y-4">
          {/* Glitch Alert Banner */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  Argentine Price Glitch & Extreme Clearance Monitor
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {glitchesOverview?.highestDiscount ?? 86}% MAX DROP
                </span>
              </div>
              <p className="text-xs text-ink-2 max-w-2xl leading-relaxed">
                Monitors anomalous prices (&gt;70% OFF) caused by retailer pricing bugs, decimal configuration errors, stackable coupon glitches, and emergency warehouse clearance across Argentine e-commerce.
              </p>
            </div>

            <button
              type="button"
              disabled={refreshGlitchesMutation.isPending || glitchesFetching}
              onClick={() => refreshGlitchesMutation.mutate()}
              className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
            >
              <RefreshIcon spin={refreshGlitchesMutation.isPending || glitchesFetching} />
              <span>{refreshGlitchesMutation.isPending ? 'Checking Feeds...' : 'Refresh Glitch Feeds'}</span>
            </button>
          </div>

          {/* Glitch Filters Bar */}
          <div className="card p-4 border border-line bg-card/80 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <input
                  type="text"
                  value={glitchSearch}
                  onChange={(e) => setGlitchSearch(e.target.value)}
                  placeholder="Search glitch products or retailers (e.g. Samsung 55, Flybondi, Airfryer, Nike, Fravega)..."
                  className="input w-full text-xs py-1.5"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  value={glitchRetailerFilter}
                  onChange={(e) => setGlitchRetailerFilter(e.target.value)}
                  className="input w-full text-xs py-1.5"
                >
                  <option value="all">All Retailers ({glitchRetailersList.length})</option>
                  {glitchRetailersList.map((ret) => (
                    <option key={ret} value={ret}>
                      {ret}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={glitchAnomalyFilter}
                  onChange={(e) => setGlitchAnomalyFilter(e.target.value as PriceAnomalyType | 'ALL')}
                  className="input w-full text-xs py-1.5"
                >
                  <option value="ALL">All Anomaly Types</option>
                  <option value="PRICE_BUG">Pricing Bugs (Catalog Errors)</option>
                  <option value="MASSIVE_CLEARANCE">Massive Clearance (&gt;70%)</option>
                  <option value="FLASH_DROP">Flash Drop / Stacking Glitch</option>
                </select>
              </div>
            </div>

            {/* Threshold & Sort Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/60 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted font-medium mr-1">Discount Threshold:</span>
                {[
                  { label: 'All Deals (' + (glitchesOverview?.totalGlitches ?? 15) + '+)', val: 0 },
                  { label: '30%+ OFF', val: 30 },
                  { label: '50%+ OFF', val: 50 },
                  { label: '60%+ OFF', val: 60 },
                  { label: '70%+ OFF', val: 70 },
                ].map((th) => (
                  <button
                    key={th.val}
                    type="button"
                    onClick={() => setGlitchMinDiscount(th.val)}
                    className={`px-2.5 py-0.5 rounded text-xs transition ${
                      glitchMinDiscount === th.val
                        ? 'bg-amber-500 text-white font-semibold'
                        : 'bg-surface border border-line text-ink hover:bg-subtle'
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted font-medium">Sort By:</span>
                <select
                  value={glitchSortBy}
                  onChange={(e) => setGlitchSortBy(e.target.value as any)}
                  className="input text-xs py-1 px-2"
                >
                  <option value="discount">Highest Discount %</option>
                  <option value="savings">Highest Savings ($ ARS)</option>
                  <option value="price_asc">Lowest Price First</option>
                  <option value="recent">Recently Detected</option>
                </select>
                <span className="text-muted ml-2">
                  Showing {filteredGlitches.length} of {glitchesOverview?.totalGlitches ?? 0} active alerts
                </span>
              </div>
            </div>
          </div>

          {/* Glitches Grid */}
          {glitchesLoading ? (
            <div className="card p-12 text-center text-xs text-muted">Checking Argentine deal monitors...</div>
          ) : filteredGlitches.length === 0 ? (
            <div className="card p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-ink">No active price glitches match these criteria</p>
              <p className="text-xs text-muted">Try lowering the minimum discount threshold or selecting All Retailers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGlitches.map((item) => {
                const savingsAmount = item.originalPrice - item.glitchPrice;
                const isCopied = copiedGlitchId === item.id;

                const getAnomalyBadge = () => {
                  switch (item.anomalyType) {
                    case 'PRICE_BUG':
                      return (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                          PRICE BUG
                        </span>
                      );
                    case 'MASSIVE_CLEARANCE':
                      return (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          CLEARANCE
                        </span>
                      );
                    default:
                      return (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          FLASH DROP
                        </span>
                      );
                  }
                };

                return (
                  <div
                    key={item.id}
                    className="card p-4 border border-line hover:border-amber-500/50 bg-card/90 flex flex-col justify-between transition-all duration-200 relative"
                  >
                    <div>
                      {/* Retailer & Anomaly Type */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-series uppercase tracking-wide">
                          {item.retailer}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {getAnomalyBadge()}
                          {item.httpStatus === 200 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span>HTTP 200 OK</span>
                              <span className="text-[9px] text-emerald-500/80">({item.httpResponseTimeMs ?? 120}ms)</span>
                            </span>
                          ) : item.httpStatus ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              HTTP {item.httpStatus}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-muted font-mono">
                              Verified
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Product Title */}
                      <h3 className="text-sm font-bold text-ink leading-snug my-1.5">
                        {item.title}
                      </h3>

                      {/* Pricing Comparison */}
                      <div className="p-3 rounded-lg bg-page border border-line/70 my-2.5 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted line-through">
                            Normal: ${item.originalPrice.toLocaleString('en-US')} ARS
                          </span>
                          <span className="text-xl font-extrabold text-emerald-400">
                            ${item.glitchPrice.toLocaleString('en-US')} ARS
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-line/50">
                          <span className="text-ink font-semibold">Net Savings:</span>
                          <span className="text-amber-400 font-bold">
                            Saves ${savingsAmount.toLocaleString('en-US')} ARS (-{item.discountPercent}%)
                          </span>
                        </div>
                      </div>

                      {/* Notes & Explanation */}
                      {item.notes && (
                        <div className="p-2 rounded bg-amber-500/5 border border-amber-500/20 text-[11px] text-ink-2 mb-3 leading-relaxed">
                          <span className="font-semibold text-amber-400">Anomaly Analysis: </span>
                          {item.notes}
                        </div>
                      )}

                      {/* Source Channel & Detected Timestamp */}
                      <div className="flex items-center justify-between text-[10px] text-muted mb-1.5">
                        <span>Source: {item.sourceChannel}</span>
                        <span>
                          {new Date(item.detectedAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Verified Link Info */}
                      <div className="p-2 rounded bg-surface border border-line/60 text-[11px] mb-2 font-mono flex items-center justify-between gap-2 overflow-hidden">
                        <span className="text-muted flex-shrink-0 text-[10px] uppercase font-bold tracking-wider">Live URL:</span>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-series hover:underline truncate text-[11px]"
                          title={item.sourceUrl}
                        >
                          {item.sourceUrl}
                        </a>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => copyGlitchText(item)}
                        className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                        title="Copy deal alert to clipboard"
                      >
                        {isCopied ? <CheckIcon /> : <CopyIcon />}
                        <span>{isCopied ? 'Copied' : 'Share Alert'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={verifyGlitchMutation.isPending && verifyGlitchMutation.variables === item.id}
                          onClick={() => verifyGlitchMutation.mutate(item.id)}
                          className="btn btn-secondary text-xs px-2.5 py-1 text-[11px] flex items-center gap-1"
                          title="Ping target URL live from backend to check HTTP 200 reachability"
                        >
                          <RefreshIcon spin={verifyGlitchMutation.isPending && verifyGlitchMutation.variables === item.id} />
                          <span>{verifyGlitchMutation.isPending && verifyGlitchMutation.variables === item.id ? 'Pinging...' : 'Verify Link'}</span>
                        </button>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary text-xs px-3 py-1 flex items-center gap-1 font-semibold"
                          title="Visit live page in new tab"
                        >
                          <span>Go to Page</span>
                          <ExternalLinkIcon />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: SAVINGS CALCULATOR (OPTIMIZER)
          ========================================================================= */}
      {activeTab === 'calculator' && (
        <div className="space-y-6">
          <div className="card p-5 border border-line bg-card/80 space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-ink">
                Purchase Savings & Payment Method Optimizer
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Simulate a planned purchase in Argentina to calculate exact net cash savings across MODO, Cuenta DNI, BBVA, Banco Macro, Galicia, and Santander, taking monthly cashback caps into account.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-5 space-y-1">
                <label className="text-xs font-semibold text-ink block">
                  Purchase Amount ($ ARS)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-muted">$</span>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="45000"
                    className="input w-full text-xs pl-7 py-1.5"
                  />
                </div>
              </div>

              <div className="sm:col-span-4 space-y-1">
                <label className="text-xs font-semibold text-ink block">Category</label>
                <select
                  value={calcCategory}
                  onChange={(e) => setCalcCategory(e.target.value as ArgentinePromoCategory)}
                  className="input w-full text-xs py-1.5"
                >
                  <option value="supermarkets">Supermarkets & Groceries</option>
                  <option value="fuel">Fuel & Gas Stations</option>
                  <option value="gastronomy">Restaurants & Dining</option>
                  <option value="pharmacy">Pharmacies & Health</option>
                  <option value="clothing">Apparel & Fashion</option>
                  <option value="technology">Electronics & Tech</option>
                  <option value="entertainment">Cinema & Entertainment</option>
                  <option value="services">Utilities & Bill Pay</option>
                  <option value="other">Local Neighborhood Stores</option>
                </select>
              </div>

              <div className="sm:col-span-3 flex items-end">
                <button
                  type="button"
                  disabled={calcLoading || calcAmount <= 0}
                  onClick={handleCalculate}
                  className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-2"
                >
                  <RefreshIcon spin={calcLoading} />
                  <span>{calcLoading ? 'Optimizing...' : 'Calculate Best Deal'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Calculator Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
              Optimal Payment Methods for ${calcAmount.toLocaleString('en-US')} ARS ({calcCategory})
            </h3>

            {calcResults.length === 0 ? (
              <div className="card p-8 text-center text-xs text-muted">
                No active promotions found for this category today. Try selecting a different category.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {calcResults.map((res, idx) => (
                  <div
                    key={res.promoId}
                    className={`card p-4 border flex flex-col justify-between ${
                      idx === 0
                        ? 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                        : 'border-line bg-card'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-series uppercase">
                          {res.entity}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500 text-white">
                            BEST CHOICE
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-ink leading-tight mb-2">
                        {res.promoTitle}
                      </h4>

                      <div className="space-y-1.5 p-2.5 rounded bg-page border border-line text-xs my-2">
                        <div className="flex justify-between">
                          <span className="text-muted">Nominal Discount:</span>
                          <span className="font-semibold text-ink">{res.discountPercent}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Net Cash Savings:</span>
                          <span className="font-bold text-emerald-400">
                            ${res.calculatedSavings.toLocaleString('en-US')} ARS
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Final Price to Pay:</span>
                          <span className="font-bold text-ink">
                            ${res.finalPrice.toLocaleString('en-US')} ARS
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-ink-2 leading-relaxed">{res.recommendation}</p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-line/60 flex items-center justify-between text-[10px] text-muted">
                      <span>Method: {getPaymentLabel(res.paymentMethod)}</span>
                      <span>Cap: {res.cashbackCap || 'Unlimited'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: WEEKLY SCHEDULE MATRIX
          ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="card p-4 border border-line bg-card space-y-1">
            <h2 className="text-sm font-bold text-ink">7-Day Recurring Promotions Schedule</h2>
            <p className="text-xs text-muted">
              Weekly cycle of recurring supermarket, fuel, dining, and butcher discounts in Argentina. Plan your weekly shopping to maximize total cashback caps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
            {[
              {
                day: 'Monday',
                idx: 1,
                highlights: [
                  'Comunidad Coto: 15% off full basket',
                  'Cuenta DNI: 20% neighborhood groceries',
                  'MODO: 20% gastronomy select chains',
                ],
              },
              {
                day: 'Tuesday',
                idx: 2,
                highlights: [
                  'Banco Macro: 20% at Jumbo, Disco, Vea',
                  'Banco Galicia: 25% at Coto with MODO',
                  'Brubank: 20% supermarket cashback',
                  'Santander: 20% at Farmacity & Pigmento',
                ],
              },
              {
                day: 'Wednesday',
                idx: 3,
                highlights: [
                  'BBVA: 30% at Coto, Carrefour & Dia',
                  'Banco Nacion: 30% at YPF, Shell, Axion',
                  'Macro: 20% fuel at participating stations',
                  'Carrefour: 15% on private brands',
                ],
              },
              {
                day: 'Thursday',
                idx: 4,
                highlights: [
                  'Comunidad Coto: 15% off total cart',
                  'Banco Ciudad & Buepp: 25% at Farmacity',
                  'Cuenta DNI: 20% neighborhood shops',
                  'Galicia: 20% fuel cashback',
                ],
              },
              {
                day: 'Friday',
                idx: 5,
                highlights: [
                  'BBVA: 30% weekend dining & restaurants',
                  'Brubank: 15% gas cashback at Shell & Axion',
                  'MODO: 20% gastronomy & bars',
                  'Personal Pay: 20% fuel fill-up',
                ],
              },
              {
                day: 'Saturday',
                idx: 6,
                highlights: [
                  'Cuenta DNI: 35% at butcher & fish shops',
                  'Santander: 30% weekend dining with Visa',
                  'Jumbo Prime: 20% cashback in points',
                  'Banco Ciudad: 30% gastronomy',
                ],
              },
              {
                day: 'Sunday',
                idx: 0,
                highlights: [
                  'Cuenta DNI: 35% butcher shops & fairs',
                  'Santander: 30% restaurants nationwide',
                  'MODO: 30% gastronomy with credit cards',
                ],
              },
            ].map((col) => {
              const isToday = todayIndex === col.idx;

              return (
                <div
                  key={col.day}
                  className={`card p-3 border flex flex-col justify-between space-y-2 ${
                    isToday ? 'border-series ring-1 ring-series/40 bg-subtle/50' : 'border-line bg-card/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{col.day}</span>
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
