import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';
import { PrismaClient } from './generated/prisma/client.js';

export const createPrisma = (connectionString: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// BullMQ requires maxRetriesPerRequest: null (wait for Redis instead of failing jobs mid-way).
export const createRedis = (url: string) => new Redis(url, { maxRetriesPerRequest: null });
