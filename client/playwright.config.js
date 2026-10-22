import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4173',
    // Optional: point at an already-installed Chromium instead of `npx playwright install`.
    ...(process.env.PW_CHROMIUM_PATH && {
      launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH },
    }),
  },
  webServer: {
    // Demo build: the in-browser mock API stands in for the server, so no database is needed (D1-20).
    command: 'npm run build:demo && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
