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
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
