import { CheckOutcome, type CheckStatus } from '@cc/shared';
import { checkerById } from './checkers/index.js';
import { errorReason, type Checker, type CheckTarget } from './checkers/define.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { withTimeout } from './lib/timeout.js';

const error = (message: string): CheckOutcome => ({ status: 'error', message, metrics: {} });

// Runs one checker safely: a missing, misconfigured, crashing or hanging checker becomes an "error" result.
export async function executeCheck(
  checker: Checker | undefined,
  target: CheckTarget,
  rawSettings: unknown,
  { timeoutMs = 30_000, now = new Date() } = {},
): Promise<{ outcome: CheckOutcome; durationMs: number }> {
  const started = performance.now();
  const outcome = await attempt();
  return { outcome, durationMs: Math.round(performance.now() - started) };

  async function attempt(): Promise<CheckOutcome> {
    if (!checker) return error('Unknown checker');
    if (!checker.appliesTo.includes(target.type)) return error(`${checker.id} does not apply to a ${target.type}`);
    const settings = checker.settings.safeParse(rawSettings);
    if (!settings.success) return error(`Invalid settings: ${settings.error.issues[0]?.message ?? 'unknown'}`);

    const controller = new AbortController();
    try {
      const result = await withTimeout(checker.run(target, settings.data, { signal: controller.signal, now }), timeoutMs);
      return CheckOutcome.parse(result);
    } catch (err) {
      return error(`Check could not run: ${errorReason(err)}`);
    } finally {
      controller.abort(); // stop whatever the checker left running
    }
  }
}

export type IncidentAction =
  | { kind: 'none' }
  | { kind: 'open' | 'update'; severity: 'warn' | 'fail' }
  | { kind: 'resolve' };

// "error" means we could not look, so it neither opens nor closes anything.
export function decideIncident(hasOpenIncident: boolean, status: CheckStatus): IncidentAction {
  if (status === 'error') return { kind: 'none' };
  if (status === 'ok') return hasOpenIncident ? { kind: 'resolve' } : { kind: 'none' };
  return { kind: hasOpenIncident ? 'update' : 'open', severity: status };
}

// One transaction: the result, the monitor's latest status and the incident change are saved together or not at all.
export function recordOutcome(prisma: PrismaClient, monitorId: string, outcome: CheckOutcome, durationMs: number, checkedAt: Date) {
  return prisma.$transaction(async (tx) => {
    const { status, message, metrics } = outcome;
    await tx.result.create({ data: { monitorId, checkedAt, status, durationMs, message, metrics } });
    await tx.monitor.update({ where: { id: monitorId }, data: { lastStatus: status, lastCheckedAt: checkedAt } });

    const open = await tx.incident.findFirst({ where: { monitorId, resolvedAt: null } });
    const action = decideIncident(open !== null, status);
    if (action.kind === 'open') {
      await tx.incident.create({ data: { monitorId, severity: action.severity, openedAt: checkedAt, lastMessage: message } });
    } else if (action.kind === 'update' && open) {
      await tx.incident.update({ where: { id: open.id }, data: { severity: action.severity, lastMessage: message } });
    } else if (action.kind === 'resolve' && open) {
      await tx.incident.update({ where: { id: open.id }, data: { resolvedAt: checkedAt } });
    }
    return action;
  });
}

export async function runMonitor(prisma: PrismaClient, monitorId: string) {
  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId }, include: { target: true } });
  if (!monitor?.enabled || !monitor.target.enabled) return null;

  const checkedAt = new Date();
  const { outcome, durationMs } = await executeCheck(checkerById.get(monitor.checker), monitor.target, monitor.settings, { now: checkedAt });
  const incident = await recordOutcome(prisma, monitor.id, outcome, durationMs, checkedAt);
  return { target: monitor.target.name, checker: monitor.checker, outcome, durationMs, incident };
}
