import type { ComponentType } from 'react';
import { DomainIcon, OverviewIcon } from './components/Icons.tsx';
import { DomainsPage } from './pages/Domains.tsx';
import { OverviewPage } from './pages/Overview.tsx';

export interface Section {
  path: string;
  label: string;
  Icon: ComponentType;
  Page: ComponentType;
}

// Every part of the control center is one entry here: the menu, the URLs and the pages come from this list.
export const SECTIONS: Section[] = [
  { path: '/', label: 'Overview', Icon: OverviewIcon, Page: OverviewPage },
  { path: '/domains', label: 'Domains', Icon: DomainIcon, Page: DomainsPage },
];
