import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*', 'tests/e2e/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/app/components/AssessmentLayout.tsx',
        'src/app/components/PatientProfilePage.tsx',
        'src/app/components/SessionValidation.tsx',
        'src/app/components/StimuliManifestProvider.tsx',
        'src/app/store/AssessmentContext.tsx',
        'src/hooks/useSession.ts',
        'src/lib/edgeFetch.ts',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 70,
        branches: 55,
        functions: 65,
        statements: 70,
      },
    },
  },
});
