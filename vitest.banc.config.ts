import { defineConfig } from 'vitest/config';

/** Banc d'équilibrage (npm run banc) : hors de la suite de tests ordinaire. */
export default defineConfig({
  test: { include: ['world/banc/**/*.test.ts'] },
});
