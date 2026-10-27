import { test, expect } from '@playwright/test';
import { createSeedData, DEMO_ACCOUNTS, DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';

/**
 * Sprint 3: a champion works with no connection and everything reaches the server once the
 * connection is back (US-13 to US-15). Runs on the demo build and, with E2E_TARGET=real, on the
 * real server and MongoDB.
 */
const REAL = process.env.E2E_TARGET === 'real';
const RUN = REAL ? `-${Date.now().toString(36).slice(-5)}` : '';
const field = (label) => new RegExp(`^${label}( \\*)?$`);
const isoDaysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function signInAsChampion(page) {
  await page.goto('/login');
  if (REAL) {
    const account = DEMO_ACCOUNTS.find((a) => a.role === 'champion');
    const { email } = createSeedData().users.find((u) => u.id === uid(account.userNumber));
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
    await page.locator('button[type="submit"]').click();
  } else {
    await page.getByRole('button', { name: /^Club Champion/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('a champion works offline and the changes sync when the connection is back', async ({
  page,
  context,
}) => {
  const status = page.locator('.sync-status');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const first = `Nafula${RUN}`;
  const name = `${first} Offline`;

  await signInAsChampion(page);
  await expect(status).toHaveText('All changes synced', { timeout: 15_000 });
  // The numbers are saved on the device once they have loaded (slow on a remote database).
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 30_000 });
  // The app itself is cached by the service worker, so it can open with no connection.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(status).toContainText('Offline');
  await expect(page.getByText(/You are offline\. These numbers are from/)).toBeVisible();

  // US-14: register a learner offline. The number is given by the server later.
  await nav.getByRole('link', { name: 'Learners' }).click();
  await page.getByRole('link', { name: 'Register learner' }).click();
  await expect(page.getByRole('heading', { name: 'Register learner' })).toBeVisible();
  await page.getByLabel(field('Club')).selectOption({ label: 'NAC-001 · Mwangaza Scratch Stars' });
  await page.getByLabel(field('First name')).fill(first);
  await page.getByLabel(field('Last name')).fill('Offline');
  await page.getByLabel(field('Age')).fill('10');
  await page.getByLabel(field('Gender')).selectOption('girl');
  await page.getByLabel(field('Grade')).selectOption('grade_5');
  await page.getByLabel(field('School admission number')).fill(`OFF-${Date.now()}`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Given after sync')).toBeVisible();
  await expect(status).toHaveText('Offline · 1 change waiting to sync');

  // Report a session at NAC-001 and take attendance, still offline. Real data persists, so try
  // days in the edit window until one is free.
  await nav.getByRole('link', { name: 'Sessions' }).click();
  await page.getByRole('link', { name: 'Report a session' }).click();
  await expect(page.getByRole('heading', { name: 'Report a session' })).toBeVisible();
  await page.getByLabel(field('Club')).selectOption({ label: 'NAC-001 · Mwangaza Scratch Stars' });
  await page.getByLabel(field('Topic covered')).fill(`Unplugged: sorting networks${RUN}`);
  for (const days of [0, 1, 2, 3, 4, 5, 6]) {
    await page.getByLabel(field('Date')).fill(isoDaysAgo(days));
    await page.getByRole('button', { name: 'Save' }).click();
    const saved = page.getByRole('button', { name: 'All present' });
    const taken = page.getByText('This club already has a session on this date');
    await expect(saved.or(taken)).toBeVisible();
    if (await saved.isVisible()) break;
  }
  await page.getByRole('button', { name: 'All present' }).click();
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await expect(page.getByText('Attendance saved')).toBeVisible();
  await expect(status).toHaveText('Offline · 3 changes waiting to sync');

  await nav.getByRole('link', { name: 'Sync' }).click();
  await expect(page.getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing needs attention')).toBeVisible();

  // US-15: back online, everything is sent without the user doing anything.
  await context.setOffline(false);
  await expect(status).toHaveText('All changes synced', { timeout: 20_000 });

  await nav.getByRole('link', { name: 'Learners' }).click();
  await page.getByRole('searchbox').fill(first);
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('row')).toHaveCount(2); // header + the learner, saved once
  await expect(page.getByRole('cell', { name: /^NAC-001-\d{3}$/ })).toBeVisible();
});
