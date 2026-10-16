import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';

export const SESSION_COOKIE = 'cc_session';
export const SESSION_DAYS = 7;

// The browser holds the token; the database holds only its SHA-256.
// The token is 256 random bits, so a fast hash is enough (no salt or scrypt needed, unlike passwords).
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(prisma: PrismaClient, userId: string, meta: { ip?: string; userAgent?: string }) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }), // tidy up old ones
    prisma.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) },
    }),
  ]);
  return { token, expiresAt };
}

export async function findSessionUser(prisma: PrismaClient, token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function deleteSession(prisma: PrismaClient, token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
