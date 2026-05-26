import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const repoName = process.env.REPO_NAME || 'daylife';
const onGitHubPages = process.env.GITHUB_PAGES === 'true';
const appScope = onGitHubPages ? `/${repoName}/` : '/';

export default defineConfig({
  base: appScope,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Rozka — Your day in one place',
        short_name: 'Rozka',
        description: 'Tasks, expenses, shopping, routines & shared lists — your daily life in one simple app.',
        theme_color: '#7C3AED',
        background_color: '#F9FAFB',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: appScope,
        scope: appScope,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${appScope}index.html`.replace(/\/+/g, '/'),
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'daylife-pages',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
  },
});
