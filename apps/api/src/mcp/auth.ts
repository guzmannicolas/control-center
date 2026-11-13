import { createHash, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { IMcpAuthenticator, McpClientIdentity, McpTokenRecord } from './types.js';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export class McpAuthenticator implements IMcpAuthenticator {
  private storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath =
      storagePath ||
      process.env.MCP_TOKENS_FILE ||
      (process.env.VAULT_STORAGE_FILE
        ? join(dirname(process.env.VAULT_STORAGE_FILE), 'mcp_tokens.json')
        : join(process.cwd(), 'knowledge', 'mcp_tokens.json'));
  }

  private loadTokens(): McpTokenRecord[] {
    if (!existsSync(this.storagePath)) {
      return [];
    }
    try {
      const raw = readFileSync(this.storagePath, 'utf8');
      return JSON.parse(raw) as McpTokenRecord[];
    } catch {
      return [];
    }
  }

  private saveTokens(tokens: McpTokenRecord[]): void {
    const dir = dirname(this.storagePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.storagePath, JSON.stringify(tokens, null, 2), 'utf8');
  }

  async authenticate(headers: Record<string, string | string[] | undefined>): Promise<McpClientIdentity | null> {
    const authHeader = typeof headers.authorization === 'string' ? headers.authorization : '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const mcpHeader = typeof headers['x-mcp-token'] === 'string' ? headers['x-mcp-token'].trim() : '';
    const candidate = bearer || mcpHeader;

    if (!candidate) {
      return null;
    }

    // 1. Check against master environment token (backwards compatibility)
    const masterToken = process.env.MCP_API_TOKEN;
    if (masterToken && safeEquals(candidate, masterToken)) {
      return {
        id: 'master-token',
        name: 'Master Admin (.env)',
        role: 'admin',
        enabled: true,
        rateLimitPerMinute: 300,
      };
    }

    // 2. Check against collaborator tokens
    const candidateHash = hashToken(candidate);
    const tokens = this.loadTokens();
    const match = tokens.find((t) => t.enabled && safeEquals(t.tokenHash, candidateHash));

    if (!match) {
      return null;
    }

    // Check expiration if set
    if (match.expiresAt && new Date(match.expiresAt).getTime() < Date.now()) {
      return null;
    }

    // Update lastUsed timestamp asynchronously
    match.lastUsedAt = new Date().toISOString();
    try {
      this.saveTokens(tokens);
    } catch {
      // non-blocking
    }

    return {
      id: match.id,
      name: match.name,
      role: match.role,
      enabled: match.enabled,
      rateLimitPerMinute: match.rateLimitPerMinute,
    };
  }

  async createToken(
    name: string,
    role: 'admin' | 'collaborator' | 'read-only' = 'collaborator',
    rateLimit = 60
  ): Promise<{ token: string; record: McpTokenRecord }> {
    const rawSecret = `mcp_live_${randomBytes(24).toString('hex')}`;
    const id = randomUUID();
    const now = new Date().toISOString();

    const record: McpTokenRecord = {
      id,
      name: name.trim(),
      tokenHash: hashToken(rawSecret),
      tokenPrefix: rawSecret.slice(0, 12),
      role,
      enabled: true,
      rateLimitPerMinute: rateLimit,
      createdAt: now,
      lastUsedAt: null,
    };

    const tokens = this.loadTokens();
    tokens.push(record);
    this.saveTokens(tokens);

    return { token: rawSecret, record };
  }

  async listTokens(): Promise<Omit<McpTokenRecord, 'tokenHash'>[]> {
    const tokens = this.loadTokens();
    return tokens.map(({ tokenHash: _, ...rest }) => rest);
  }

  async revokeToken(id: string): Promise<boolean> {
    const tokens = this.loadTokens();
    const index = tokens.findIndex((t) => t.id === id);
    if (index === -1) return false;

    const item = tokens[index];
    if (item) {
      item.enabled = false;
      this.saveTokens(tokens);
      return true;
    }
    return false;
  }
}

export const mcpAuthenticator = new McpAuthenticator();
