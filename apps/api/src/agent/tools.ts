import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const execAsync = promisify(exec);

// Allowed repositories directory on the VPS
export const REPOS_BASE = process.env.REPOS_BASE ?? '/home/adminnico/repositories';
export const GENERAL_CONTEXT = '__general__';

export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AgentToolResult {
  toolCallId: string;
  name: string;
  output: string;
  isError?: boolean;
}

export interface AgentRepoOption {
  name: string;
  fullName: string;
  description: string;
  isPrivate: boolean;
  local: boolean;
  updatedAt?: string;
}

let cachedRepos: { expiresAt: number; data: AgentRepoOption[] } | null = null;

export async function listAvailableRepos(): Promise<AgentRepoOption[]> {
  if (cachedRepos && cachedRepos.expiresAt > Date.now()) {
    return cachedRepos.data;
  }

  const localNames = new Set<string>();
  if (existsSync(REPOS_BASE)) {
    try {
      for (const entry of readdirSync(REPOS_BASE, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          localNames.add(entry.name);
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  const repoMap = new Map<string, AgentRepoOption>();

  for (const name of localNames) {
    repoMap.set(name, {
      name,
      fullName: `guzmannicolas/${name}`,
      description: 'Local repository on VPS',
      isPrivate: false,
      local: true,
    });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    try {
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'control-center-agent',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const ghRepos = (await res.json()) as Array<{
          name: string;
          full_name: string;
          description: string | null;
          private: boolean;
          updated_at: string;
        }>;
        for (const gh of ghRepos) {
          const isLocal = localNames.has(gh.name);
          repoMap.set(gh.name, {
            name: gh.name,
            fullName: gh.full_name,
            description: gh.description ?? '',
            isPrivate: gh.private,
            local: isLocal,
            updatedAt: gh.updated_at,
          });
        }
      }
    } catch {
      // Fall back to local repositories if GitHub API is unreachable
    }
  }

  const result = Array.from(repoMap.values()).sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    return a.name.localeCompare(b.name);
  });

  cachedRepos = { expiresAt: Date.now() + 30_000, data: result };
  return result;
}

export async function ensureRepoCloned(repo: string): Promise<{ cloned: boolean; error?: string }> {
  if (!repo || repo === GENERAL_CONTEXT) return { cloned: false };
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return { cloned: false, error: `Invalid repository name: ${repo}` };
  }

  const repoDir = resolve(REPOS_BASE, repo);
  if (existsSync(repoDir)) {
    return { cloned: false };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const cloneUrl = githubToken
    ? `https://x-access-token:${githubToken}@github.com/guzmannicolas/${repo}.git`
    : `https://github.com/guzmannicolas/${repo}.git`;

  try {
    await execAsync(`git clone ${cloneUrl} "${repoDir}"`, {
      cwd: REPOS_BASE,
      timeout: 60_000,
    });
    cachedRepos = null; // Invalidate repo cache so it shows as local next time
    return { cloned: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Redact token from any error output
    const safeMsg = githubToken ? msg.replaceAll(githubToken, '***') : msg;
    return { cloned: false, error: safeMsg };
  }
}

export function sanitizePath(repo: string, relPath: string): string {
  const baseDir = !repo || repo === GENERAL_CONTEXT ? resolve(REPOS_BASE) : resolve(REPOS_BASE, repo);
  const cleanRel = relPath.replace(/^\/+/, '');
  const target = resolve(baseDir, cleanRel);
  if (!target.startsWith(baseDir)) {
    throw new Error(`Path traversal denied: ${relPath}`);
  }
  return target;
}

export async function executeTool(
  repo: string,
  call: AgentToolCall
): Promise<AgentToolResult> {
  const { id, name, args } = call;
  const cwd = !repo || repo === GENERAL_CONTEXT ? resolve(REPOS_BASE) : resolve(REPOS_BASE, repo);

  try {
    switch (name) {
      case 'read_file': {
        const filePath = sanitizePath(repo, String(args.path ?? ''));
        if (!existsSync(filePath)) {
          return { toolCallId: id, name, output: `File not found: ${args.path}`, isError: true };
        }
        const content = readFileSync(filePath, 'utf8');
        return { toolCallId: id, name, output: content.slice(0, 50_000) };
      }

      case 'write_file': {
        const filePath = sanitizePath(repo, String(args.path ?? ''));
        writeFileSync(filePath, String(args.content ?? ''), 'utf8');
        return { toolCallId: id, name, output: `Successfully wrote ${args.path}` };
      }

      case 'edit_file': {
        const filePath = sanitizePath(repo, String(args.path ?? ''));
        if (!existsSync(filePath)) {
          return { toolCallId: id, name, output: `File not found: ${args.path}`, isError: true };
        }
        let content = readFileSync(filePath, 'utf8');
        const target = String(args.target ?? '');
        const replacement = String(args.replacement ?? '');
        if (!content.includes(target)) {
          return { toolCallId: id, name, output: `Target text not found in ${args.path}`, isError: true };
        }
        content = content.replace(target, () => replacement);
        writeFileSync(filePath, content, 'utf8');
        return { toolCallId: id, name, output: `Successfully updated ${args.path}` };
      }

      case 'list_files': {
        const targetDir = sanitizePath(repo, String(args.path ?? ''));
        if (!existsSync(targetDir)) {
          return { toolCallId: id, name, output: `Directory not found: ${args.path}`, isError: true };
        }
        const entries = readdirSync(targetDir, { withFileTypes: true });
        const list = entries
          .filter((e) => !['.git', 'node_modules', '.next', 'dist'].includes(e.name))
          .map((e) => `${e.isDirectory() ? '[DIR] ' : '      '}${e.name}`)
          .slice(0, 100)
          .join('\n');
        return { toolCallId: id, name, output: list || '(empty directory)' };
      }

      case 'run_command': {
        const cmd = String(args.command ?? '');
        // Block dangerously destructive commands
        if (cmd.match(/\brm\s+-rf\s+\/|\bmkfs\b|\bdd\s+if=/)) {
          return { toolCallId: id, name, output: 'Command blocked by security policy', isError: true };
        }
        const { stdout, stderr } = await execAsync(cmd, {
          cwd,
          timeout: 45_000,
          maxBuffer: 1024 * 1024 * 2, // 2MB
        });
        const out = stdout.trim() + (stderr ? `\nSTDERR:\n${stderr.trim()}` : '');
        return { toolCallId: id, name, output: out || '(empty output)' };
      }

      default:
        return { toolCallId: id, name, output: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { toolCallId: id, name, output: `Error: ${msg}`, isError: true };
  }
}
