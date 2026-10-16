import type { Checker } from './define.js';
import { domainExpiry } from './domain-expiry.js';
import { httpUptime } from './http-uptime.js';
import { sslExpiry } from './ssl-expiry.js';

// To watch something new: write one checker file and add it here.
export const checkers: readonly Checker[] = [httpUptime, sslExpiry, domainExpiry];

export const checkerById = new Map(checkers.map((c) => [c.id, c]));
