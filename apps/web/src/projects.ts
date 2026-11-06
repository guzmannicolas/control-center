import { type CheckStatus, type DatabaseView, statusRank, worstStatus } from '@cc/shared';

export const NO_PROJECT = 'Other';

export interface ProjectGroup {
  project: string;
  databases: DatabaseView[];
  status: CheckStatus | null; // worst status among its databases
}

const ENGINE_ORDER = { postgres: 0, redis: 1 } as const;

// Groups databases by project. Groups that need attention come first, "Other" (databases with no
// project) last; inside a group the database comes before its cache, then by name.
export function groupByProject(databases: DatabaseView[]): ProjectGroup[] {
  const groups = new Map<string, DatabaseView[]>();
  for (const db of databases) {
    const key = db.project ?? NO_PROJECT;
    groups.set(key, [...(groups.get(key) ?? []), db]);
  }
  return [...groups.entries()]
    .map(([project, items]): ProjectGroup => {
      const known = items.flatMap((d) => (d.status ? [d.status] : []));
      return {
        project,
        status: known.length ? worstStatus(known) : null,
        databases: [...items].sort((a, b) => ENGINE_ORDER[a.engine] - ENGINE_ORDER[b.engine] || a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) =>
      Number(a.project === NO_PROJECT) - Number(b.project === NO_PROJECT)
      || statusRank(b.status) - statusRank(a.status)
      || a.project.localeCompare(b.project));
}

// Open a project by default only when something in it is not fine.
export const needsAttention = (status: CheckStatus | null) => status !== null && status !== 'ok';
