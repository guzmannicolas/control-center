// Creates a dashboard user, or sets a new password (and logs out every session) if it exists.
// The password is typed hidden, so it never lands in shell history or logs.
//   docker compose run --rm tools pnpm --filter @cc/api user:create you@example.com
import { z } from 'zod';
import { hashPassword } from './auth/password.js';
import { createPrisma } from './infra.js';

const MIN_LENGTH = 12;

function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Run this in an interactive terminal (docker compose run without -T).');
  process.stdout.write(question);
  return new Promise((resolve) => {
    let input = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.off('data', onData).setRawMode(false).pause();
          process.stdout.write('\n');
          return resolve(input);
        }
        if (ch === '\u0003') process.exit(130); // Ctrl+C
        input = ch === '\u007f' ? input.slice(0, -1) : input + ch;
      }
    };
    process.stdin.setRawMode(true).setEncoding('utf8').resume().on('data', onData);
  });
}

const email = z.email().safeParse(process.argv[2]?.toLowerCase());
if (!email.success) {
  console.error('Usage: user:create <email>');
  process.exit(1);
}

const password = await promptHidden(`Password for ${email.data} (min ${MIN_LENGTH} characters): `);
if (password.length < MIN_LENGTH) {
  console.error(`Too short: use at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}
if ((await promptHidden('Repeat it: ')) !== password) {
  console.error('The passwords do not match.');
  process.exit(1);
}

const prisma = createPrisma(z.string().min(1).parse(process.env.DATABASE_URL));
const passwordHash = await hashPassword(password);
const user = await prisma.user.upsert({
  where: { email: email.data },
  create: { email: email.data, passwordHash },
  update: { passwordHash, sessions: { deleteMany: {} } },
});
console.log(`✓ ${user.email} can log in.`);
await prisma.$disconnect();
