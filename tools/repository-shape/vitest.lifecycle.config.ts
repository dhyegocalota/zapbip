import { defineConfig } from 'vitest/config';

const LIFECYCLE_TEST_TIMEOUT_MS = 1_200_000;

export default defineConfig({
  test: {
    include: ['src/agent-lifecycle-*.test.ts'],
    fileParallelism: false,
    testTimeout: LIFECYCLE_TEST_TIMEOUT_MS,
    hookTimeout: LIFECYCLE_TEST_TIMEOUT_MS,
  },
});
