// @prisma/client lists the Prisma CLI and TypeScript as peers. Paired with them, a production install
// drags in the CLI, Studio and TypeScript (~250 MB) that never run. The generated client only needs its runtime.
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === '@prisma/client') {
        // pnpm treats a name in peerDependenciesMeta as a peer by itself, so drop it from both.
        for (const name of ['prisma', 'typescript']) {
          delete pkg.peerDependencies?.[name];
          delete pkg.peerDependenciesMeta?.[name];
        }
      }
      return pkg;
    },
  },
};
