import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/tests/**/*.test.ts', 'world/tests/**/*.test.ts', 'narrative/tests/**/*.test.ts', 'audio/tests/**/*.test.ts', 'client/tests/**/*.test.ts'],
  },
});
