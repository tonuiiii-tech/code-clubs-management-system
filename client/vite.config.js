import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  // `vite --mode demo` (npm run demo) runs on the in-browser mock API, no server or database needed (D1-20).
  define: mode === 'demo' ? { 'import.meta.env.VITE_USE_MOCKS': JSON.stringify('true') } : {},
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Sprint 1 caches the app shell only. Offline data and sync come in Sprint 3 (D1-5).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'STEAMLabs Code Clubs',
        short_name: 'Code Clubs',
        description: 'Manage STEAMLabs Africa code clubs across Kenya',
        theme_color: '#3E9E49',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
}));
