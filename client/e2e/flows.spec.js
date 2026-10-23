import { test, expect } from '@playwright/test';
import { createSeedData, DEMO_ACCOUNTS, DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';

/**
 * Runs against the demo build (mock API, fresh data per test) by default, or against the real
 * server and MongoDB with E2E_TARGET=real (seeded data that persists between runs).
 */
const REAL = process.env.E2E_TARGET === 'real';
// Real data persists, so names created by a run get a suffix to stay unique.
const RUN = REAL ? ` ${Date.now().toString(36).slice(-5)}` : '';
const { users } = createSeedData();
const ROLE_LABELS = {
  'System Administrator': 'system_admin',
  'Club Champion': 'champion',
  Mratibu: 'coordinator',
};

/** Matches a field label exactly, with or without the required marker. */
const field = (label) => new RegExp(`^${label}( \\*)?$`);

async function signInAs(page, roleLabel, { goto = true, dashboard = 'Dashboard' } = {}) {
  if (goto) await page.goto('/login');
  if (REAL) {
    const account = DEMO_ACCOUNTS.find((a) => a.role === ROLE_LABELS[roleLabel]);
    const { email } = users.find((u) => u.id === uid(account.userNumber));
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
    await page.locator('button[type="submit"]').click();
  } else {
    await page.getByRole('button', { name: new RegExp(`^${roleLabel}`) }).click();
  }
  await expect(page.getByRole('heading', { name: dashboard })).toBeVisible();
}

test('admin adds a school, then a club there, then assigns a champion', async ({ page }) => {
  await signInAs(page, 'System Administrator');

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Schools' })
    .click();
  await page.getByRole('link', { name: 'Add school' }).click();
  await page.getByLabel(field('Name')).fill(`Gatina Primary School${RUN}`);
  await page.getByLabel(field('Type')).selectOption('primary_school');
  await page.getByLabel(field('Region')).selectOption('nairobi_central');
  await page.getByLabel(field('County')).selectOption('Nairobi');
  await page.getByLabel(field('Sub-county')).fill('Dagoretti North');
  await page.getByLabel(field('Host contact phone')).fill('0712345678');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Use the format +2547XXXXXXXX or +2541XXXXXXXX')).toBeVisible();
  await page.getByLabel(field('Host contact phone')).fill('+254700000999');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: `Gatina Primary School${RUN}` })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Clubs' })
    .click();
  await page.getByRole('link', { name: 'Add club' }).click();
  await page.getByLabel(field('Name')).fill(`Gatina Code Club${RUN}`);
  await page
    .getByLabel(field('School'))
    .selectOption({ label: `Gatina Primary School${RUN} (Nairobi)` });
  await page.getByLabel(field('Meeting day')).selectOption('wednesday');
  await page.getByLabel(field('Start time')).fill('16:00');
  await page.getByLabel(field('End time')).fill('15:00');
  await page.getByLabel(field('Main track')).selectOption('scratch');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('End time must be after start time')).toBeVisible();
  await page.getByLabel(field('End time')).fill('17:00');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: `Gatina Code Club${RUN}` })).toBeVisible();
  await expect(page.getByText(REAL ? /^NAC-\d{3}$/ : 'NAC-004')).toBeVisible();

  await page.getByRole('button', { name: 'Assign champion' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(field('Champion')).selectOption({ label: 'Kevin Omondi' });
  await dialog.getByLabel(field('Role in this club')).selectOption('lead');
  await dialog.getByRole('button', { name: 'Assign champion' }).click();
  await expect(page.getByText('Kevin Omondi')).toBeVisible();
});

test('a champion sees only their own clubs and cannot open others', async ({ page }) => {
  await signInAs(page, 'Club Champion');
  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Clubs' })
    .click();
  await expect(page.getByRole('row')).toHaveCount(3); // header + NAC-001 + NAC-002
  await expect(page.getByText('Mwangaza Scratch Stars')).toBeVisible();

  // WNY-001 belongs to another champion: it looks exactly like a missing page.
  await page.goto('/clubs/00000000-0000-4000-8000-000000000204');
  await expect(page.getByText('Page not found')).toBeVisible();
});

test('the app works in Kiswahili', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: 'Kiswahili' }).click();
  await signInAs(page, 'Mratibu', { goto: false, dashboard: 'Dashibodi' });
  await page
    .getByRole('navigation', { name: 'Menyu kuu' })
    .getByRole('link', { name: 'Vilabu' })
    .click();
  await expect(page.getByRole('heading', { name: 'Vilabu', exact: true })).toBeVisible();
  await expect(page.getByText('Kanda zote')).toBeAttached();
});
