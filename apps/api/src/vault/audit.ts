import { execFile } from 'node:child_process';
import { existsSync, promises as fs, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type {
  DiscoveredEnvFile,
  SecurityIssue,
  VaultAuditSummary,
  VaultDiffItem,
  VaultDiffResult,
  VaultFileAudit,
  VaultProjectConfig,
  VaultSyncStatus,
} from '@cc/shared';
import { exportEnvText, getVaultOverview, updateProjectLastSynced, importEnvText } from './vault.js';

const execFileAsync = promisify(execFile);

export function parseEnvContent(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = raw.split(/\r?\n/);

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.substring(7).trim();

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.substring(1, val.length - 1);
    }

    if (key) {
      map.set(key, val);
    }
  }

  return map;
}

function findGitRoot(startDir: string): string | null {
  let curr = resolve(startDir);
  while (true) {
    if (existsSync(join(curr, '.git'))) {
      return curr;
    }
    const parent = dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

async function checkGitSecurity(filePath: string): Promise<{ isGitTracked: boolean; isGitIgnored: boolean }> {
  try {
    const gitRoot = findGitRoot(dirname(filePath));
    if (!gitRoot) {
      return { isGitTracked: false, isGitIgnored: false };
    }

    const relToGit = relative(gitRoot, filePath).replace(/\\/g, '/');

    // 1. Is it tracked in Git commit history?
    let isGitTracked = false;
    try {
      await execFileAsync('git', ['ls-files', '--error-unmatch', relToGit], { cwd: gitRoot });
      isGitTracked = true;
    } catch {
      isGitTracked = false;
    }

    // 2. Is it covered by .gitignore?
    let isGitIgnored = false;
    try {
      await execFileAsync('git', ['check-ignore', relToGit], { cwd: gitRoot });
      isGitIgnored = true;
    } catch {
      isGitIgnored = false;
    }

    return { isGitTracked, isGitIgnored };
  } catch {
    return { isGitTracked: false, isGitIgnored: false };
  }
}

export async function auditProjectEnv(
  config: VaultProjectConfig,
  vaultItemsForProject: { key: string; value: string }[],
): Promise<VaultFileAudit> {
  const issues: SecurityIssue[] = [];
  const filePath = config.filePath;
  const exists = existsSync(filePath);

  let permissionsOctal = '----';
  let isPermissionsSecure = true;
  let isGitTracked = false;
  let isGitIgnored = false;
  let syncStatus: VaultSyncStatus = 'missing_on_disk';
  let diskItemCount = 0;

  if (exists) {
    try {
      const stat = statSync(filePath);
      // POSIX permissions (e.g., 0600, 0644, 0777)
      const mode = stat.mode & 0o777;
      permissionsOctal = '0' + mode.toString(8);

      // On Windows development, mode is often 0666. On Linux/VPS, check against 0640.
      if (process.platform !== 'win32') {
        if (mode > 0o640) {
          isPermissionsSecure = false;
          const severity = (mode & 0o007) !== 0 || mode >= 0o666 ? 'CRITICAL' : 'WARNING';
          issues.push({
            severity,
            title: `Insecure file permissions (${permissionsOctal})`,
            description: `File permissions allow other system users to read or modify secrets.`,
            recommendation: `Run chmod 600 "${filePath}" to restrict access strictly to the owner.`,
          });
        }
      }

      // Git exposure checks
      const gitStatus = await checkGitSecurity(filePath);
      isGitTracked = gitStatus.isGitTracked;
      isGitIgnored = gitStatus.isGitIgnored;

      if (isGitTracked) {
        issues.push({
          severity: 'CRITICAL',
          title: '🚨 Secret file tracked in Git repository!',
          description: `This .env file is committed in Git history and visible to anyone with repository access.`,
          recommendation: `Run "git rm --cached ${basename(filePath)}" and commit the deletion, then rotate all exposed secrets.`,
        });
      } else if (!isGitIgnored) {
        issues.push({
          severity: 'WARNING',
          title: 'File is not ignored in .gitignore',
          description: `The file is not explicitly ignored and could be accidentally committed during git add .`,
          recommendation: `Add "${basename(filePath)}" to .gitignore.`,
        });
      }

      // Drift detection
      const rawDisk = readFileSync(filePath, 'utf-8');
      const diskMap = parseEnvContent(rawDisk);
      diskItemCount = diskMap.size;

      const vaultMap = new Map<string, string>();
      for (const item of vaultItemsForProject) {
        vaultMap.set(item.key, item.value);
      }

      let differencesCount = 0;
      for (const [vKey, vVal] of vaultMap.entries()) {
        const dVal = diskMap.get(vKey);
        if (dVal === undefined || dVal !== vVal) {
          differencesCount++;
        }
      }
      for (const dKey of diskMap.keys()) {
        if (!vaultMap.has(dKey)) {
          differencesCount++;
        }
      }

      if (differencesCount > 0) {
        syncStatus = 'drift_detected';
        issues.push({
          severity: 'WARNING',
          title: `Secret drift detected (${differencesCount} differences)`,
          description: `Values on the VPS disk differ from the encrypted Vault. Someone may have edited the .env file directly.`,
          recommendation: `Use the Diff / Compare tool to inspect changes and decide whether to sync to disk or import into Vault.`,
        });
      } else {
        syncStatus = 'in_sync';
      }
    } catch (err: any) {
      issues.push({
        severity: 'WARNING',
        title: 'Error reading disk file',
        description: err.message || 'Unknown read error',
      });
    }
  } else {
    syncStatus = 'missing_on_disk';
    issues.push({
      severity: 'INFO',
      title: 'File does not exist on disk yet',
      description: `Path "${filePath}" has not been created on the VPS filesystem.`,
      recommendation: `Use the "Deploy / Push to Disk" button to generate this .env file securely.`,
    });
  }

  // Criticality risk factor
  if (config.criticality === 'CRITICAL' && syncStatus === 'drift_detected') {
    issues.unshift({
      severity: 'CRITICAL',
      title: 'High-Impact Drift in CRITICAL Service',
      description: `Discrepancies found in a production/critical database or payment service.`,
    });
  }

  return {
    projectName: config.projectName,
    filePath: config.filePath,
    existsOnDisk: exists,
    permissionsOctal,
    isPermissionsSecure,
    isGitTracked,
    isGitIgnored,
    syncStatus,
    diskItemCount,
    vaultItemCount: vaultItemsForProject.length,
    issues,
  };
}

export async function runSecurityAudit(): Promise<VaultAuditSummary> {
  const overview = getVaultOverview();
  const audits: VaultFileAudit[] = [];

  let criticalCount = 0;
  let driftCount = 0;
  let insecurePermsCount = 0;

  for (const [projName, config] of Object.entries(overview.projectConfigs)) {
    const projItems = overview.items.filter((i) => i.project.toLowerCase() === projName.toLowerCase());
    const audit = await auditProjectEnv(config, projItems);
    audits.push(audit);

    if (audit.isGitTracked || audit.issues.some((i) => i.severity === 'CRITICAL')) {
      criticalCount++;
    }
    if (audit.syncStatus === 'drift_detected') {
      driftCount++;
    }
    if (!audit.isPermissionsSecure) {
      insecurePermsCount++;
    }
  }

  let globalRiskLevel: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
  if (criticalCount > 0) {
    globalRiskLevel = 'CRITICAL';
  } else if (driftCount > 0 || insecurePermsCount > 0) {
    globalRiskLevel = 'WARNING';
  }

  return {
    totalVariables: overview.items.length,
    totalProjects: audits.length,
    globalRiskLevel,
    criticalExposureCount: criticalCount,
    driftCount,
    insecurePermissionsCount: insecurePermsCount,
    audits,
  };
}

export async function computeVaultDiff(projectName: string): Promise<VaultDiffResult> {
  const overview = getVaultOverview();
  const config = overview.projectConfigs[projectName];
  const filePath = config ? config.filePath : '';
  const vaultItems = overview.items.filter((i) => i.project.toLowerCase() === projectName.toLowerCase());

  const vaultMap = new Map<string, string>();
  for (const item of vaultItems) {
    vaultMap.set(item.key, item.value);
  }

  let diskContent = '';
  const diskMap = new Map<string, string>();

  if (filePath && existsSync(filePath)) {
    diskContent = readFileSync(filePath, 'utf-8');
    const parsed = parseEnvContent(diskContent);
    for (const [k, v] of parsed.entries()) {
      diskMap.set(k, v);
    }
  }

  const allKeys = Array.from(new Set([...vaultMap.keys(), ...diskMap.keys()])).sort();
  const differences: VaultDiffItem[] = [];

  for (const key of allKeys) {
    const vaultVal = vaultMap.get(key) ?? null;
    const diskVal = diskMap.get(key) ?? null;

    let status: VaultDiffItem['status'] = 'identical';
    if (vaultVal !== null && diskVal === null) {
      status = 'only_in_vault';
    } else if (vaultVal === null && diskVal !== null) {
      status = 'only_on_disk';
    } else if (vaultVal !== diskVal) {
      status = 'modified';
    }

    differences.push({
      key,
      vaultValue: vaultVal,
      diskValue: diskVal,
      status,
    });
  }

  const vaultContent = exportEnvText(projectName);

  return {
    projectName,
    filePath,
    vaultContent,
    diskContent,
    differences,
  };
}

export async function deployVaultToDisk(projectName: string): Promise<{
  success: boolean;
  filePath: string;
  backupPath: string | null;
}> {
  const overview = getVaultOverview();
  const config = overview.projectConfigs[projectName];
  if (!config) {
    throw new Error(`Project "${projectName}" has no configuration registered`);
  }

  const filePath = config.filePath;
  const parentDir = dirname(filePath);
  if (!existsSync(parentDir)) {
    await fs.mkdir(parentDir, { recursive: true });
  }

  let backupPath: string | null = null;
  if (existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${filePath}.backup.${timestamp}`;
    await fs.copyFile(filePath, backupPath);
  }

  const envContent = exportEnvText(projectName);
  await fs.writeFile(filePath, envContent, 'utf-8');

  // Set restrictive POSIX permissions (chmod 600)
  if (process.platform !== 'win32') {
    try {
      await fs.chmod(filePath, 0o600);
    } catch {
      // Ignored if file permissions cannot be adjusted
    }
  }

  updateProjectLastSynced(projectName);

  return {
    success: true,
    filePath,
    backupPath,
  };
}

export function importEnvFromDiskFile(
  filePath: string,
  targetProject?: string,
): { importedCount: number; project: string } {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  let project = targetProject?.trim();
  if (!project) {
    const parent = basename(dirname(filePath));
    project = parent === 'repositories' || !parent ? 'global' : parent;
  }
  const res = importEnvText(project, raw);
  return { importedCount: res.importedCount, project };
}

export function discoverVpsEnvFiles(customPath?: string): DiscoveredEnvFile[] {
  const overview = getVaultOverview();
  const configuredPaths = new Set(
    Object.values(overview.projectConfigs).map((c) => resolve(c.filePath).toLowerCase()),
  );

  const results: DiscoveredEnvFile[] = [];
  const rootsToScan: string[] = [];

  if (customPath && existsSync(customPath)) {
    rootsToScan.push(resolve(customPath));
  } else {
    // Primary VPS locations
    if (existsSync('/home/adminnico/repositories')) {
      rootsToScan.push('/home/adminnico/repositories');
    }
    if (existsSync('/home/adminnico')) {
      rootsToScan.push('/home/adminnico');
    }
    if (existsSync('/host/home/adminnico')) {
      rootsToScan.push('/host/home/adminnico');
    }
    // Local / Container workdir fallbacks
    rootsToScan.push(process.cwd());
    const parentDir = resolve(process.cwd(), '..');
    if (existsSync(parentDir) && !rootsToScan.includes(parentDir)) {
      rootsToScan.push(parentDir);
    }
  }

  const seenPaths = new Set<string>();
  const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.cache', 'dist', 'build', '.pnpm', 'tmp', '.next', '.nuxt',
  ]);

  function scanDir(dir: string, depth = 0) {
    if (depth > 5) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Allow exploring repositories and normal directories, ignore build/git/node_modules
          if (!IGNORED_DIRS.has(entry.name) && (!entry.name.startsWith('.') || entry.name === '.env')) {
            scanDir(join(dir, entry.name), depth + 1);
          }
        } else if (entry.isFile()) {
          const lowerName = entry.name.toLowerCase();
          const isEnvMatch =
            lowerName === '.env' ||
            lowerName.startsWith('.env.') ||
            lowerName.endsWith('.env');

          if (isEnvMatch) {
            const fullPath = join(dir, entry.name);
            const normalized = resolve(fullPath).toLowerCase();
            if (seenPaths.has(normalized)) continue;
            seenPaths.add(normalized);

            const already = configuredPaths.has(normalized);

            let varCount = 0;
            try {
              const raw = readFileSync(fullPath, 'utf-8');
              varCount = parseEnvContent(raw).size;
            } catch {
              varCount = 0;
            }

            const folderName = basename(dir);
            results.push({
              path: fullPath,
              projectName: folderName === 'repositories' ? 'root' : folderName,
              variableCount: varCount,
              alreadyConfigured: already,
            });
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  for (const root of rootsToScan) {
    scanDir(root, 0);
  }

  return results;
}
