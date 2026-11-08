import { useState, useEffect } from 'react';
import type { User } from '@cc/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { Link, usePath, useSearch, navigate } from '../router.tsx';
import { SECTIONS, type Section } from '../sections.tsx';
import {
  CloseIcon,
  DeployIcon,
  LeadsIcon,
  MenuIcon,
  OverviewIcon,
  VpsIcon,
} from './Icons.tsx';


const MARKETING_SUBMENU = [
  {
    tab: 'creative',
    label: 'Creative Studio',
    desc: 'Drafts & Auto-Publishing',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    tab: 'ads',
    label: 'Ads & Traffic',
    desc: 'Meta & Google Guardrails',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
  },
  {
    tab: 'chat',
    label: 'Inbox & Assistant',
    desc: 'Community Manager DMs',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    tab: 'integrations',
    label: 'Integrations & Keys',
    desc: 'Meta, Telegram, WhatsApp',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    tab: 'client_portal',
    label: 'Client Simulator',
    desc: 'One-Click Mobile Link',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  {
    tab: 'brand',
    label: 'Brand Directives',
    desc: 'Dossier & Style Voice',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
];

function NotFound() {
  return (
    <div className="py-10 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-sm text-series hover:underline">
        Go to the overview
      </Link>
    </div>
  );
}

const SECTION_GROUPS: { title: string; paths: string[] }[] = [
  {
    title: 'Core & Sales',
    paths: ['/', '/deals', '/leads', '/marketing'],
  },
  {
    title: 'Infrastructure & Cloud',
    paths: ['/vps', '/files', '/vault', '/deploys', '/vercel', '/cloudflare', '/backups', '/domains', '/databases'],
  },
  {
    title: 'Dev & AI Tools',
    paths: ['/agents', '/terminal', '/knowledge'],
  },
  {
    title: 'Tracking & Learning',
    paths: ['/improvements', '/learning'],
  },
];

export function Shell({ user }: { user: User }) {
  const path = usePath();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: async () => {
      await queryClient.resetQueries({ queryKey: ['me'] });
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
  });

  const current =
    SECTIONS.find((s) => s.path === path) ??
    SECTIONS.find((s) => s.path !== '/' && path.startsWith(`${s.path}/`));
  const Page = current?.Page ?? NotFound;

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

  // Close mobile drawer on Esc key or path change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [path]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-dvh md:flex relative bg-page text-ink">
      {/* =========================================================================
          MOBILE TOP APP BAR (< md)
          ========================================================================= */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-line bg-page/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-good shadow-[0_0_8px_rgba(12,163,12,0.6)]"
          />
          <span className="font-semibold text-sm tracking-tight text-ink">Control Center</span>
        </div>

        <div className="flex items-center gap-2">
          {current && (
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
              <current.Icon />
              <span className="max-w-[110px] truncate">{current.label}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
            className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink hover:bg-grid/40 active:scale-95 transition"
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {/* =========================================================================
          MOBILE OFF-CANVAS SLIDE-OVER DRAWER (< md)
          ========================================================================= */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Mobile Navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-page shadow-2xl transition-transform duration-200 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full bg-good shadow-[0_0_8px_rgba(12,163,12,0.6)]"
            />
            <span className="font-semibold text-base text-ink">Control Center</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:text-ink active:scale-95"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {SECTION_GROUPS.map((group) => {
            const groupSections = group.paths
              .map((p) => SECTIONS.find((s) => s.path === p))
              .filter((s): s is Section => Boolean(s));

            return (
              <div key={group.title}>
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {group.title}
                </div>
                <ul className="space-y-1">
                  {groupSections.map(({ path: to, label, Icon }) => {
                    const active = to === current?.path;
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          onClick={() => setMobileMenuOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
                            active
                              ? 'bg-surface font-semibold text-ink shadow-sm ring-1 ring-line'
                              : 'text-ink-2 hover:bg-surface/70 hover:text-ink'
                          }`}
                        >
                          <Icon />
                          <span>{label}</span>
                          {active && (
                            <span className="ml-auto size-1.5 rounded-full bg-series" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line bg-surface/60 p-4">
          <div className="truncate text-xs text-muted" title={user.email}>
            {user.email}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                logout.mutate();
              }}
              className="text-xs font-semibold text-critical hover:underline"
            >
              Sign out
            </button>
            <span className="text-[10px] font-mono text-muted">v.{version}</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          DESKTOP SIDEBAR NAVIGATION (md+)
          ========================================================================= */}
      <nav
        aria-label="Sections"
        className="sticky top-0 z-20 hidden border-line bg-page/95 backdrop-blur md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-r"
      >
        <div className="flex items-center gap-2 px-5 pt-6 pb-4">
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-good shadow-[0_0_8px_rgba(12,163,12,0.6)]"
          />
          <span className="font-semibold">Control Center</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {SECTION_GROUPS.map((group) => {
            const groupSections = group.paths
              .map((p) => SECTIONS.find((s) => s.path === p))
              .filter((s): s is Section => Boolean(s));

            return (
              <div key={group.title}>
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {group.title}
                </div>
                <ul className="space-y-0.5">
                  {groupSections.map(({ path: to, label, Icon }) => {
                    const active = to === current?.path;
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition ${
                            active
                              ? 'bg-surface font-semibold text-ink shadow-sm ring-1 ring-line'
                              : 'text-ink-2 hover:bg-grid/50 hover:text-ink font-medium'
                          }`}
                        >
                          <Icon />
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-auto border-t border-line px-5 py-4 text-sm">
          <div className="truncate text-ink-2" title={user.email}>
            {user.email}
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="mt-1 text-ink-2 hover:text-ink hover:underline text-xs"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* =========================================================================
          MAIN CONTENT AREA
          ========================================================================= */}
      <main className="min-w-0 flex-1 px-4 pt-3 pb-28 md:px-8 md:pt-4 md:pb-16">
        <div className="mx-auto max-w-5xl">
          <Page />
        </div>
      </main>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION BAR (< md)
          ========================================================================= */}
      <nav
        aria-label="Quick Access"
        className="fixed bottom-0 inset-x-0 z-30 flex h-14 items-center justify-around border-t border-line bg-page/95 backdrop-blur-lg px-2 pb-[env(safe-area-inset-bottom)] md:hidden shadow-lg"
      >
        {[
          { path: '/', label: 'Overview', Icon: OverviewIcon },
          { path: '/vps', label: 'VPS', Icon: VpsIcon },
          { path: '/deploys', label: 'Deploys', Icon: DeployIcon },
          { path: '/leads', label: 'Sales', Icon: LeadsIcon },
        ].map(({ path: to, label, Icon }) => {
          const active = to === current?.path;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition active:scale-95 ${
                active ? 'text-series font-semibold' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon />
              <span className="text-[10px] mt-0.5 tracking-tight">{label}</span>
              {active && <span className="size-1 rounded-full bg-series mt-0.5" />}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open full menu"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition active:scale-95 ${
            mobileMenuOpen ||
            !['/', '/vps', '/deploys', '/leads'].includes(current?.path ?? '')
              ? 'text-series font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          <MenuIcon />
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
          {!['/', '/vps', '/deploys', '/leads'].includes(current?.path ?? '') && (
            <span className="size-1 rounded-full bg-series mt-0.5" />
          )}
        </button>
      </nav>

      {/* Desktop version badge */}
      <footer className="fixed bottom-2 right-3 z-20 hidden md:block pointer-events-none">
        <div
          title={buildTime ? `Deploy: ${buildTime}` : 'Version'}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[10px] font-mono font-medium text-muted shadow-sm backdrop-blur hover:text-ink hover:border-accent transition"
        >
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>v.{version}</span>
        </div>
      </footer>
    </div>
  );
}
