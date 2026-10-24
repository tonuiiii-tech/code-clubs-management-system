import { defineConfig, devices } from '@playwright/test';

// E2E_TARGET=real runs the flows against the real API and MongoDB (MONGODB_URI, already seeded).
// Otherwise they run against the demo build, where the in-browser mock API stands in (D1-20).
const REAL = process.env.E2E_TARGET === 'real';

const client = {
  command: REAL
    ? 'npm run build && npm run preview -- --port 4173 --strictPort'
    : 'npm run build:demo && npm run preview -- --port 4173 --strictPort',
  port: 4173,
  reuseExistingServer: !process.env.CI,
};

const server = {
  command: 'npm run start --workspace server',
  cwd: '..',
  url: 'http://localhost:4000/api/v1/health',
  reuseExistingServer: !process.env.CI,
  env: { CORS_ORIGIN: 'http://localhost:4173', PORT: '4000' },
};

export default defineConfig({
  testDir: './e2e',
  // Real data is shared between tests, so run them one at a time there.
  workers: REAL ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // Kept only for failed tests, so CI failures can be inspected from the uploaded artifact.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Optional: point at an already-installed Chromium instead of `npx playwright install`.
    ...(process.env.PW_CHROMIUM_PATH && {
      launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH },
    }),
  },
  webServer: REAL ? [server, client] : client,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
