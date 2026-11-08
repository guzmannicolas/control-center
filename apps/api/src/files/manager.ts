import { existsSync, promises as fs, statSync } from 'node:fs';
import { basename, extname, join, normalize, relative, resolve, sep } from 'node:path';
import type { DirectoryListing, FileContent, FileItem } from '@cc/shared';

const EDITABLE_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.yml', '.yaml', '.env', '.ts', '.tsx', '.js', '.jsx',
  '.css', '.html', '.sh', '.bash', '.sql', '.toml', '.conf', '.ini', '.xml',
  '.csv', '.log', '.prisma', '.svelte', '.vue', '.graphql', '.gql', '.dockerfile',
]);

const EDITABLE_EXACT_NAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.example', '.env.staging',
  'dockerfile', 'makefile', 'procfile', '.gitignore', '.dockerignore',
  'caddyfile', 'nginx.conf',
]);

export function getFilesRoot(): string {
  if (process.env.VPS_FILES_ROOT) {
    return resolve(process.env.VPS_FILES_ROOT);
  }
  // On the VPS host or inside Docker with /home/adminnico mounted
  if (existsSync('/home/adminnico')) {
    return '/home/adminnico';
  }
  // Fallback in local development
  return process.cwd();
}

/**
 * Resolves and validates a subpath against the files root to prevent path traversal.
 */
export function resolveSafePath(subPath: string = ''): { root: string; fullPath: string; relPath: string } {
  const root = getFilesRoot();
  // Strip leading slashes/backslashes
  const sanitized = subPath.replace(/^(\/|\\)+/, '');
  const fullPath = resolve(root, sanitized);

  // Path traversal guard
  const rel = relative(root, fullPath);
  if (rel.startsWith('..') || (fullPath !== root && !fullPath.startsWith(root + sep))) {
    throw new Error('Access denied: Path traversal attempted.');
  }

  // Normalize relative path with forward slashes for cross-platform frontend consistency
  const relPath = rel ? rel.split(sep).join('/') : '';
  return { root, fullPath, relPath };
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i] ?? 'B'}`;
}

function isFileEditable(name: string, ext: string, size: number): boolean {
  if (size > 2 * 1024 * 1024) return false; // > 2MB cannot be edited in web
  const lowerName = name.toLowerCase();
  if (EDITABLE_EXACT_NAMES.has(lowerName)) return true;
  if (lowerName.startsWith('.env')) return true;
  if (lowerName.startsWith('dockerfile')) return true;
  return EDITABLE_EXTENSIONS.has(ext.toLowerCase());
}

export async function listDirectory(subPath: string = ''): Promise<DirectoryListing> {
  const { root, fullPath, relPath } = resolveSafePath(subPath);

  if (!existsSync(fullPath)) {
    throw new Error(`Directory not found: ${relPath || '/'}`);
  }

  const stat = await fs.stat(fullPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${relPath}`);
  }

  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const items: FileItem[] = [];

  for (const entry of entries) {
    try {
      const entryFullPath = join(fullPath, entry.name);
      let isDir = entry.isDirectory();
      let size = 0;
      let mtime = new Date(0);

      try {
        const itemStat = statSync(entryFullPath);
        isDir = itemStat.isDirectory();
        size = itemStat.size;
        mtime = itemStat.mtime;
      } catch {
        // Ignored if file unreadable/broken symlink
      }

      const itemRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
      const ext = extname(entry.name);

      items.push({
        name: entry.name,
        path: itemRelPath,
        isDirectory: isDir,
        size: isDir ? 0 : size,
        sizeHuman: isDir ? '--' : formatSize(size),
        modifiedAt: mtime.toISOString(),
        extension: isDir ? 'dir' : ext.replace(/^\./, '').toLowerCase(),
        isEditable: !isDir && isFileEditable(entry.name, ext, size),
      });
    } catch {
      // Skip unreadable files
    }
  }

  // Sort: directories first (alphabetical), then files (alphabetical)
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  let parentPath: string | null = null;
  if (relPath) {
    const segments = relPath.split('/');
    segments.pop();
    parentPath = segments.length > 0 ? segments.join('/') : '';
  }

  return {
    currentPath: relPath,
    parentPath,
    baseDir: root,
    items,
  };
}

export async function readFileContent(subPath: string): Promise<FileContent> {
  const { fullPath, relPath } = resolveSafePath(subPath);

  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${relPath}`);
  }

  const stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    throw new Error(`Cannot open directory as a file: ${relPath}`);
  }

  if (stat.size > 2 * 1024 * 1024) {
    throw new Error('File is too large to open in web editor (maximum size is 2MB)');
  }

  const content = await fs.readFile(fullPath, 'utf-8');

  return {
    path: relPath,
    name: basename(fullPath),
    content,
    size: stat.size,
  };
}

export async function writeFileContent(subPath: string, content: string): Promise<{ success: boolean; path: string }> {
  const { fullPath, relPath } = resolveSafePath(subPath);

  // Guard against overwriting the root
  if (fullPath === getFilesRoot()) {
    throw new Error('Cannot write to root directory directly');
  }

  await fs.writeFile(fullPath, content, 'utf-8');
  return { success: true, path: relPath };
}

export async function createEntry(
  subPath: string,
  name: string,
  type: 'file' | 'directory',
): Promise<{ success: boolean; path: string }> {
  if (!name || name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid file or directory name');
  }

  const { fullPath } = resolveSafePath(subPath);
  const targetPath = join(fullPath, name);

  // Validate the combined path
  resolveSafePath(subPath ? `${subPath}/${name}` : name);

  if (existsSync(targetPath)) {
    throw new Error(`Item with name "${name}" already exists`);
  }

  if (type === 'directory') {
    await fs.mkdir(targetPath, { recursive: true });
  } else {
    await fs.writeFile(targetPath, '', 'utf-8');
  }

  const finalRel = subPath ? `${subPath}/${name}` : name;
  return { success: true, path: finalRel };
}

export async function deleteEntry(subPath: string): Promise<{ success: boolean; path: string }> {
  const { root, fullPath, relPath } = resolveSafePath(subPath);

  if (!relPath || fullPath === root) {
    throw new Error('Cannot delete the root directory');
  }

  if (!existsSync(fullPath)) {
    throw new Error(`File or directory not found: ${relPath}`);
  }

  await fs.rm(fullPath, { recursive: true, force: true });
  return { success: true, path: relPath };
}
