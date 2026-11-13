import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { pino } from 'pino';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import type { PrismaClient } from '../generated/prisma/client.js';

export interface WhatsAppServiceStatus {
  state: 'connected' | 'connecting' | 'waiting_qr' | 'disconnected';
  qrDataUrl: string | null;
  phoneNumber: string | null;
  userName: string | null;
  error?: string | null;
}

function resolveAuthFolder(): string {
  if (process.env.WHATSAPP_AUTH_DIR) {
    const dir = process.env.WHATSAPP_AUTH_DIR;
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      // fallback
    }
  }

  // ContaboVPS host volume mount (owned by non-root UID 1001)
  if (existsSync('/home/adminnico')) {
    const dir = '/home/adminnico/.whatsapp-auth';
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      // fallback
    }
  }

  // Try local working directory
  try {
    const localDir = resolve(process.cwd(), '.whatsapp-auth');
    if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
    return localDir;
  } catch {
    // Fallback to /tmp which is always writable in Linux containers
    const tmpDir = resolve(process.env.TEMP || process.env.TMP || '/tmp', '.whatsapp-auth');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }
}

let sock: WASocket | null = null;
let currentStatus: WhatsAppServiceStatus = {
  state: 'disconnected',
  qrDataUrl: null,
  phoneNumber: null,
  userName: null,
};
let isInitializing = false;
let globalPrisma: PrismaClient | null = null;

const logger = pino({ level: 'silent' });

export function setPrismaForWhatsApp(prisma: PrismaClient) {
  globalPrisma = prisma;
}

export function getWhatsAppStatus(): WhatsAppServiceStatus {
  return { ...currentStatus };
}

/**
 * Initializes or restarts the Baileys socket.
 * Waits up to 4.5s for initial QR generation so the connect endpoint
 * can return the QR code synchronously to the frontend without delay.
 */
export async function initWhatsAppClient(forceRefresh = false): Promise<WhatsAppServiceStatus> {
  if (currentStatus.state === 'connected' && sock && !forceRefresh) {
    return currentStatus;
  }

  if (currentStatus.state === 'waiting_qr' && currentStatus.qrDataUrl && !forceRefresh) {
    return currentStatus;
  }

  if (isInitializing && !forceRefresh) {
    return currentStatus;
  }

  isInitializing = true;
  currentStatus.state = 'connecting';
  currentStatus.error = null;

  if (sock) {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.end(undefined);
    } catch {
      // ignore
    }
    sock = null;
  }

  const authFolder = resolveAuthFolder();

  return new Promise<WhatsAppServiceStatus>((resolvePromise) => {
    let resolved = false;
    const safeResolve = (status: WhatsAppServiceStatus) => {
      if (!resolved) {
        resolved = true;
        resolvePromise({ ...status });
      }
    };

    // Timeout: if QR isn't generated in 4.5 seconds, return whatever status we have while background continues
    const timer = setTimeout(() => {
      safeResolve(currentStatus);
    }, 4500);

    (async () => {
      try {
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        sock = makeWASocket({
          auth: state,
          printQRInTerminal: false,
          logger,
          browser: ['Control Center Sales', 'Chrome', '1.0.0'],
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            try {
              currentStatus.qrDataUrl = await QRCode.toDataURL(qr);
              currentStatus.state = 'waiting_qr';
              currentStatus.error = null;
              clearTimeout(timer);
              safeResolve(currentStatus);
            } catch (err: any) {
              currentStatus.error = 'Failed to generate QR data URL: ' + (err.message || String(err));
              safeResolve(currentStatus);
            }
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            currentStatus.state = 'disconnected';
            currentStatus.phoneNumber = null;
            currentStatus.userName = null;

            if (shouldReconnect) {
              isInitializing = false;
            } else {
              // Logged out: clean stored creds
              currentStatus.qrDataUrl = null;
              isInitializing = false;
              try {
                rmSync(authFolder, { recursive: true, force: true });
              } catch {
                // ignore
              }
            }
          } else if (connection === 'open') {
            currentStatus.state = 'connected';
            currentStatus.qrDataUrl = null;
            currentStatus.error = null;

            const user = sock?.user;
            if (user) {
              const rawId = user.id.split(':')[0] ?? user.id;
              currentStatus.phoneNumber = `+${rawId}`;
              currentStatus.userName = user.name ?? null;
            }
            isInitializing = false;
            clearTimeout(timer);
            safeResolve(currentStatus);
          }
        });

        // Listen for incoming messages to detect replies from leads
        sock.ev.on('messages.upsert', async (m) => {
          if (m.type !== 'notify') return;

          for (const msg of m.messages) {
            if (msg.key.fromMe) continue;

            const remoteJid = msg.key.remoteJid;
            if (!remoteJid || remoteJid.includes('@g.us')) continue;

            const senderDigits = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
            const messageText =
              msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              '';

            if (globalPrisma && senderDigits) {
              try {
                const lead = await globalPrisma.lead.findFirst({
                  where: {
                    OR: [
                      { phoneFormatted: { contains: senderDigits } },
                      { phone: { contains: senderDigits } },
                    ],
                  },
                });

                if (lead) {
                  await globalPrisma.lead.update({
                    where: { id: lead.id },
                    data: {
                      status: 'replied',
                      notes: `Respondio por WhatsApp: "${messageText.slice(0, 100)}" (${new Date().toLocaleDateString('es-AR')})`,
                    },
                  });
                }
              } catch {
                // ignore
              }
            }
          }
        });
      } catch (err: unknown) {
        clearTimeout(timer);
        isInitializing = false;
        currentStatus.state = 'disconnected';
        currentStatus.error = err instanceof Error ? err.message : String(err);
        safeResolve(currentStatus);
      }
    })();
  });
}

/**
 * Sends a WhatsApp text message to an Argentine or international phone number.
 */
export async function sendWhatsAppMessage(
  targetPhone: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!sock || currentStatus.state !== 'connected') {
    return { success: false, error: 'WhatsApp is not connected on the server' };
  }

  const digits = targetPhone.replace(/\D/g, '');
  if (!digits) {
    return { success: false, error: 'Invalid phone number' };
  }

  let cleanNumber = digits;
  if (cleanNumber.startsWith('549')) {
    // Argentine mobile with 9
  } else if (cleanNumber.startsWith('54')) {
    cleanNumber = `549${cleanNumber.slice(2)}`;
  }

  const jid = `${cleanNumber}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Logs out and clears the stored session.
 */
export async function disconnectWhatsApp(): Promise<void> {
  const authFolder = resolveAuthFolder();
  try {
    if (sock) {
      await sock.logout();
    }
  } catch {
    // ignore
  } finally {
    sock = null;
    currentStatus = {
      state: 'disconnected',
      qrDataUrl: null,
      phoneNumber: null,
      userName: null,
    };
    try {
      rmSync(authFolder, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
