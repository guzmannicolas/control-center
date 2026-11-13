export interface McpClientIdentity {
  id: string;
  name: string;
  role: 'admin' | 'collaborator' | 'read-only';
  enabled: boolean;
  rateLimitPerMinute: number;
}

export interface McpTokenRecord {
  id: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string; // First 8 chars for identification (e.g. "mcp_live_...")
  role: 'admin' | 'collaborator' | 'read-only';
  enabled: boolean;
  rateLimitPerMinute: number;
  createdAt: string;
  lastUsedAt: string | null;
  createdBy?: string;
  expiresAt?: string | null;
}

export interface McpAccessLogEntry {
  id: string;
  timestamp: string;
  clientId: string;
  clientName: string;
  ip: string;
  method: string;
  toolName?: string;
  status: 'ok' | 'error' | 'rejected' | 'rate_limited';
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface McpToolContext {
  client: McpClientIdentity;
  ip: string;
}

export interface McpToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: TArgs, ctx: McpToolContext): Promise<TResult> | TResult;
}

export interface IMcpAuthenticator {
  authenticate(headers: Record<string, string | string[] | undefined>): Promise<McpClientIdentity | null>;
  createToken(name: string, role?: 'admin' | 'collaborator' | 'read-only', rateLimit?: number): Promise<{ token: string; record: McpTokenRecord }>;
  listTokens(): Promise<Omit<McpTokenRecord, 'tokenHash'>[]>;
  revokeToken(id: string): Promise<boolean>;
}

export interface IMcpAuditLogger {
  logAccess(entry: Omit<McpAccessLogEntry, 'id' | 'timestamp'>): Promise<void>;
  getRecentLogs(limit?: number): Promise<McpAccessLogEntry[]>;
  getClientStats(): Promise<Array<{ clientName: string; totalCalls: number; lastSeen: string | null }>>;
}

export interface IMcpToolRegistry {
  registerTool(tool: McpToolDefinition<any, any>): void;
  getTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  executeTool(name: string, args: Record<string, unknown>, ctx: McpToolContext): Promise<unknown>;
}
