import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { rm } from 'fs/promises';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '');
        return path.resolve(__dirname, 'src/assets', filename);
      }
    },
  };
}

function patientPwaHead(surface: string) {
  return {
    name: 'patient-pwa-head',
    transformIndexHtml(html: string) {
      if (surface !== 'patient') return html;

      return {
        html: html.replace('<title>Remote Check</title>', '<title>Remote Assessment</title>'),
        tags: [
          { tag: 'link', attrs: { rel: 'manifest', href: '/patient.webmanifest' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/patient-icon-192.png' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'theme-color', content: '#111827' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Assessment' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }, injectTo: 'head' },
        ],
      };
    },
  };
}

function surfacePublicAssets(surface: string, outDir: string) {
  const patientOnlyFiles = [
    'patient.webmanifest',
    'patient-sw.js',
    'patient-icon.svg',
    'patient-icon-192.png',
    'patient-icon-512.png',
  ];

  return {
    name: 'surface-public-assets',
    async closeBundle() {
      if (surface === 'patient') return;

      await Promise.all(
        patientOnlyFiles.map((filename) =>
          rm(path.resolve(__dirname, outDir, filename), { force: true }),
        ),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const surface = env.VITE_APP_SURFACE ?? 'combined';
  const outDir = env.VITE_BUILD_OUT_DIR ?? 'dist';

  return {
    build: {
      outDir,
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router/')) {
              return 'react-vendor';
            }
            if (id.includes('/@radix-ui/') || id.includes('/lucide-react/') || id.includes('/recharts/')) {
              return 'ui-vendor';
            }
            return 'vendor';
          },
        },
      },
    },
    plugins: [
      patientPwaHead(surface),
      surfacePublicAssets(surface, outDir),
      tailwindcss(),
      figmaAssetResolver(),
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  };
});
