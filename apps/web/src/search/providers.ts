import type { TargetView } from '@cc/shared';
import type { SearchProvider, SearchableItem } from './types.ts';
import { SECTIONS, type Section } from '../sections.tsx';
import {
  DomainIcon,
  DatabaseIcon,
  VpsIcon,
  McpIcon,
  OverviewIcon,
  DeployIcon,
} from '../components/Icons.tsx';

// Mapping keywords to navigation routes to improve discoverability
const SECTION_KEYWORDS: Record<string, string[]> = {
  '/': ['dashboard', 'home', 'status', 'monitors', 'metrics'],
  '/vps': ['contabo', 'server', 'docker', 'containers', 'cpu', 'memory', 'disk', 'security', 'hardening'],
  '/vault': ['secrets', 'env', 'tokens', 'keys', 'encryption', 'credentials', 'password'],
  '/mcp': ['mcp hub', 'model context protocol', 'ai tools', 'json-rpc', 'cursor', 'claude', 'antigravity'],
  '/observability': ['apm', 'traces', 'llm', 'telemetry', 'latency', 'queues', 'bullmq', 'tokens'],
  '/databases': ['postgres', 'redis', 'sql', 'tables', 'queries', 'storage', 'data'],
  '/domains': ['dns', 'cloudflare', 'nameservers', 'registrar', 'whois', 'ssl'],
  '/deploys': ['deployments', 'ci', 'cd', 'builds', 'git', 'release'],
  '/vercel': ['frontend', 'edge', 'functions', 'serverless', 'projects'],
  '/cloudflare': ['proxy', 'cdn', 'waf', 'tunnel', 'zero trust', 'dns records'],
  '/backups': ['snapshots', 'retention', 'archive', 'tar', 'recovery', 'b2'],
  '/agents': ['autonomous', 'ai', 'workers', 'chat', 'intelligence'],
  '/terminal': ['ssh', 'bash', 'shell', 'console', 'ttyd', 'cli'],
  '/knowledge': ['docs', 'architecture', 'schema', 'playbooks', 'skills', 'wiki'],
  '/marketing': ['campaigns', 'ads', 'leads', 'social', 'instagram', 'facebook'],
  '/leads': ['sales', 'crm', 'clients', 'whatsapp', 'prospects'],
  '/deals': ['promociones', 'discounts', 'pricing', 'offers'],
  '/files': ['filesystem', 'explorer', 'browse', 'directory', 'storage'],
  '/improvements': ['tasks', 'roadmap', 'todos', 'backlog'],
  '/learning': ['notes', 'knowledge', 'study', 'education'],
};

/**
 * Provider for static application navigation and section links.
 */
export class NavigationSearchProvider implements SearchProvider {
  readonly name = 'Navigation';

  provide(): SearchableItem[] {
    return SECTIONS.map((sec: Section) => ({
      id: `nav-${sec.path}`,
      title: sec.label,
      subtitle: `Go to ${sec.label} (${sec.path})`,
      category: 'Navigation',
      path: sec.path,
      icon: sec.Icon,
      keywords: SECTION_KEYWORDS[sec.path] || [],
    }));
  }
}

/**
 * Provider for monitored targets (websites, services, github repos, vercel projects).
 */
export class TargetsSearchProvider implements SearchProvider {
  readonly name = 'Targets & Services';
  private targets: TargetView[];

  constructor(targets: TargetView[] = []) {
    this.targets = targets;
  }

  provide(): SearchableItem[] {
    return this.targets.map((target) => {
      let category: SearchableItem['category'] = 'Services';
      let icon = OverviewIcon;
      let path = '/';

      if (target.type === 'database') {
        category = 'Databases';
        icon = DatabaseIcon;
        path = '/databases';
      } else if (target.type === 'domain') {
        category = 'Domains';
        icon = DomainIcon;
        path = '/domains';
      } else if (target.type === 'vercel_project') {
        category = 'Services';
        icon = DeployIcon;
        path = '/vercel';
      }

      return {
        id: `target-${target.id}`,
        title: target.name,
        subtitle: `${target.type} · ${target.monitors.length} monitor(s)`,
        category,
        path,
        url: target.url || undefined,
        status: target.status,
        tags: target.tags,
        keywords: [target.type, ...(target.tags || []), 'target', 'monitor', 'service'],
        icon,
      };
    });
  }
}

/**
 * Provider for Docker containers running on the VPS.
 */
export class ContainersSearchProvider implements SearchProvider {
  readonly name = 'Docker Containers';
  private containers: Array<{ name: string; image: string; status: string; state: string }>;

  constructor(containers: Array<{ name: string; image: string; status: string; state: string }> = []) {
    this.containers = containers;
  }

  provide(): SearchableItem[] {
    return this.containers.map((c) => {
      const isRunning = c.state.toLowerCase() === 'running' || c.status.toLowerCase().includes('up');

      return {
        id: `container-${c.name}`,
        title: c.name,
        subtitle: `${c.image} (${c.status})`,
        category: 'Containers',
        path: '/vps',
        status: isRunning ? 'running' : 'exited',
        keywords: [
          'docker',
          'container',
          'vps',
          'process',
          c.image,
          c.name.replace(/[-_]/g, ' '),
        ],
        icon: VpsIcon,
      };
    });
  }
}

/**
 * Provider for MCP servers and exposed tools.
 */
export class McpSearchProvider implements SearchProvider {
  readonly name = 'MCP Hub';
  private servers: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    tools: Array<{ name: string; description: string }>;
  }>;

  constructor(
    servers: Array<{
      id: string;
      name: string;
      description: string;
      status: string;
      tools: Array<{ name: string; description: string }>;
    }> = []
  ) {
    this.servers = servers;
  }

  provide(): SearchableItem[] {
    const items: SearchableItem[] = [];

    for (const s of this.servers) {
      // Add server
      items.push({
        id: `mcp-server-${s.id}`,
        title: s.name,
        subtitle: `MCP Server · ${s.tools.length} tool(s) · ${s.description}`,
        category: 'Tools & MCP',
        path: '/mcp',
        status: s.status as SearchableItem['status'],
        keywords: ['mcp', 'server', 'ai', 'tools', s.name],
        icon: McpIcon,
      });

      // Add individual tools exposed by this server
      for (const tool of s.tools) {
        items.push({
          id: `mcp-tool-${s.id}-${tool.name}`,
          title: tool.name,
          subtitle: `Tool on ${s.name}: ${tool.description}`,
          category: 'Tools & MCP',
          path: '/mcp',
          keywords: ['mcp', 'tool', s.name, tool.name.replace(/_/g, ' ')],
          icon: McpIcon,
        });
      }
    }

    return items;
  }
}
