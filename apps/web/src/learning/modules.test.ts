import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ModuleId } from '@cc/shared';
import { describe, expect, it } from 'vitest';
import { MODULES } from './modules.ts';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

describe('learning modules', () => {
  it('have unique ids the API accepts', () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(ModuleId.safeParse(id).success, id).toBe(true);
  });

  it('only link to files that exist, so links cannot rot when code moves', () => {
    const missing = MODULES.flatMap((m) => m.inProject.map((f) => f.path)).filter((p) => !existsSync(repoRoot + p));
    expect(missing).toEqual([]);
  });

  it('have quizzes whose answers point at a real option', () => {
    for (const m of MODULES) {
      expect(m.quiz.length, m.id).toBeGreaterThanOrEqual(3);
      for (const q of m.quiz) expect(q.options[q.answer], `${m.id}: ${q.q}`).toBeDefined();
    }
  });
});
