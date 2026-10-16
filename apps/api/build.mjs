// Compiles our TypeScript (incl. @cc/shared and the generated Prisma client) into dist/*.js.
// npm dependencies stay external and are installed next to it in the production image.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@cc/'));

await build({
  entryPoints: ['src/server.ts', 'src/worker.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external,
  logLevel: 'info',
});
