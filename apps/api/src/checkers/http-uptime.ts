import { z } from 'zod';
import { USER_AGENT, defineChecker, errorReason, urlOf } from './define.js';

export const httpUptime = defineChecker({
  id: 'http-uptime',
  description: 'Loads the URL and checks the status code and response time.',
  appliesTo: ['website', 'service'],
  defaultIntervalSeconds: 300,
  settings: z.object({
    expectStatus: z.array(z.number().int()).optional(), // default: any 2xx
    followRedirects: z.boolean().default(true),
    expectRedirectTo: z.string().optional(), // e.g. a login page that must stay in front
    slowMs: z.number().int().positive().default(3000),
    timeoutMs: z.number().int().positive().default(10_000),
  }),

  async run(target, s, ctx) {
    const started = performance.now();
    let res: Response;
    try {
      res = await fetch(urlOf(target), {
        redirect: s.followRedirects ? 'follow' : 'manual',
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(s.timeoutMs)]),
      });
    } catch (err) {
      // For uptime, "no answer" is the measurement itself: the site is down.
      return { status: 'fail', message: `No response: ${errorReason(err)}`, metrics: {} };
    }
    const responseMs = Math.round(performance.now() - started);
    await res.body?.cancel();
    const metrics = { responseMs, statusCode: res.status };

    const statusOk = s.expectStatus ? s.expectStatus.includes(res.status) : res.status >= 200 && res.status < 300;
    if (!statusOk) return { status: 'fail', message: `Unexpected HTTP ${res.status}`, metrics };

    if (s.expectRedirectTo) {
      const location = res.headers.get('location') ?? '';
      if (!location.includes(s.expectRedirectTo)) {
        return { status: 'fail', message: `Redirects to "${location || 'nowhere'}", expected ${s.expectRedirectTo}`, metrics };
      }
    }

    if (responseMs > s.slowMs) return { status: 'warn', message: `Slow: HTTP ${res.status} in ${responseMs} ms`, metrics };
    return { status: 'ok', message: `HTTP ${res.status} in ${responseMs} ms`, metrics };
  },
});
