import type { DatabaseView } from '@cc/shared';
import { describe, expect, it } from 'vitest';
import { groupByProject, needsAttention } from './projects.ts';

const db = (name: string, engine: 'postgres' | 'redis', project: string | null, status: DatabaseView['status'] = 'ok'): DatabaseView =>
  ({ id: name, name, engine, purpose: '', project, status, health: null, backup: null });

describe('groupByProject', () => {
  it('puts the database before its cache inside a project', () => {
    const [cms] = groupByProject([db('CMS cache', 'redis', 'CMS'), db('CMS database', 'postgres', 'CMS')]);
    expect(cms?.project).toBe('CMS');
    expect(cms?.databases.map((d) => d.name)).toEqual(['CMS database', 'CMS cache']);
  });

  it('orders projects by need for attention, then name, with "Other" last', () => {
    const groups = groupByProject([
      db('Loose', 'postgres', null, 'fail'),
      db('A db', 'postgres', 'Alpha'),
      db('B db', 'postgres', 'Beta', 'warn'),
    ]);
    expect(groups.map((g) => g.project)).toEqual(['Beta', 'Alpha', 'Other']);
  });

  it('takes the worst status of its databases', () => {
    const [group] = groupByProject([db('db', 'postgres', 'CMS', 'ok'), db('cache', 'redis', 'CMS', 'fail')]);
    expect(group?.status).toBe('fail');
  });

  it('has unknown status when nothing has been checked yet', () => {
    expect(groupByProject([db('db', 'postgres', 'CMS', null)])[0]?.status).toBeNull();
  });
});

describe('needsAttention', () => {
  it('is only true for a known status that is not ok', () => {
    expect([needsAttention('ok'), needsAttention(null), needsAttention('warn'), needsAttention('error')]).toEqual([false, false, true, true]);
  });
});
