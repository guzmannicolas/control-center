import { randomUUID } from 'node:crypto';
import type { IMcpAuditLogger, McpAccessLogEntry } from './types.js';

class McpAuditLogger implements IMcpAuditLogger {
  private buffer: McpAccessLogEntry[] = [];
  private maxBufferSize = 500;
  private clientCallCounts = new Map<string, { calls: number; lastSeen: string | null }>();

  async logAccess(entry: Omit<McpAccessLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const fullEntry: McpAccessLogEntry = {
      id: randomUUID(),
      timestamp,
      ...entry,
    };

    this.buffer.unshift(fullEntry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.pop();
    }

    const current = this.clientCallCounts.get(entry.clientName) || { calls: 0, lastSeen: null };
    current.calls += 1;
    current.lastSeen = timestamp;
    this.clientCallCounts.set(entry.clientName, current);
  }

  async getRecentLogs(limit = 50): Promise<McpAccessLogEntry[]> {
    return this.buffer.slice(0, Math.min(limit, this.maxBufferSize));
  }

  async getClientStats(): Promise<Array<{ clientName: string; totalCalls: number; lastSeen: string | null }>> {
    const stats: Array<{ clientName: string; totalCalls: number; lastSeen: string | null }> = [];
    for (const [clientName, val] of this.clientCallCounts.entries()) {
      stats.push({
        clientName,
        totalCalls: val.calls,
        lastSeen: val.lastSeen,
      });
    }
    return stats.sort((a, b) => b.totalCalls - a.totalCalls);
  }
}

export const mcpAuditLogger = new McpAuditLogger();
