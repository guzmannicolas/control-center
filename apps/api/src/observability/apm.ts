import type { ApiMetricsView } from '@cc/shared';

interface RequestSample {
  timestamp: number;
  durationMs: number;
  statusCode: number;
  route: string;
  method: string;
}

interface RouteStat {
  route: string;
  method: string;
  calls: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

class ApmCollector {
  private samples: RequestSample[] = [];
  private maxSamples = 2000;
  private routeStats = new Map<string, RouteStat>();
  private status2xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private totalRequests = 0;
  private startTime = Date.now();

  record(method: string, route: string, statusCode: number, durationMs: number) {
    const now = Date.now();
    this.totalRequests++;

    if (statusCode >= 200 && statusCode < 400) {
      this.status2xx++;
    } else if (statusCode >= 400 && statusCode < 500) {
      this.status4xx++;
    } else if (statusCode >= 500) {
      this.status5xx++;
    }

    this.samples.push({
      timestamp: now,
      durationMs,
      statusCode,
      route,
      method,
    });

    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }

    // Update route stats
    const key = `${method} ${route}`;
    let stat = this.routeStats.get(key);
    if (!stat) {
      stat = { route, method, calls: 0, totalDurationMs: 0, maxDurationMs: 0 };
      this.routeStats.set(key, stat);
    }
    stat.calls++;
    stat.totalDurationMs += durationMs;
    if (durationMs > stat.maxDurationMs) {
      stat.maxDurationMs = durationMs;
    }
  }

  getMetrics(): ApiMetricsView {
    const now = Date.now();
    // Sliding 60-second window for RPM
    const oneMinuteAgo = now - 60_000;
    const recentWindow = this.samples.filter((s) => s.timestamp >= oneMinuteAgo);
    const rpm = recentWindow.length;

    // Latency percentiles over available samples
    const durations = this.samples.map((s) => s.durationMs).sort((a, b) => a - b);
    const count = durations.length;

    let p50Ms = 0;
    let p95Ms = 0;
    let p99Ms = 0;
    let avgMs = 0;

    if (count > 0) {
      const sum = durations.reduce((acc, v) => acc + v, 0);
      avgMs = Math.round(sum / count);
      p50Ms = durations[Math.floor(count * 0.50)] ?? 0;
      p95Ms = durations[Math.floor(count * 0.95)] ?? 0;
      p99Ms = durations[Math.floor(count * 0.99)] ?? 0;
    }

    // Top slow routes
    const topSlow = Array.from(this.routeStats.values())
      .map((r) => ({
        route: r.route,
        method: r.method,
        calls: r.calls,
        avgDurationMs: Math.round(r.totalDurationMs / r.calls),
        maxDurationMs: Math.round(r.maxDurationMs),
      }))
      .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
      .slice(0, 10);

    return {
      totalRequests: this.totalRequests,
      requestsPerMinute: rpm,
      statusCodes: {
        status2xx: this.status2xx,
        status4xx: this.status4xx,
        status5xx: this.status5xx,
      },
      latency: {
        avgMs,
        p50Ms,
        p95Ms,
        p99Ms,
      },
      topSlowRoutes: topSlow,
    };
  }
}

export const apm = new ApmCollector();
