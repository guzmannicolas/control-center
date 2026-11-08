import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultItem, VaultOverview } from '@cc/shared';

const STORAGE_PATH = process.env.VAULT_STORAGE_FILE || join(process.cwd(), 'data', 'vault.json');

const MASTER_SECRET = process.env.VAULT_SECRET || process.env.SESSION_SECRET || 'cc-vault-master-secret-key-2026';
const ALGORITHM = 'aes-256-gcm';
const KEY = scryptSync(MASTER_SECRET, 'cc-vault-salt-unique', 32);

interface StoredVaultRecord {
  id: string;
  key: string;
  encryptedValue: string; // iv:tag:ciphertext (hex)
  project: string;
  description: string;
  isSecret: boolean;
  updatedAt: string;
}

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
      // If legacy plain text was stored
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

function loadStoredRecords(): StoredVaultRecord[] {
  try {
    if (!existsSync(STORAGE_PATH)) return [];
    const raw = readFileSync(STORAGE_PATH, 'utf-8');
    const data = JSON.parse(raw) as { items: StoredVaultRecord[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function saveStoredRecords(items: StoredVaultRecord[]): void {
  const dir = join(STORAGE_PATH, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(STORAGE_PATH, JSON.stringify({ items }, null, 2), 'utf-8');
}

export function getVaultOverview(): VaultOverview {
  const stored = loadStoredRecords();
  const items: VaultItem[] = stored.map((r) => ({
    id: r.id,
    key: r.key,
    value: decrypt(r.encryptedValue),
    project: r.project || 'global',
    description: r.description || '',
    isSecret: r.isSecret !== false,
    updatedAt: r.updatedAt,
  }));

  const projectSet = new Set<string>();
  for (const item of items) {
    if (item.project) projectSet.add(item.project);
  }
  const projects = Array.from(projectSet).sort();
  if (!projects.includes('global')) {
    projects.unshift('global');
  }

  // Sort items: by project, then by key
  items.sort((a, b) => {
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    return a.key.localeCompare(b.key);
  });

  return { projects, items };
}

export function upsertVaultItem(input: {
  id?: string;
  key: string;
  value: string;
  project: string;
  description?: string;
  isSecret?: boolean;
}): VaultItem {
  const stored = loadStoredRecords();
  const id = input.id || randomUUID();
  const project = (input.project || 'global').trim();
  const key = input.key.trim();
  const description = input.description?.trim() || '';
  const isSecret = input.isSecret !== false;
  const updatedAt = new Date().toISOString();
  const encryptedValue = encrypt(input.value);

  const existingIdx = stored.findIndex((r) => r.id === id);
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
    stored[existingIdx] = newRecord;
  } else {
    // Also check if same key already exists in same project
    const duplicateKeyIdx = stored.findIndex((r) => r.project.toLowerCase() === project.toLowerCase() && r.key === key);
    if (duplicateKeyIdx >= 0) {
      stored[duplicateKeyIdx] = newRecord;
    } else {
      stored.push(newRecord);
    }
  }

  saveStoredRecords(stored);

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
  const stored = loadStoredRecords();
  const filtered = stored.filter((r) => r.id !== id);
  if (filtered.length !== stored.length) {
    saveStoredRecords(filtered);
    return true;
  }
  return false;
}

export function importEnvText(
  project: string,
  rawEnv: string,
): { importedCount: number; items: VaultItem[] } {
  const lines = rawEnv.split(/\r?\n/);
  const results: VaultItem[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // Handle optional 'export '
    if (line.startsWith('export ')) {
      line = line.substring(7).trim();
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();

    // Strip wrapping quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.substring(1, val.length - 1);
    }

    if (!key) continue;

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

export function exportEnvText(project: string): string {
  const { items } = getVaultOverview();
  const projectItems = items.filter((i) => i.project.toLowerCase() === project.toLowerCase());

  let output = `# Environment variables for project: ${project}\n`;
  output += `# Exported from Control Center Vault on ${new Date().toISOString()}\n\n`;

  for (const item of projectItems) {
    if (item.description) {
      output += `# ${item.description}\n`;
    }
    // Quote value if it contains spaces or quotes
    const needsQuotes = item.value.includes(' ') || item.value.includes('"') || item.value.includes('\n');
    const val = needsQuotes ? `"${item.value.replace(/"/g, '\\"')}"` : item.value;
    output += `${item.key}=${val}\n`;
  }

  return output;
}
