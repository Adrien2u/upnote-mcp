import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@upnote/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
    },
  },
});
