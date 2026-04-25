import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*', 'tests/e2e/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/scoring/**/*.ts'],
      exclude: ['src/lib/scoring/**/__tests__/**'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
        perFile: true,
      },
    },
  },
});
