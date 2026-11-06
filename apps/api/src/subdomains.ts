import { type CheckStatus, type SubdomainView, worstStatus } from '@cc/shared';
import type { CloudflareDnsRecord } from './cloudflare.js';

interface WatchedSite {
  id: string;
  name: string;
  url: string;
  host: string;
  status: CheckStatus | null;
}

// Builds the subdomain list for a given apex domain by merging:
// 1. Live DNS records from Cloudflare (A, AAAA, CNAME)
// 2. Targets already configured and monitored in Control Center
export function subdomainsOf(
  domain: string,
  sites: WatchedSite[],
  dnsRecords: CloudflareDnsRecord[] = []
): SubdomainView[] {
  const hostMap = new Map<
    string,
    {
      targets: SubdomainView['targets'];
      dnsType?: string;
      proxied?: boolean;
    }
  >();

  // 1. Populate from Cloudflare DNS records (excluding apex domain)
  for (const record of dnsRecords) {
    if (record.name === domain || !record.name.endsWith(`.${domain}`)) continue;
    hostMap.set(record.name, {
      targets: [],
      dnsType: record.type,
      proxied: record.proxied,
    });
  }

  // 2. Attach watched sites
  for (const { host, ...target } of sites) {
    if (!host.endsWith(`.${domain}`)) continue;
    const existing = hostMap.get(host) ?? { targets: [] };
    existing.targets.push(target);
    hostMap.set(host, existing);
  }

  return [...hostMap.entries()]
    .map(([host, entry]): SubdomainView => {
      const known = entry.targets.flatMap((t) => (t.status ? [t.status] : []));
      return {
        host,
        status: known.length ? worstStatus(known) : null,
        dnsType: entry.dnsType,
        proxied: entry.proxied,
        targets: entry.targets,
      };
    })
    .sort((a, b) => a.host.localeCompare(b.host));
}
