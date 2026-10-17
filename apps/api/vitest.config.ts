import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one test database: run files one after another so they never clear each other's data.
    fileParallelism: false,
  },
});
