import type { CloudflareDnsItem, CloudflareZoneSummary } from '@cc/shared';

export interface CloudflareDnsRecord {
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

interface CloudflareZoneRaw {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  name_servers?: string[];
}

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

    const data = (await res.json()) as { success: boolean; result?: CloudflareZoneRaw[] };
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
    return cache?.recordsByDomain ?? byDomain;
  }

  return byDomain;
}

export async function getCloudflareZones(apiToken: string | undefined): Promise<CloudflareZoneSummary[]> {
  if (!apiToken) return [];
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { success: boolean; result?: CloudflareZoneRaw[] };
    if (!data.success || !data.result) return [];

    return data.result.map((z) => ({
      id: z.id,
      name: z.name,
      status: z.status,
      paused: Boolean(z.paused),
      type: z.type,
      nameServers: z.name_servers ?? [],
    }));
  } catch {
    return [];
  }
}

export async function getZoneDnsRecords(apiToken: string | undefined, zoneId: string): Promise<CloudflareDnsItem[]> {
  if (!apiToken || !zoneId) return [];
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      success: boolean;
      result?: Array<{
        id: string;
        type: string;
        name: string;
        content: string;
        proxiable: boolean;
        proxied: boolean;
        ttl: number;
        comment?: string;
      }>;
    };
    if (!data.success || !data.result) return [];

    return data.result.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      content: r.content,
      proxiable: Boolean(r.proxiable),
      proxied: Boolean(r.proxied),
      ttl: r.ttl,
      comment: r.comment,
    }));
  } catch {
    return [];
  }
}

export async function createCloudflareDnsRecord(
  apiToken: string | undefined,
  zoneId: string,
  record: { type: string; name: string; content: string; proxied: boolean; ttl?: number; comment?: string }
): Promise<{ success: boolean; error?: string; record?: CloudflareDnsItem }> {
  if (!apiToken) return { success: false, error: 'CLOUDFLARE_API_TOKEN is not configured' };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied,
        ttl: record.ttl || 1, // 1 = auto
        comment: record.comment,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as {
      success: boolean;
      errors?: Array<{ message: string }>;
      result?: { id: string; type: string; name: string; content: string; proxiable: boolean; proxied: boolean; ttl: number; comment?: string };
    };
    if (!data.success || !data.result) {
      return { success: false, error: data.errors?.[0]?.message || 'Failed to create DNS record' };
    }
    cache = null;
    return {
      success: true,
      record: {
        id: data.result.id,
        type: data.result.type,
        name: data.result.name,
        content: data.result.content,
        proxiable: Boolean(data.result.proxiable),
        proxied: Boolean(data.result.proxied),
        ttl: data.result.ttl,
        comment: data.result.comment,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCloudflareDnsRecord(
  apiToken: string | undefined,
  zoneId: string,
  recordId: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiToken) return { success: false, error: 'CLOUDFLARE_API_TOKEN is not configured' };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { success: boolean; errors?: Array<{ message: string }> };
    if (!data.success) {
      return { success: false, error: data.errors?.[0]?.message || 'Failed to delete DNS record' };
    }
    cache = null;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function purgeCloudflareCache(
  apiToken: string | undefined,
  zoneId: string,
  purgeEverything = true,
  files?: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!apiToken) return { success: false, error: 'CLOUDFLARE_API_TOKEN is not configured' };
  try {
    const body = purgeEverything || !files?.length ? { purge_everything: true } : { files };
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { success: boolean; errors?: Array<{ message: string }> };
    if (!data.success) {
      return { success: false, error: data.errors?.[0]?.message || 'Failed to purge cache' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getCloudflareSecurityLevel(apiToken: string | undefined, zoneId: string): Promise<string> {
  if (!apiToken || !zoneId) return 'medium';
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/security_level`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return 'medium';
    const data = (await res.json()) as { success: boolean; result?: { value: string } };
    return data.success && data.result?.value ? data.result.value : 'medium';
  } catch {
    return 'medium';
  }
}

export async function setCloudflareSecurityLevel(
  apiToken: string | undefined,
  zoneId: string,
  level: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiToken) return { success: false, error: 'CLOUDFLARE_API_TOKEN is not configured' };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/security_level`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: level }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { success: boolean; errors?: Array<{ message: string }> };
    if (!data.success) {
      return { success: false, error: data.errors?.[0]?.message || 'Failed to update security level' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
