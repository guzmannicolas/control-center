import type { SearchableItem, SearchResult, SearchEngineOptions } from './types.ts';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Pure search matcher implementing tokenized weighted scoring.
 * Adheres to SRP: does not depend on React, DOM, or storage.
 */
export class SearchEngine {
  private items: SearchableItem[] = [];

  constructor(items: SearchableItem[] = []) {
    this.items = items;
  }

  public setItems(items: SearchableItem[]): void {
    this.items = items;
  }

  public search(query: string, options: SearchEngineOptions = {}): SearchResult[] {
    const rawQuery = query.trim();
    if (!rawQuery) {
      // If no query, return top navigation & services up to limit
      const filtered = options.categoryFilter && options.categoryFilter !== 'All'
        ? this.items.filter((item) => item.category === options.categoryFilter)
        : this.items;

      const limit = options.limit ?? 25;
      return filtered.slice(0, limit).map((item) => ({
        item,
        score: 1,
        matchedTokens: [],
      }));
    }

    const normalizedQuery = normalizeText(rawQuery);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const { limit = 30, minScore = 15, categoryFilter = 'All' } = options;

    const results: SearchResult[] = [];

    for (const item of this.items) {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) {
        continue;
      }

      const normTitle = normalizeText(item.title);
      const normSubtitle = item.subtitle ? normalizeText(item.subtitle) : '';
      const normPath = item.path ? normalizeText(item.path) : '';
      const normUrl = item.url ? normalizeText(item.url) : '';
      const normCategory = normalizeText(item.category);
      const normTags = (item.tags || []).map(normalizeText);
      const normKeywords = (item.keywords || []).map(normalizeText);

      let itemScore = 0;
      let allTokensMatched = true;
      const matchedTokens: string[] = [];

      for (const token of tokens) {
        let tokenScore = 0;

        // Exact match in title
        if (normTitle === token) {
          tokenScore += 160;
        } else if (normTitle.startsWith(token)) {
          // Prefix match in title (e.g. "directus" in "directus cms")
          tokenScore += 120;
        } else if (new RegExp(`(?:^|[\\s-_])${token}`).test(normTitle)) {
          // Word boundary match in title (e.g. "cms" in "directus cms")
          tokenScore += 90;
        } else if (normTitle.includes(token)) {
          // Substring match in title
          tokenScore += 60;
        }

        // Match in path / URL (e.g. "/vault", "/vps")
        if (normPath && (normPath.includes(token) || normPath.replace(/^\//, '').startsWith(token))) {
          tokenScore += 45;
        }
        if (normUrl && normUrl.includes(token)) {
          tokenScore += 35;
        }

        // Match in keywords
        if (normKeywords.some((k) => k === token || k.startsWith(token))) {
          tokenScore += 35;
        } else if (normKeywords.some((k) => k.includes(token))) {
          tokenScore += 20;
        }

        // Match in tags
        if (normTags.some((t) => t === token || t.startsWith(token))) {
          tokenScore += 30;
        } else if (normTags.some((t) => t.includes(token))) {
          tokenScore += 15;
        }

        // Match in subtitle
        if (normSubtitle && normSubtitle.includes(token)) {
          tokenScore += 15;
        }

        // Match in category
        if (normCategory.includes(token)) {
          tokenScore += 15;
        }

        if (tokenScore > 0) {
          itemScore += tokenScore;
          matchedTokens.push(token);
        } else {
          allTokensMatched = false;
          break;
        }
      }

      if (allTokensMatched && itemScore >= minScore) {
        // Bonus for items with active status (e.g. operational or down)
        if (item.status === 'fail' || item.status === 'warn') {
          itemScore += 5; // Alert visibility
        }

        results.push({
          item,
          score: itemScore,
          matchedTokens,
        });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }
}
