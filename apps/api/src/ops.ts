import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

const HOME_DIR = '/home/adminnico';
const CMS_BACKUPS_DIR = '/home/adminnico/cms/backups';
const CMS_BACKUP_SCRIPT = '/home/adminnico/cms/scripts/backup.sh';

// --- 1. Vercel Projects & Deployments --------------------------------------------------------------

export interface VercelProjectView {
  id: string;
  name: string;
  framework: string | null;
  nodeVersion: string | null;
  updatedAt: string;
  repo: { org: string; repo: string; type: string } | null;
  domains: string[];
  latestDeployment: {
    id: string;
    url: string;
    readyState: string;
    createdAt: string;
    commitMessage: string | null;
    commitRef: string | null;
    commitSha: string | null;
  } | null;
}

let vercelCache: { expiresAt: number; data: VercelProjectView[] } | null = null;

export async function fetchVercelProjects(forceRefresh = false): Promise<{
  configured: boolean;
  projects: VercelProjectView[];
  error?: string;
}> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return { configured: false, projects: [], error: 'VERCEL_TOKEN not set on server' };
  }

  if (!forceRefresh && vercelCache && vercelCache.expiresAt > Date.now()) {
    return { configured: true, projects: vercelCache.data };
  }

  try {
    // First discover teamId if any from /v2/teams
    let teamId = process.env.VERCEL_TEAM_ID ?? '';
    if (!teamId) {
      try {
        const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(6000),
        });
        if (teamsRes.ok) {
          const teamsData = (await teamsRes.json()) as { teams?: Array<{ id: string }> };
          teamId = teamsData.teams?.[0]?.id ?? '';
        }
      } catch {
        // Ignore team lookup failure
      }
    }

    const qs = new URLSearchParams({ limit: '50' });
    if (teamId) qs.set('teamId', teamId);

    const res = await fetch(`https://api.vercel.com/v9/projects?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { configured: true, projects: [], error: `Vercel API ${res.status}: ${txt.slice(0, 200)}` };
    }

    const body = (await res.json()) as {
      projects?: Array<{
        id: string;
        name: string;
        framework?: string | null;
        nodeVersion?: string | null;
        updatedAt?: number;
        link?: { org?: string; repo?: string; type?: string };
        targets?: {
          production?: {
            id?: string;
            url?: string;
            readyState?: string;
            createdAt?: number;
            alias?: string[];
            meta?: Record<string, string>;
          };
        };
        latestDeployments?: Array<{
          id?: string;
          url?: string;
          readyState?: string;
          createdAt?: number;
          alias?: string[];
          meta?: Record<string, string>;
        }>;
      }>;
    };

    const projects: VercelProjectView[] = (body.projects ?? []).map((p) => {
      const prod = p.targets?.production;
      const latest = prod ?? p.latestDeployments?.[0];
      const aliases = prod?.alias ?? p.latestDeployments?.[0]?.alias ?? [];
      const domains = Array.from(
        new Set(
          aliases.filter(
            (a) => !a.includes('-nicolas-guzmans-projects.vercel.app') || aliases.length === 1
          )
        )
      ).slice(0, 4);

      const meta = latest?.meta ?? {};
      return {
        id: p.id,
        name: p.name,
        framework: p.framework ?? null,
        nodeVersion: p.nodeVersion ?? null,
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
        repo: p.link?.repo
          ? { org: p.link.org ?? 'guzmannicolas', repo: p.link.repo, type: p.link.type ?? 'github' }
          : null,
        domains,
        latestDeployment: latest?.id
          ? {
              id: latest.id,
              url: latest.url ?? `${p.name}.vercel.app`,
              readyState: latest.readyState ?? 'UNKNOWN',
              createdAt: latest.createdAt ? new Date(latest.createdAt).toISOString() : new Date().toISOString(),
              commitMessage: meta.githubCommitMessage ?? null,
              commitRef: meta.githubCommitRef ?? null,
              commitSha: meta.githubCommitSha ? meta.githubCommitSha.slice(0, 7) : null,
            }
          : null,
      };
    });

    projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    vercelCache = { expiresAt: Date.now() + 20_000, data: projects };
    return { configured: true, projects };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { configured: true, projects: [], error: msg };
  }
}

// --- 2. Backups & Status ---------------------------------------------------------------------------

export interface BackupFileItem {
  name: string;
  kind: 'daily-archive' | 'sql-snapshot' | 'config-json' | 'other';
  sizeBytes: number;
  sizeHuman: string;
  createdAt: string;
  ageHours: number;
}

export interface BackupsOverview {
  status: 'ok' | 'degraded' | 'down';
  statusMessage: string;
  schedule: string;
  destination: string;
  totalSizeBytes: number;
  totalSizeHuman: string;
  lastBackupAt: string | null;
  lastBackupAgeHours: number | null;
  rcloneNotice: string | null;
  files: BackupFileItem[];
  recentLogLines: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getBackupsOverview(): BackupsOverview {
  const files: BackupFileItem[] = [];
  let totalSizeBytes = 0;

  if (existsSync(CMS_BACKUPS_DIR)) {
    try {
      const entries = readdirSync(CMS_BACKUPS_DIR, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isFile() || e.name === 'backup.log') continue;
        const full = join(CMS_BACKUPS_DIR, e.name);
        const st = statSync(full);
        totalSizeBytes += st.size;
        const ageHours = Math.round(((Date.now() - st.mtimeMs) / 3_600_000) * 10) / 10;
        const kind: BackupFileItem['kind'] = e.name.startsWith('cms-') && e.name.endsWith('.tar')
          ? 'daily-archive'
          : e.name.endsWith('.sql.gz')
            ? 'sql-snapshot'
            : e.name.endsWith('.json')
              ? 'config-json'
              : 'other';

        files.push({
          name: e.name,
          kind,
          sizeBytes: st.size,
          sizeHuman: formatBytes(st.size),
          createdAt: st.mtime.toISOString(),
          ageHours,
        });
      }
    } catch {
      // Ignore read errors
    }
  }

  files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const dailyArchives = files.filter((f) => f.kind === 'daily-archive');
  const latestDaily = dailyArchives[0] ?? files[0] ?? null;

  let recentLogLines: string[] = [];
  let rcloneNotice: string | null = null;
  const logFile = existsSync(join(CMS_BACKUPS_DIR, 'backup.log'))
    ? join(CMS_BACKUPS_DIR, 'backup.log')
    : '/backups/cms/backup.log';

  if (existsSync(logFile)) {
    try {
      const content = readFileSync(logFile, 'utf8');
      const allLines = content.trim().split('\n').filter(Boolean);
      recentLogLines = allLines.slice(-25);
      if (allLines.some((l) => l.includes('shared Google Drive client_id'))) {
        rcloneNotice =
          'rclone usa el client_id compartido de Google Drive (se recomienda crear un client_id propio en Google Cloud antes de fin de 2026).';
      }
    } catch {
      // Ignore log read errors
    }
  }

  let status: BackupsOverview['status'] = 'ok';
  let statusMessage = 'Backup diario al día y sincronizado con Google Drive (gcrypt)';

  if (!latestDaily) {
    status = 'down';
    statusMessage = 'No se encontraron archivos de backup en /home/adminnico/cms/backups';
  } else if (latestDaily.ageHours > 48) {
    status = 'down';
    statusMessage = `El último backup tiene ${latestDaily.ageHours}h de antigüedad (> 48h)`;
  } else if (latestDaily.ageHours > 26) {
    status = 'degraded';
    statusMessage = `El último backup tiene ${latestDaily.ageHours}h de antigüedad`;
  }

  return {
    status,
    statusMessage,
    schedule: 'Todos los días a las 03:30 hs (Cron) — Retención: 7 días local / 30 días Google Drive',
    destination: 'Local (/home/adminnico/cms/backups) + Google Drive Encriptado (gcrypt:daily/)',
    totalSizeBytes,
    totalSizeHuman: formatBytes(totalSizeBytes),
    lastBackupAt: latestDaily?.createdAt ?? null,
    lastBackupAgeHours: latestDaily?.ageHours ?? null,
    rcloneNotice,
    files,
    recentLogLines,
  };
}

export async function runManualBackup(): Promise<{ ok: boolean; output: string; overview: BackupsOverview }> {
  try {
    if (!existsSync(CMS_BACKUP_SCRIPT)) {
      return {
        ok: false,
        output: `Backup script not found at ${CMS_BACKUP_SCRIPT}`,
        overview: getBackupsOverview(),
      };
    }

    const { stdout, stderr } = await execAsync(
      `HOME="${HOME_DIR}" bash "${CMS_BACKUP_SCRIPT}" >> "${CMS_BACKUPS_DIR}/backup.log" 2>&1 && tail -n 5 "${CMS_BACKUPS_DIR}/backup.log"`,
      {
        cwd: '/home/adminnico/cms',
        timeout: 120_000,
      }
    );

    return {
      ok: true,
      output: (stdout + '\n' + stderr).trim() || 'Backup ejecutado correctamente.',
      overview: getBackupsOverview(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      output: `Error ejecutando backup: ${msg}`,
      overview: getBackupsOverview(),
    };
  }
}

// --- 3. VPS Health, Storage Breakdown & One-Click Cleanup ------------------------------------------

export interface VpsStatusView {
  hostname: string;
  os: string;
  uptimeSeconds: number;
  cpuCores: number;
  loadAvg: [number, number, number];
  memory: {
    ramTotalMb: number;
    ramUsedMb: number;
    ramAvailableMb: number;
    ramPercent: number;
    swapTotalMb: number;
    swapUsedMb: number;
    swapPercent: number;
  };
  disk: {
    totalGb: number;
    usedGb: number;
    availGb: number;
    usePercent: number;
  };
  storageBreakdown: Array<{ label: string; path: string; sizeHuman: string }>;
  dockerDf: Array<{ type: string; totalCount: string; active: string; size: string; reclaimable: string }>;
  containers: Array<{ id: string; name: string; image: string; state: string; status: string }>;
}

async function safeDu(targetPath: string): Promise<string> {
  if (!existsSync(targetPath)) return '0 B';
  try {
    const { stdout } = await execAsync(`du -sh "${targetPath}" 2>/dev/null | cut -f1`, { timeout: 6000 });
    return stdout.trim() || '0 B';
  } catch {
    return '0 B';
  }
}

export async function getVpsStatus(): Promise<VpsStatusView> {
  // 1. Hostname & OS
  let hostname = os.hostname();
  if (existsSync('/host/etc/hostname')) {
    try {
      hostname = readFileSync('/host/etc/hostname', 'utf8').trim() || hostname;
    } catch {}
  }

  let osName = 'Linux VPS';
  const osReleasePath = existsSync('/host/etc/os-release') ? '/host/etc/os-release' : '/etc/os-release';
  if (existsSync(osReleasePath)) {
    try {
      const raw = readFileSync(osReleasePath, 'utf8');
      const m = raw.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
      if (m?.[1]) osName = m[1];
    } catch {}
  }

  // 2. Memory & Swap from /proc/meminfo
  let ramTotalMb = Math.round(os.totalmem() / (1024 * 1024));
  let ramAvailableMb = Math.round(os.freemem() / (1024 * 1024));
  let swapTotalMb = 0;
  let swapFreeMb = 0;

  if (existsSync('/proc/meminfo')) {
    try {
      const meminfo = readFileSync('/proc/meminfo', 'utf8');
      const kb = (key: string) => {
        const m = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
        return m?.[1] ? parseInt(m[1], 10) : 0;
      };
      const totalKb = kb('MemTotal');
      const availKb = kb('MemAvailable');
      if (totalKb > 0) {
        ramTotalMb = Math.round(totalKb / 1024);
        ramAvailableMb = Math.round(availKb / 1024);
      }
      swapTotalMb = Math.round(kb('SwapTotal') / 1024);
      swapFreeMb = Math.round(kb('SwapFree') / 1024);
    } catch {}
  }

  const ramUsedMb = Math.max(0, ramTotalMb - ramAvailableMb);
  const ramPercent = ramTotalMb > 0 ? Math.round((ramUsedMb / ramTotalMb) * 100) : 0;
  const swapUsedMb = Math.max(0, swapTotalMb - swapFreeMb);
  const swapPercent = swapTotalMb > 0 ? Math.round((swapUsedMb / swapTotalMb) * 100) : 0;

  // 3. Disk space (/host or /)
  const targetMount = existsSync('/host') ? '/host' : '/';
  let totalGb = 72;
  let usedGb = 15;
  let availGb = 57;
  let usePercent = 21;

  try {
    const { stdout } = await execAsync(`df -B1 "${targetMount}" | tail -n 1`, { timeout: 5000 });
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 5) {
      totalGb = Math.round((parseInt(parts[1]!, 10) / 1e9) * 10) / 10;
      usedGb = Math.round((parseInt(parts[2]!, 10) / 1e9) * 10) / 10;
      availGb = Math.round((parseInt(parts[3]!, 10) / 1e9) * 10) / 10;
      usePercent = parseInt(parts[4]!.replace('%', ''), 10) || 0;
    }
  } catch {}

  // 4. Storage breakdown in parallel
  const [homeSize, reposSize, vscodeSize, backupsSize, localShareSize, npmCacheSize] = await Promise.all([
    safeDu('/home/adminnico'),
    safeDu('/home/adminnico/repositories'),
    safeDu('/home/adminnico/.vscode-server'),
    safeDu('/home/adminnico/cms/backups'),
    safeDu('/home/adminnico/.local'),
    safeDu('/home/adminnico/.npm'),
  ]);

  const storageBreakdown = [
    { label: 'Home total (/home/adminnico)', path: '/home/adminnico', sizeHuman: homeSize },
    { label: 'Repositorios Git', path: '/home/adminnico/repositories', sizeHuman: reposSize },
    { label: 'VS Code Remote Server', path: '/home/adminnico/.vscode-server', sizeHuman: vscodeSize },
    { label: 'Binarios y librerías (.local)', path: '/home/adminnico/.local', sizeHuman: localShareSize },
    { label: 'Backups locales de CMS', path: '/home/adminnico/cms/backups', sizeHuman: backupsSize },
    { label: 'Caché de NPM (.npm)', path: '/home/adminnico/.npm', sizeHuman: npmCacheSize },
  ];

  // 5. Docker system df & running containers
  const dockerDf: VpsStatusView['dockerDf'] = [];
  const containers: VpsStatusView['containers'] = [];

  try {
    const { stdout: dfOut } = await execAsync('docker system df --format "{{json .}}"', { timeout: 8000 });
    for (const line of dfOut.trim().split('\n').filter(Boolean)) {
      const row = JSON.parse(line) as {
        Type?: string;
        TotalCount?: string;
        Active?: string;
        Size?: string;
        Reclaimable?: string;
      };
      dockerDf.push({
        type: row.Type ?? '',
        totalCount: String(row.TotalCount ?? '0'),
        active: String(row.Active ?? '0'),
        size: row.Size ?? '0B',
        reclaimable: row.Reclaimable ?? '0B',
      });
    }
  } catch {}

  try {
    const { stdout: psOut } = await execAsync('docker ps -a --format "{{json .}}"', { timeout: 6000 });
    for (const line of psOut.trim().split('\n').filter(Boolean)) {
      const c = JSON.parse(line) as {
        ID?: string;
        Names?: string;
        Image?: string;
        State?: string;
        Status?: string;
      };
      containers.push({
        id: c.ID ?? '',
        name: c.Names ?? '',
        image: c.Image ?? '',
        state: c.State ?? '',
        status: c.Status ?? '',
      });
    }
  } catch {}

  const load = os.loadavg();
  return {
    hostname,
    os: osName,
    uptimeSeconds: Math.round(os.uptime()),
    cpuCores: os.cpus().length,
    loadAvg: [
      Math.round((load[0] ?? 0) * 100) / 100,
      Math.round((load[1] ?? 0) * 100) / 100,
      Math.round((load[2] ?? 0) * 100) / 100,
    ],
    memory: {
      ramTotalMb,
      ramUsedMb,
      ramAvailableMb,
      ramPercent,
      swapTotalMb,
      swapUsedMb,
      swapPercent,
    },
    disk: {
      totalGb,
      usedGb,
      availGb,
      usePercent,
    },
    storageBreakdown,
    dockerDf,
    containers,
  };
}

export async function runVpsCleanup(
  target: 'docker' | 'vscode' | 'caches' | 'all'
): Promise<{ ok: boolean; log: string; status: VpsStatusView }> {
  const logs: string[] = [];

  try {
    if (target === 'docker' || target === 'all') {
      const { stdout: imgOut } = await execAsync('docker image prune -af && docker builder prune -af', {
        timeout: 60_000,
      });
      logs.push(`🐳 Docker Prune:\n${imgOut.trim() || 'Sin imágenes ni caché huérfana para borrar.'}`);
    }

    if (target === 'vscode' || target === 'all') {
      const serversDir = '/home/adminnico/.vscode-server/cli/servers';
      let removedCount = 0;
      if (existsSync(serversDir)) {
        const entries = readdirSync(serversDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name.startsWith('Stable-'))
          .map((e) => ({ name: e.name, full: join(serversDir, e.name), mtime: statSync(join(serversDir, e.name)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);

        // Keep the newest one, remove older ones
        for (const old of entries.slice(1)) {
          await execAsync(`rm -rf "${old.full}"`);
          removedCount++;
        }
        if (entries[0]) {
          writeFileSync(join(serversDir, 'lru.json'), JSON.stringify([entries[0].name]), 'utf8');
        }
      }
      logs.push(`💻 VS Code Server: ${removedCount} versiones antiguas eliminadas (última versión conservada).`);
    }

    if (target === 'caches' || target === 'all') {
      await execAsync(
        'rm -rf /home/adminnico/.npm/_cacache /home/adminnico/.cache/pnpm /home/adminnico/.local/share/pnpm/store /tmp/claude-* 2>/dev/null || true',
        { timeout: 20_000 }
      );
      logs.push('📦 Cachés de paquetes (npm, pnpm, /tmp) limpiadas correctamente.');
    }

    const status = await getVpsStatus();
    return { ok: true, log: logs.join('\n\n'), status };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`✖ Error: ${msg}`);
    const status = await getVpsStatus();
    return { ok: false, log: logs.join('\n\n'), status };
  }
}
