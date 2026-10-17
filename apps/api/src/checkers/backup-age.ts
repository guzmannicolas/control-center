import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { CheckOutcomeInput } from '@cc/shared';
import { defineChecker } from './define.js';

// The backup script logs one "<ISO date> OK <file> <size>" line per successful run.
// Anything it printed since the previous success (notices, errors) belongs to the latest run.
const OK_LINE = /^(\d{4}-\d{2}-\d{2}T\S+) OK (\S+) (\S+)$/;
const NOTICE = /\b(NOTICE|WARN(?:ING)?|ERROR|FATAL)\b:?\s*(.*)$/i;

export function parseBackupLog(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const okIndexes = lines.flatMap((l, i) => (OK_LINE.test(l) ? [i] : []));
  const last = okIndexes.at(-1);
  const collect = (from: number, to: number) => {
    const found = new Map<string, 'notice' | 'error'>();
    for (const line of lines.slice(from, to)) {
      const m = NOTICE.exec(line);
      if (!m) continue;
      const level = /ERROR|FATAL/i.test(m[1]!) ? 'error' : 'notice';
      found.set(m[2]!.slice(0, 240), found.get(m[2]!.slice(0, 240)) === 'error' ? 'error' : level);
    }
    return [...found].map(([message, level]) => ({ level, message }));
  };
  if (last === undefined) return { lastBackup: null, notices: collect(0, lines.length), failedAfter: [] };
  const [, at, file, size] = OK_LINE.exec(lines[last]!)!;
  return {
    lastBackup: { at: new Date(at!).toISOString(), file: file!, size: size! },
    notices: collect((okIndexes.at(-2) ?? -1) + 1, last),
    // Output after the last success means a later run started and did not finish.
    failedAfter: collect(last + 1, lines.length).filter((n) => n.level === 'error'),
  };
}

const Settings = z.object({
  logPath: z.string().min(1),
  destination: z.string().max(200).default(''),
  warnHours: z.number().positive().default(26),
  failHours: z.number().positive().default(50),
});

export function classifyBackup(parsed: ReturnType<typeof parseBackupLog>, now: Date, s: z.output<typeof Settings>): CheckOutcomeInput {
  const warnings = parsed.notices.map((n) => n.message);
  const details = { ...parsed.lastBackup, destination: s.destination, warnings };
  if (!parsed.lastBackup) return { status: 'fail', message: 'No successful backup in the log', details };
  const hours = (now.getTime() - new Date(parsed.lastBackup.at).getTime()) / 3_600_000;
  const metrics = { ageHours: Math.round(hours * 10) / 10 };
  const age = hours < 1 ? 'less than an hour ago' : `${Math.round(hours)} h ago`;
  const base = `Last backup ${age} (${parsed.lastBackup.size})`;
  if (parsed.failedAfter.length) return { status: 'fail', message: `Latest run failed: ${parsed.failedAfter[0]!.message}`, metrics, details };
  if (hours >= s.failHours) return { status: 'fail', message: `${base}: too old`, metrics, details };
  if (hours >= s.warnHours) return { status: 'warn', message: `${base}: last night's run is missing`, metrics, details };
  if (warnings.length) return { status: 'warn', message: `${base} · ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`, metrics, details };
  return { status: 'ok', message: base, metrics, details };
}

export const backupAge = defineChecker({
  id: 'backup-age',
  description: "Reads the backup script's log: when the last good backup ran, its size, and any warnings.",
  appliesTo: ['database'],
  defaultIntervalSeconds: 3600,
  settings: Settings,
  async run(_target, s, ctx) {
    // Missing log = we cannot tell, so this throws and becomes "error", not "fail".
    const text = await readFile(s.logPath, { encoding: 'utf8', signal: ctx.signal });
    return classifyBackup(parseBackupLog(text), ctx.now, s);
  },
});
