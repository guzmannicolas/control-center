import { execFile } from 'node:child_process';
import { existsSync, promises as fs, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
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
import {
  BOOTSTRAP_KEYS,
  VAULT_PROJECT,
  exportEnvText,
  getVaultOverview,
  updateProjectLastSynced,
  importEnvText,
} from './vault.js';

const execFileAsync = promisify(execFile);

// Parsed disk content without the variables that bootstrap the vault itself.
function withoutBootstrapKeys(map: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of map.entries()) {
    if (!BOOTSTRAP_KEYS.has(k)) out.set(k, v);
  }
  return out;
}

// The only .env the vault is allowed to read from or write to.
function getVaultEnvPath(): string {
  const cfg = getVaultOverview().projectConfigs[VAULT_PROJECT];
  if (!cfg) throw new Error(`Project "${VAULT_PROJECT}" has no configuration registered`);
  return cfg.filePath;
}

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
          title: 'Secret file tracked in Git repository',
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
      const diskMap = withoutBootstrapKeys(parseEnvContent(rawDisk));
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
  let gitExposureCount = 0;
  let driftCount = 0;
  let insecurePermsCount = 0;

  for (const [projName, config] of Object.entries(overview.projectConfigs)) {
    const projItems = overview.items.filter((i) => i.project.toLowerCase() === projName.toLowerCase());
    const audit = await auditProjectEnv(config, projItems);
    audits.push(audit);

    if (audit.isGitTracked || audit.issues.some((i) => i.severity === 'CRITICAL')) {
      criticalCount++;
    }
    // Real exposure only: the secret file is committed to Git (drift is reported separately).
    if (audit.isGitTracked) {
      gitExposureCount++;
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
    criticalExposureCount: gitExposureCount,
    driftCount,
    insecurePermissionsCount: insecurePermsCount,
    audits,
  };
}

export async function computeVaultDiff(_projectName?: string): Promise<VaultDiffResult> {
  const projectName = VAULT_PROJECT;
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
    const parsed = withoutBootstrapKeys(parseEnvContent(diskContent));
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


// Keeps the bootstrap variables (VAULT_SECRET, ...) from the current file so a deploy never drops them.
function extractBootstrapLines(rawDisk: string): string[] {
  const kept: string[] = [];
  for (const line of rawDisk.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match?.[1] && BOOTSTRAP_KEYS.has(match[1])) kept.push(line.trim());
  }
  return kept;
}

export async function deployVaultToDisk(_projectName?: string): Promise<{
  success: boolean;
  filePath: string;
  backupPath: string | null;
}> {
  const projectName = VAULT_PROJECT;
  const overview = getVaultOverview();
  if (overview.items.length === 0) {
    // The vault is the source of truth: deploying an empty one would wipe the real .env.
    throw new Error('The vault is empty. Import the current .env first; refusing to overwrite it with nothing.');
  }

  const filePath = getVaultEnvPath();
  const parentDir = dirname(filePath);
  if (!existsSync(parentDir)) {
    await fs.mkdir(parentDir, { recursive: true });
  }

  let backupPath: string | null = null;
  let bootstrapLines: string[] = [];
  if (existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${filePath}.backup.${timestamp}`;
    await fs.copyFile(filePath, backupPath);
    if (process.platform !== 'win32') {
      await fs.chmod(backupPath, 0o600).catch(() => undefined);
    }
    bootstrapLines = extractBootstrapLines(readFileSync(filePath, 'utf-8'));
  }

  let envContent = exportEnvText(projectName);
  if (bootstrapLines.length > 0) {
    envContent += `\n# Vault bootstrap (preserved from the previous file, never stored in the vault)\n${bootstrapLines.join('\n')}\n`;
  }

  // Atomic replace: write a private temp file, then rename over the target.
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tmpPath, envContent, { encoding: 'utf-8', mode: 0o600 });
  await fs.rename(tmpPath, filePath);

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

// Only .env-style files inside the Control Center repository can be read into the vault.
function isInsideVaultRepo(filePath: string): boolean {
  const repoDir = resolve(dirname(getVaultEnvPath()));
  const target = resolve(filePath);
  const rel = relative(repoDir, target);
  return rel !== '' && !isAbsolute(rel) && !rel.startsWith('..') && !rel.split(/[\\/]/).includes('node_modules');
}

export function importEnvFromDiskFile(
  filePath: string,
  _targetProject?: string,
): { importedCount: number; project: string } {
  if (!isInsideVaultRepo(filePath)) {
    throw new Error(`The vault only imports files inside the "${VAULT_PROJECT}" repository.`);
  }
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  const res = importEnvText(VAULT_PROJECT, raw);
  return { importedCount: res.importedCount, project: VAULT_PROJECT };
}

export function discoverVpsEnvFiles(_customPath?: string): DiscoveredEnvFile[] {
  const overview = getVaultOverview();
  const configuredPath = resolve(overview.projectConfigs[VAULT_PROJECT]?.filePath ?? '').toLowerCase();
  const repoDir = dirname(overview.projectConfigs[VAULT_PROJECT]?.filePath ?? '');

  const results: DiscoveredEnvFile[] = [];
  if (!repoDir || !existsSync(repoDir)) return results;

  const IGNORED_DIRS = new Set(['node_modules', '.git', '.cache', 'dist', 'build', '.pnpm', 'tmp', 'data', 'knowledge']);

  function scanDir(dir: string, depth: number) {
    if (depth > 2) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) scanDir(full, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        const lower = entry.name.toLowerCase();
        const isEnvMatch = lower === '.env' || lower.startsWith('.env.') || lower.endsWith('.env');
        if (!isEnvMatch || lower.includes('.backup.') || lower.includes('.tmp-')) continue;

        let varCount = 0;
        try {
          varCount = withoutBootstrapKeys(parseEnvContent(readFileSync(full, 'utf-8'))).size;
        } catch {
          varCount = 0;
        }
        results.push({
          path: full,
          projectName: VAULT_PROJECT,
          variableCount: varCount,
          alreadyConfigured: resolve(full).toLowerCase() === configuredPath,
        });
      }
    } catch {
      // Skip unreadable directories
    }
  }

  scanDir(repoDir, 0);
  return results;
}
