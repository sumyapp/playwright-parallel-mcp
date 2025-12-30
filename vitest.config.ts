import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60000, // Browser tests need longer timeout
    hookTimeout: 60000, // Session cleanup may take time
    pool: 'forks',      // Isolate tests to prevent resource contention
    poolOptions: {
      forks: {
        singleFork: true // Run sequentially to avoid browser conflicts
      }
    }
  }
});
