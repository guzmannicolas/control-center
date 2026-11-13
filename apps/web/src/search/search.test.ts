import { describe, it, expect } from 'vitest';
import { SearchEngine } from './engine.ts';
import type { SearchableItem } from './types.ts';
import {
  NavigationSearchProvider,
  TargetsSearchProvider,
  ContainersSearchProvider,
  McpSearchProvider,
} from './providers.ts';

describe('Search Engine (SOLID - Single Responsibility Principle)', () => {
  const mockItems: SearchableItem[] = [
    {
      id: 'target-1',
      title: 'Directus CMS',
      subtitle: 'Headless CMS on VPS',
      category: 'Services',
      path: '/',
      url: 'https://cms.nicoguzmandev.com',
      keywords: ['cms', 'directus', 'vps'],
      tags: ['production', 'backend'],
    },
    {
      id: 'container-1',
      title: 'cms-directus-1',
      subtitle: 'directus/directus:11.17.4 (Up 3 days)',
      category: 'Containers',
      path: '/vps',
      status: 'running',
      keywords: ['docker', 'container', 'directus'],
    },
    {
      id: 'container-2',
      title: 'cms-postgres-1',
      subtitle: 'postgres:16-alpine (Up 3 days)',
      category: 'Containers',
      path: '/vps',
      status: 'running',
      keywords: ['docker', 'database', 'postgres'],
    },
    {
      id: 'nav-vps',
      title: 'VPS',
      subtitle: 'Contabo VPS Management',
      category: 'Navigation',
      path: '/vps',
      keywords: ['contabo', 'server', 'docker', 'ubuntu'],
    },
    {
      id: 'mcp-tool-1',
      title: 'get_system_context',
      subtitle: 'Tool on Control Center Knowledge & Context',
      category: 'Tools & MCP',
      path: '/mcp',
      keywords: ['mcp', 'context', 'system', 'architecture'],
    },
  ];

  it('returns relevant items when searching by exact and prefix token', () => {
    const engine = new SearchEngine(mockItems);
    const results = engine.search('directus');

    expect(results.length).toBeGreaterThan(0);
    // Directus CMS should score highest because of exact/prefix title match
    expect(results[0]!.item.title).toContain('Directus');
  });

  it('ranks exact title matches higher than keyword/tag matches', () => {
    const engine = new SearchEngine(mockItems);
    const results = engine.search('vps');

    expect(results.length).toBeGreaterThan(0);
    // Navigation VPS should score top for query "vps"
    expect(results[0]!.item.title).toBe('VPS');
  });

  it('handles diacritics and case-insensitivity seamlessly', () => {
    const engine = new SearchEngine([
      {
        id: 'promo-1',
        title: 'Promoción Especial',
        category: 'Services',
        keywords: ['promocion', 'descuento'],
      },
    ]);

    const results = engine.search('promocion');
    expect(results.length).toBe(1);
    expect(results[0]!.item.title).toBe('Promoción Especial');
  });

  it('filters by category when specified', () => {
    const engine = new SearchEngine(mockItems);
    const results = engine.search('cms', { categoryFilter: 'Containers' });

    expect(results.every((r) => r.item.category === 'Containers')).toBe(true);
    expect(results[0]!.item.id).toBe('container-1');
  });

  it('finds docker containers by keyword', () => {
    const engine = new SearchEngine(mockItems);
    const results = engine.search('postgres');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.item.title).toBe('cms-postgres-1');
  });
});

describe('Search Providers (SOLID - Open-Closed Principle)', () => {
  it('NavigationSearchProvider provides all core sections with keywords', () => {
    const provider = new NavigationSearchProvider();
    const items = provider.provide();

    expect(items.length).toBeGreaterThan(10);
    const vpsItem = items.find((i) => i.path === '/vps');
    expect(vpsItem).toBeDefined();
    expect(vpsItem?.keywords).toContain('docker');
  });

  it('ContainersSearchProvider correctly maps container status and properties', () => {
    const provider = new ContainersSearchProvider([
      { name: 'cms-redis-1', image: 'redis:7-alpine', status: 'Up 2 days', state: 'running' },
    ]);
    const items = provider.provide();

    expect(items.length).toBe(1);
    expect(items[0]!.title).toBe('cms-redis-1');
    expect(items[0]!.status).toBe('running');
    expect(items[0]!.category).toBe('Containers');
  });

  it('McpSearchProvider indexes both servers and exposed tools', () => {
    const provider = new McpSearchProvider([
      {
        id: 'srv-1',
        name: 'Test MCP',
        description: 'Testing',
        status: 'online',
        tools: [{ name: 'test_tool', description: 'Runs a test' }],
      },
    ]);
    const items = provider.provide();

    expect(items.length).toBe(2); // 1 server + 1 tool
    expect(items[0]!.category).toBe('Tools & MCP');
    expect(items[1]!.title).toBe('test_tool');
  });
});
