import { test, expect } from '@playwright/test';
import { createSeedData, DEMO_ACCOUNTS, DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';

/**
 * Sprint 4 flows: an event from creation to registration with event consent, and an announcement
 * from HQ to a champion. Demo build by default, or the real server with E2E_TARGET=real.
 */
const REAL = process.env.E2E_TARGET === 'real';
const RUN = REAL ? ` ${Date.now().toString(36).slice(-5)}` : '';
const { users } = createSeedData();
const ROLE_LABELS = {
  'Programme Manager': 'programme_manager',
  'Club Champion': 'champion',
};
const field = (label) => new RegExp(`^${label}( \\*)?$`);
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function signInAs(page, roleLabel) {
  await page.goto('/login');
  if (REAL) {
    const account = DEMO_ACCOUNTS.find((a) => a.role === ROLE_LABELS[roleLabel]);
    const { email } = users.find((u) => u.id === uid(account.userNumber));
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
    await page.locator('button[type="submit"]').click();
  } else {
    await page.getByRole('button', { name: new RegExp(`^${roleLabel}`) }).click();
  }
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function signOut(page) {
  await page.locator('.app-user').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

const nav = (page, name) =>
  page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name }).click();

test('HQ creates an event; a champion registers a learner and records event consent', async ({
  page,
}) => {
  const name = `Kibera Coding Day${RUN}`;
  await signInAs(page, 'Programme Manager');
  await expect(page.getByRole('heading', { name: 'Programme overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clubs that need attention' })).toBeVisible();

  await nav(page, 'Events');
  await page.getByRole('link', { name: 'New event' }).click();
  await page.getByLabel(field('Name')).fill(name);
  await page.getByLabel(field('Starts')).fill(day(12));
  await page.getByLabel(field('Ends')).fill(day(12));
  await page.getByLabel(field('Venue')).fill('Kibera Community Hall');
  await page.getByLabel(field('Region')).selectOption('nairobi_central');
  await page.getByLabel(field('Status')).selectOption('open');
  await page.getByRole('checkbox', { name: /NAC-001/ }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await signOut(page);

  await signInAs(page, 'Club Champion');
  await nav(page, 'Events');
  await page.getByRole('link', { name }).click();
  await page.getByRole('button', { name: 'Register learners' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: /^Zawadi Mwangi/ }).check();
  await dialog.getByRole('button', { name: 'Register learners' }).click();
  const row = page.getByRole('row', { name: /Zawadi Mwangi/ });
  await expect(row).toContainText('Pending');
  await expect(page.getByText('1 of your learners has no event consent yet.')).toBeVisible();

  await row.getByRole('button', { name: 'Record consent' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('row', { name: /Zawadi Mwangi/ })).toContainText('Given');
});

test('HQ sends an announcement; the champion sees it, opens it and the sender sees the read', async ({
  page,
}) => {
  const title = `Robotics kits arriving${RUN}`;
  await signInAs(page, 'Programme Manager');
  await nav(page, 'Announcements');
  await page.getByRole('button', { name: 'New announcement' }).click();
  await page.getByLabel(field('Title')).fill(title);
  await page.getByLabel(field('Message')).fill('Kits reach Nairobi clubs next week.');
  await page.getByRole('checkbox', { name: /NAC-001/ }).check();
  await page.getByRole('checkbox', { name: 'SMS' }).check();
  await expect(page.getByText(/Reaches 1 people/)).toBeVisible();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText('Read by 0 of 1')).toBeVisible();
  await signOut(page);

  await signInAs(page, 'Club Champion');
  await expect(page.getByRole('link', { name: /new announcement/ })).toBeVisible();
  await page.getByRole('link', { name: /new announcement/ }).click();
  await page.getByRole('button', { name: title }).click();
  await expect(page.getByText('Kits reach Nairobi clubs next week.')).toBeVisible();
  await signOut(page);

  await signInAs(page, 'Programme Manager');
  await nav(page, 'Announcements');
  await page.getByText('Sent', { exact: true }).click();
  await expect(page.getByText('Read by 1 of 1')).toBeVisible();
});
