import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const execAsync = promisify(exec);

// Allowed repositories directory on the VPS
const REPOS_BASE = process.env.REPOS_BASE ?? '/home/adminnico/repositories';

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

export function sanitizePath(repo: string, relPath: string): string {
  const repoDir = resolve(REPOS_BASE, repo);
  const target = resolve(repoDir, relPath);
  if (!target.startsWith(repoDir)) {
    throw new Error(`Path traversal denied: ${relPath}`);
  }
  return target;
}

export async function executeTool(
  repo: string,
  call: AgentToolCall
): Promise<AgentToolResult> {
  const { id, name, args } = call;
  const cwd = resolve(REPOS_BASE, repo);

  try {
    switch (name) {
      case 'read_file': {
        const filePath = sanitizePath(repo, String(args.path));
        if (!existsSync(filePath)) {
          return { toolCallId: id, name, output: `File not found: ${args.path}`, isError: true };
        }
        const content = readFileSync(filePath, 'utf8');
        return { toolCallId: id, name, output: content.slice(0, 50_000) };
      }

      case 'write_file': {
        const filePath = sanitizePath(repo, String(args.path));
        writeFileSync(filePath, String(args.content ?? ''), 'utf8');
        return { toolCallId: id, name, output: `Successfully wrote ${args.path}` };
      }

      case 'edit_file': {
        const filePath = sanitizePath(repo, String(args.path));
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
        return { toolCallId: id, name, output: list };
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
