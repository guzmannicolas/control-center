import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: ScryptOptions) => Promise<Buffer>;

// scrypt is deliberately slow and memory-hungry, so guessing passwords offline is expensive.
// N=2^16, r=8 uses 64 MB per hash. Parameters are stored with the hash so they can be raised later.
const PARAMS = { N: 2 ** 16, r: 8, p: 1 };
const KEY_LENGTH = 32;

const derive = (password: string, salt: Buffer, p: typeof PARAMS) =>
  scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...p, maxmem: 128 * p.N * p.r * 2 });

// Format: scrypt$N$r$p$salt$hash (base64url)
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), { N: Number(N), r: Number(r), p: Number(p) });
  // Constant-time comparison: how long it takes reveals nothing about how close the guess was.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used when the email does not exist, so "unknown email" takes as long as "wrong password"
// and response times cannot reveal which emails have accounts.
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword(randomBytes(16).toString('hex')));
