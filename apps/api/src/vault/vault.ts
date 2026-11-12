import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultAuditSummary, VaultItem, VaultOverview, VaultProjectConfig } from '@cc/shared';

const STORAGE_PATH = process.env.VAULT_STORAGE_FILE || join(process.cwd(), 'data', 'vault.json');

// The vault indexes exactly one project: the Control Center itself.
export const VAULT_PROJECT = 'control-center';

// Variables that bootstrap the vault. They live only in the .env file on disk, never inside the vault
// (the key cannot be stored in the store it encrypts). Deploys preserve them from the existing file.
export const BOOTSTRAP_KEYS: ReadonlySet<string> = new Set(['VAULT_SECRET', 'VAULT_STORAGE_FILE']);

const MASTER_SECRET = process.env.VAULT_SECRET || process.env.SESSION_SECRET || 'cc-vault-master-secret-key-2026';
const ALGORITHM = 'aes-256-gcm';
const KEY = scryptSync(MASTER_SECRET, 'cc-vault-salt-unique', 32);

// A source of truth must not be encrypted with a key that is public in the source code.
function assertVaultKeyConfigured(): void {
  if (!process.env.VAULT_SECRET) {
    throw new Error('VAULT_SECRET is not configured: refusing to write secrets with the built-in fallback key.');
  }
}

export interface StoredVaultRecord {
  id: string;
  key: string;
  encryptedValue: string; // iv:tag:ciphertext (hex)
  project: string;
  description: string;
  isSecret: boolean;
  updatedAt: string;
}

interface StoredVaultFile {
  items: StoredVaultRecord[];
  projectConfigs?: Record<string, VaultProjectConfig>;
}

