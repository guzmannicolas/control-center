import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { dummyHash, verifyPassword } from './password.js';
import { SESSION_COOKIE, createSession, deleteSession, findSessionUser } from './sessions.js';

// The API is only reachable through the Cloudflare tunnel, which sets the visitor's real IP here.
export const clientIp = (req: FastifyRequest) => (req.headers['cf-connecting-ip'] as string | undefined) ?? req.ip;

const Login = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});

export interface AuthOptions {
  prisma: PrismaClient;
  cookieSecure: boolean;
}

export const authRoutes: FastifyPluginAsync<AuthOptions> = async (app, { prisma, cookieSecure }) => {
  app.post(
    '/auth/login',
    // Brute force protection: 5 attempts per 15 minutes per IP.
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes', keyGenerator: clientIp } } },
    async (req, reply) => {
      const body = Login.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'Email and password are required' });

      const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
      const valid = await verifyPassword(body.data.password, user?.passwordHash ?? (await dummyHash()));
      // Same answer for "no such email" and "wrong password": never confirm which emails exist.
      if (!user || !valid) return reply.code(401).send({ error: 'Wrong email or password' });

      const { token, expiresAt } = await createSession(prisma, user.id, { ip: clientIp(req), userAgent: req.headers['user-agent'] });
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true, // page JavaScript cannot read it, so an XSS bug cannot steal the session
        secure: cookieSecure, // only sent over HTTPS
        sameSite: 'lax', // not sent on requests started by other sites
        path: '/',
        expires: expiresAt,
      });
      return { user: { id: user.id, email: user.email } };
    },
  );

  app.post('/auth/logout', async (req, reply) => {
    await deleteSession(prisma, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', async (req, reply) => {
    const user = await findSessionUser(prisma, req.cookies[SESSION_COOKIE]);
    if (!user) return reply.code(401).send({ error: 'Not logged in' });
    return { user };
  });
};
