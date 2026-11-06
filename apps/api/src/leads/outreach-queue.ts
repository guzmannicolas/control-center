import { Queue, Worker, type Job } from 'bullmq';
import { pino } from 'pino';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Redis } from 'ioredis';
import { generatePersonalizedPitch } from './pitch.js';

export const OUTREACH_QUEUE_NAME = 'leads-outreach';

export interface OutreachJobData {
  leadId: string;
  phone: string;
  name: string;
  category: string;
  city: string;
  suggestedDemo?: string | null;
  customPitch?: string;
  isFollowUp?: boolean;
}

export interface OutreachQueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
}

export function createOutreachQueue(redis: Redis) {
  return new Queue<OutreachJobData>(OUTREACH_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
}

/**
 * Creates the background outreach worker with humanized rate limiting.
 * Dispatches 1 outreach message every interval (default 60-120s) to keep phone lines safe.
 */
export function createOutreachWorker(
  redis: Redis,
  prisma: PrismaClient,
  log = pino({ level: 'info' })
) {
  const worker = new Worker<OutreachJobData>(
    OUTREACH_QUEUE_NAME,
    async (job: Job<OutreachJobData>) => {
      const { leadId, customPitch, isFollowUp, ...ctx } = job.data;
      log.info({ leadId, name: ctx.name, phone: ctx.phone }, 'processing automated outreach job');

      // 1. Generate or use custom pitch
      let pitchText = customPitch;
      if (!pitchText) {
        const generated = await generatePersonalizedPitch(ctx, Boolean(isFollowUp));
        pitchText = generated.pitch;
      }

      // 2. Dispatch mechanism:
      // When a headless WhatsApp gateway (like Evolution API or Baileys) is configured via env, send via HTTP.
      // Otherwise, record the pitch and status as 'contacted' with dispatched metadata.
      const whatsappGatewayUrl = process.env.WHATSAPP_GATEWAY_URL;
      const gatewayApiKey = process.env.WHATSAPP_GATEWAY_API_KEY;

      let dispatchSuccess = true;
      let dispatchLog = 'Prepared and queued in outreach pipeline';

      if (whatsappGatewayUrl) {
        try {
          const res = await fetch(`${whatsappGatewayUrl}/message/sendText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(gatewayApiKey ? { apikey: gatewayApiKey } : {}),
            },
            body: JSON.stringify({
              number: ctx.phone.replace(/\D/g, ''),
              text: pitchText,
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gateway returned HTTP ${res.status}: ${errText}`);
          }
          dispatchLog = 'Sent automatically via WhatsApp Gateway';
        } catch (err) {
          dispatchSuccess = false;
          dispatchLog = `Gateway send failed: ${err instanceof Error ? err.message : String(err)}`;
          log.error({ leadId, err }, dispatchLog);
        }
      }

      // 3. Update lead in database
      const now = new Date();
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: isFollowUp ? 'contacted' : 'contacted',
          contactedAt: now,
          notes: `${dispatchLog} (${now.toLocaleDateString('es-AR')})`,
          metadata: {
            lastPitchSent: pitchText,
            dispatchedAt: now.toISOString(),
            channel: 'whatsapp',
            gatewayUsed: Boolean(whatsappGatewayUrl),
            success: dispatchSuccess,
          },
        },
      });

      // Humanized jitter sleep: between 60s and 120s to simulate natural human activity
      const jitterMs = Math.floor(60_000 + Math.random() * 60_000);
      log.info({ leadId, nextDelaySec: Math.round(jitterMs / 1000) }, 'cooling down before next message');
      await new Promise((r) => setTimeout(r, jitterMs));
    },
    {
      connection: redis,
      concurrency: 1, // STRICTLY 1 at a time to prevent simultaneous blasting
    }
  );

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, leadId: job?.data.leadId, err }, 'outreach job failed');
  });

  return worker;
}
