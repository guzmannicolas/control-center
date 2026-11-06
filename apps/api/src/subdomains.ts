import { type CheckStatus, type SubdomainView, worstStatus } from '@cc/shared';

interface WatchedSite {
  id: string;
  name: string;
  url: string;
  host: string;
  status: CheckStatus | null;
}

// Hosts strictly under `domain` (blog.example.com for example.com), one entry per host, sorted by name.
// The match is on whole labels, so notexample.com is never mistaken for a subdomain of example.com.
export function subdomainsOf(domain: string, sites: WatchedSite[]): SubdomainView[] {
  const byHost = new Map<string, SubdomainView['targets']>();
  for (const { host, ...target } of sites) {
    if (!host.endsWith(`.${domain}`)) continue;
    byHost.set(host, [...(byHost.get(host) ?? []), target]);
  }
  return [...byHost.entries()]
    .map(([host, targets]): SubdomainView => {
      const known = targets.flatMap((t) => (t.status ? [t.status] : []));
      return { host, status: known.length ? worstStatus(known) : null, targets };
    })
    .sort((a, b) => a.host.localeCompare(b.host));
}
