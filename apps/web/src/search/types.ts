import type { ComponentType } from 'react';
import type { CheckStatus } from '@cc/shared';

export type SearchCategory =
  | 'Services'
  | 'Containers'
  | 'Navigation'
  | 'Databases'
  | 'Domains'
  | 'Tools & MCP';

export type SearchItemStatus = CheckStatus | 'running' | 'exited' | 'online' | 'degraded' | 'offline' | null;

export interface SearchableItem {
  id: string;
  title: string;
  subtitle?: string;
  category: SearchCategory;
  path?: string;
  url?: string;
  status?: SearchItemStatus;
  tags?: string[];
  keywords?: string[];
  icon?: ComponentType<{ size?: number; className?: string }>;
}

export interface SearchResult {
  item: SearchableItem;
  score: number;
  matchedTokens: string[];
}

export interface SearchProvider {
  readonly name: string;
  provide(): SearchableItem[];
}

export interface SearchEngineOptions {
  limit?: number;
  minScore?: number;
  categoryFilter?: SearchCategory | 'All';
}