export const DEFAULT_PROJECT_CONFIGS: Record<string, VaultProjectConfig> = {
  [VAULT_PROJECT]: {
    projectName: VAULT_PROJECT,
    filePath: '/home/adminnico/repositories/control-center/.env',
    dockerService: 'api,worker',
    environment: 'production',
    criticality: 'CRITICAL',
    lastSyncedAt: null,
  },
};

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`;
}

function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      return encryptedText;
    }
    const ivHex = parts[0];
    const tagHex = parts[1];
    const ciphertext = parts[2];
    if (!ivHex || !tagHex || !ciphertext) return encryptedText;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    let dec = decipher.update(ciphertext, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (err) {
    console.error('Failed to decrypt vault item:', err);
    return '*** DECRYPTION ERROR ***';
  }
}

export function loadStoredData(): {
  items: StoredVaultRecord[];
  projectConfigs: Record<string, VaultProjectConfig>;
} {
  try {
    if (!existsSync(STORAGE_PATH)) {
      return { items: [], projectConfigs: { ...DEFAULT_PROJECT_CONFIGS } };
    }
    const raw = readFileSync(STORAGE_PATH, 'utf-8');
    const data = JSON.parse(raw) as StoredVaultFile;
    // Only the Control Center project is indexed: anything else found in the file is ignored.
    const items = (Array.isArray(data.items) ? data.items : []).filter(
      (r) => (r.project || '').toLowerCase() === VAULT_PROJECT && !BOOTSTRAP_KEYS.has(r.key),
    );
    const stored = data.projectConfigs?.[VAULT_PROJECT];
    const projectConfigs: Record<string, VaultProjectConfig> = {
      [VAULT_PROJECT]: { ...DEFAULT_PROJECT_CONFIGS[VAULT_PROJECT]!, ...(stored || {}), projectName: VAULT_PROJECT },
    };
    return { items, projectConfigs };
  } catch {
    return { items: [], projectConfigs: { ...DEFAULT_PROJECT_CONFIGS } };
  }
}

export function saveStoredData(data: {
  items: StoredVaultRecord[];
  projectConfigs: Record<string, VaultProjectConfig>;
}): void {
  const dir = join(STORAGE_PATH, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getVaultOverview(customAudit?: VaultAuditSummary): VaultOverview {
  const { items: stored, projectConfigs } = loadStoredData();
  const items: VaultItem[] = stored.map((r) => ({
    id: r.id,
    key: r.key,
    value: decrypt(r.encryptedValue),
    project: r.project || 'global',
    description: r.description || '',
    isSecret: r.isSecret !== false,
    updatedAt: r.updatedAt,
  }));

  const projects = [VAULT_PROJECT];

  // Sort items: by project, then by key
  items.sort((a, b) => {
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    return a.key.localeCompare(b.key);
  });

  const defaultAuditSummary: VaultAuditSummary = customAudit ?? {
    totalVariables: items.length,
    totalProjects: projects.length,
    globalRiskLevel: 'SAFE',
    criticalExposureCount: 0,
    driftCount: 0,
    insecurePermissionsCount: 0,
    audits: [],
  };

  return { projects, projectConfigs, items, auditSummary: defaultAuditSummary };
}

export function upsertProjectConfig(config: VaultProjectConfig): VaultProjectConfig {
  if (config.projectName.toLowerCase() !== VAULT_PROJECT) {
    throw new Error(`The vault only indexes the "${VAULT_PROJECT}" project.`);
  }
  const data = loadStoredData();
  const next = { ...config, projectName: VAULT_PROJECT };
  data.projectConfigs[VAULT_PROJECT] = next;
  saveStoredData(data);
  return next;
}

export function updateProjectLastSynced(projectName: string): void {
  const data = loadStoredData();
  const cfg = data.projectConfigs[projectName];
  if (cfg) {
    cfg.lastSyncedAt = new Date().toISOString();
    saveStoredData(data);
  }
}

export function upsertVaultItem(input: {
  id?: string;
  key: string;
  value: string;
  project: string;
  description?: string;
  isSecret?: boolean;
}): VaultItem {
  assertVaultKeyConfigured();
  const data = loadStoredData();
  const id = input.id || randomUUID();
  const project = VAULT_PROJECT; // single-project vault: any other value is ignored
  const key = input.key.trim();
  if (BOOTSTRAP_KEYS.has(key)) {
    throw new Error(`${key} is a bootstrap variable and cannot be stored in the vault.`);
  }
  const description = input.description?.trim() || '';
  const isSecret = input.isSecret !== false;
  const updatedAt = new Date().toISOString();
  const encryptedValue = encrypt(input.value);

  const existingIdx = data.items.findIndex((r) => r.id === id);
  const newRecord: StoredVaultRecord = {
    id,
    key,
    encryptedValue,
    project,
    description,
    isSecret,
    updatedAt,
  };

  if (existingIdx >= 0) {
    data.items[existingIdx] = newRecord;
  } else {
    const duplicateKeyIdx = data.items.findIndex(
      (r) => r.project.toLowerCase() === project.toLowerCase() && r.key === key,
    );
    if (duplicateKeyIdx >= 0) {
      data.items[duplicateKeyIdx] = newRecord;
    } else {
      data.items.push(newRecord);
    }
  }

  saveStoredData(data);

  return {
    id,
    key,
    value: input.value,
    project,
    description,
    isSecret,
    updatedAt,
  };
}

export function deleteVaultItem(id: string): boolean {
  const data = loadStoredData();
  const filtered = data.items.filter((r) => r.id !== id);
  if (filtered.length !== data.items.length) {
    data.items = filtered;
    saveStoredData(data);
    return true;
  }
  return false;
}

export function importEnvText(
  _project: string,
  rawEnv: string,
): { importedCount: number; items: VaultItem[] } {
  const project = VAULT_PROJECT;
  const lines = rawEnv.split(/\r?\n/);
  const results: VaultItem[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('export ')) {
      line = line.substring(7).trim();
    }

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

    if (!key || BOOTSTRAP_KEYS.has(key)) continue;

    const upperKey = key.toUpperCase();
    const isSecret =
      upperKey.includes('KEY') ||
      upperKey.includes('SECRET') ||
      upperKey.includes('TOKEN') ||
      upperKey.includes('PASS') ||
      upperKey.includes('URL') ||
      upperKey.includes('CREDENTIAL') ||
      upperKey.includes('AUTH');

    const item = upsertVaultItem({
      key,
      value: val,
      project,
      isSecret,
      description: `Imported from .env file`,
    });
    results.push(item);
  }

  return { importedCount: results.length, items: results };
}

export function exportEnvText(_project?: string): string {
  const project = VAULT_PROJECT;
  const { items } = getVaultOverview();
  const projectItems = items.filter((i) => i.project.toLowerCase() === project.toLowerCase());

  let output = `# Environment variables for project: ${project}\n`;
  output += `# Exported from Control Center Vault on ${new Date().toISOString()}\n\n`;

  for (const item of projectItems) {
    if (item.description) {
      output += `# ${item.description}\n`;
    }
    const needsQuotes = item.value.includes(' ') || item.value.includes('"') || item.value.includes('\n');
    const val = needsQuotes ? `"${item.value.replace(/"/g, '\\"')}"` : item.value;
    output += `${item.key}=${val}\n`;
  }

  return output;
}
