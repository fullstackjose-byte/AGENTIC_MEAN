import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['smoke/openai.smoke.ts'],
    testTimeout: 30_000,
  },
});
