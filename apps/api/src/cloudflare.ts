export interface CloudflareDnsRecord {
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

interface CloudflareZone {
  id: string;
  name: string;
}

// In-memory cache to avoid querying Cloudflare on every page refresh (TTL: 5 minutes)
let cache: { fetchedAt: number; recordsByDomain: Map<string, CloudflareDnsRecord[]> } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

export async function fetchCloudflareDnsRecords(apiToken: string | undefined): Promise<Map<string, CloudflareDnsRecord[]>> {
  if (!apiToken) return new Map();

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.recordsByDomain;
  }

  const byDomain = new Map<string, CloudflareDnsRecord[]>();
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return cache?.recordsByDomain ?? byDomain;

    const data = (await res.json()) as { success: boolean; result?: CloudflareZone[] };
    if (!data.success || !data.result) return cache?.recordsByDomain ?? byDomain;

    await Promise.all(
      data.result.map(async (zone) => {
        try {
          const recRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?per_page=100`, {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(8_000),
          });
          if (!recRes.ok) return;
          const recData = (await recRes.json()) as {
            success: boolean;
            result?: { type: string; name: string; content: string; proxied: boolean }[];
          };
          if (recData.success && recData.result) {
            // Keep web-relevant records (A, AAAA, CNAME)
            const webRecords = recData.result
              .filter((r) => ['A', 'AAAA', 'CNAME'].includes(r.type))
              .map((r) => ({ type: r.type, name: r.name, content: r.content, proxied: Boolean(r.proxied) }));
            byDomain.set(zone.name, webRecords);
          }
        } catch {
          // ignore individual zone failures
        }
      })
    );

    cache = { fetchedAt: now, recordsByDomain: byDomain };
  } catch {
    // If Cloudflare fails or times out, fall back to cached data or empty map
    return cache?.recordsByDomain ?? byDomain;
  }

  return byDomain;
}
