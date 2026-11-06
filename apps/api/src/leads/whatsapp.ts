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

const AUTH_FOLDER = process.env.WHATSAPP_AUTH_DIR ?? resolve(process.cwd(), '.whatsapp-auth');

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
 */
export async function initWhatsAppClient(): Promise<WhatsAppServiceStatus> {
  if (currentStatus.state === 'connected' && sock) {
    return currentStatus;
  }

  if (isInitializing) {
    return currentStatus;
  }

  isInitializing = true;
  currentStatus.state = 'connecting';
  currentStatus.error = null;

  try {
    if (!existsSync(AUTH_FOLDER)) {
      mkdirSync(AUTH_FOLDER, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

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
        } catch (err) {
          currentStatus.error = 'Failed to generate QR data URL';
        }
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;

        currentStatus.state = 'disconnected';
        currentStatus.phoneNumber = null;
        currentStatus.userName = null;

        if (shouldReconnect) {
          isInitializing = false;
          void initWhatsAppClient();
        } else {
          // Logged out
          currentStatus.qrDataUrl = null;
          isInitializing = false;
          try {
            rmSync(AUTH_FOLDER, { recursive: true, force: true });
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
      }
    });

    // Listen for incoming messages to detect replies from leads
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) continue; // Ignore messages sent by ourselves

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us')) continue; // Ignore groups

        const senderDigits = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        if (globalPrisma && senderDigits) {
          try {
            // Find lead by normalized phone digits
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
                  notes: `Respondió por WhatsApp: "${messageText.slice(0, 100)}" (${new Date().toLocaleDateString('es-AR')})`,
                },
              });
            }
          } catch {
            // ignore DB lookup error on message upsert
          }
        }
      }
    });

    return currentStatus;
  } catch (err: unknown) {
    isInitializing = false;
    currentStatus.state = 'disconnected';
    currentStatus.error = err instanceof Error ? err.message : String(err);
    return currentStatus;
  }
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

  // Format remote JID: Baileys expects e.g. 5493512345678@s.whatsapp.net
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
      rmSync(AUTH_FOLDER, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
