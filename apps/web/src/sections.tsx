import type { ComponentType } from 'react';
import {
  AgentIcon,
  BackupIcon,
  CloudflareIcon,
  DatabaseIcon,
  DeployIcon,
  DomainIcon,
  ImprovementIcon,
  LearningIcon,
  LeadsIcon,
  OverviewIcon,
  TerminalIcon,
  VercelIcon,
  VpsIcon,
} from './components/Icons.tsx';
import { DatabasesPage } from './pages/Databases.tsx';
import { DomainsPage } from './pages/Domains.tsx';
import { ImprovementsPage } from './pages/Improvements.tsx';
import { LearningPage } from './pages/Learning.tsx';
import { OverviewPage } from './pages/Overview.tsx';
import { TerminalPage } from './pages/Terminal.tsx';
import { AgentsPage } from './pages/Agents.tsx';
import { VercelPage } from './pages/Vercel.tsx';
import { BackupsPage } from './pages/Backups.tsx';
import { VpsPage } from './pages/Vps.tsx';
import { LeadsPage } from './pages/Leads.tsx';
import { DeploysPage } from './pages/Deploys.tsx';
import { CloudflarePage } from './pages/Cloudflare.tsx';

export interface Section {
  path: string;
  label: string;
  Icon: ComponentType;
  Page: ComponentType;
}

// Every part of the control center is one entry here: the menu, the URLs and the pages come from this list.
export const SECTIONS: Section[] = [
  { path: '/', label: 'Overview', Icon: OverviewIcon, Page: OverviewPage },
  { path: '/leads', label: 'Sales', Icon: LeadsIcon, Page: LeadsPage },
  { path: '/vps', label: 'VPS', Icon: VpsIcon, Page: VpsPage },
  { path: '/deploys', label: 'Deploys', Icon: DeployIcon, Page: DeploysPage },
  { path: '/vercel', label: 'Vercel', Icon: VercelIcon, Page: VercelPage },
  { path: '/cloudflare', label: 'Cloudflare', Icon: CloudflareIcon, Page: CloudflarePage },
  { path: '/backups', label: 'Backups', Icon: BackupIcon, Page: BackupsPage },
  { path: '/domains', label: 'Domains', Icon: DomainIcon, Page: DomainsPage },
  { path: '/databases', label: 'Databases', Icon: DatabaseIcon, Page: DatabasesPage },
  { path: '/agents', label: 'Agents', Icon: AgentIcon, Page: AgentsPage },
  { path: '/terminal', label: 'Terminal', Icon: TerminalIcon, Page: TerminalPage },
  { path: '/improvements', label: 'Improvements', Icon: ImprovementIcon, Page: ImprovementsPage },
  { path: '/learning', label: 'Learning', Icon: LearningIcon, Page: LearningPage },
];
