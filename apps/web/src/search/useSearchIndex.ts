import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.ts';
import type { SearchableItem, SearchResult, SearchCategory, SearchEngineOptions } from './types.ts';
import { SearchEngine } from './engine.ts';
import {
  NavigationSearchProvider,
  TargetsSearchProvider,
  ContainersSearchProvider,
  McpSearchProvider,
} from './providers.ts';

export function useSearchIndex() {
  // Query 1: Overview targets (websites, services, vercel projects, github repos)
  const overviewQuery = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.overview(),
    staleTime: 60_000,
  });

  // Query 2: VPS Docker containers
  const vpsQuery = useQuery({
    queryKey: ['vps-status'],
    queryFn: () => api.vpsStatus(),
    staleTime: 60_000,
  });

  // Query 3: MCP Hub servers & exposed tools
  const mcpQuery = useQuery({
    queryKey: ['mcp-overview'],
    queryFn: () => api.mcpOverview(),
    staleTime: 60_000,
  });

  // Build the complete searchable items list whenever source data updates
  const allItems: SearchableItem[] = useMemo(() => {
    const navProvider = new NavigationSearchProvider();
    const targetsProvider = new TargetsSearchProvider(overviewQuery.data?.targets || []);
    const containersProvider = new ContainersSearchProvider(vpsQuery.data?.containers || []);
    const mcpProvider = new McpSearchProvider(mcpQuery.data?.servers || []);

    const providers = [navProvider, targetsProvider, containersProvider, mcpProvider];
    return providers.flatMap((p) => p.provide());
  }, [overviewQuery.data?.targets, vpsQuery.data?.containers, mcpQuery.data?.servers]);

  // Memoized Search Engine instance
  const engine = useMemo(() => new SearchEngine(allItems), [allItems]);

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allItems.length };
    for (const item of allItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [allItems]);

  const search = (query: string, options?: SearchEngineOptions): SearchResult[] => {
    return engine.search(query, options);
  };

  const isLoading = overviewQuery.isLoading || vpsQuery.isLoading || mcpQuery.isLoading;

  return {
    allItems,
    categoryCounts,
    search,
    isLoading,
  };
}
