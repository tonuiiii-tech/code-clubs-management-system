import { test, expect } from '@playwright/test';
import { createSeedData, DEMO_ACCOUNTS, DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';

/**
 * Sprint 5 flows (plan section 16): lending an item, saving a resource for use offline, and
 * recording an assessment. Demo build by default, or the real server with E2E_TARGET=real.
 */
const REAL = process.env.E2E_TARGET === 'real';
const RUN = REAL ? ` ${Date.now().toString(36).slice(-5)}` : '';
const { users } = createSeedData();
const ROLE_LABELS = {
  'Programme Manager': 'programme_manager',
  'Club Champion': 'champion',
};
const field = (label) => new RegExp(`^${label}( \\*)?$`);

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

const nav = (page, name) =>
  page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name }).click();

test('HQ adds a laptop, lends it to a club and records its return', async ({ page }) => {
  const name = `Laptop E2E${RUN}`;
  await signInAs(page, 'Programme Manager');
  await nav(page, 'Equipment');
  await expect(page.getByRole('heading', { name: 'Equipment' })).toBeVisible();
  await page.getByRole('link', { name: 'Add item' }).click();
  await page.getByLabel(field('Name')).fill(name);
  await page.getByLabel(field('HQ store \\(region\\)')).selectOption('nairobi_central');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('HQ store, Nairobi & Central')).toBeVisible();

  await page.getByRole('button', { name: 'Lend to a club' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel(field('Club'))
    .selectOption({ label: 'NAC-001 · Mwangaza Scratch Stars' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Item lent')).toBeVisible();
  await expect(page.getByText('Still with the club')).toBeVisible();
  // It cannot be lent twice: the button is gone until it is back.
  await expect(page.getByRole('button', { name: 'Lend to a club' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Record return' }).click();
  await page.getByRole('dialog').getByLabel(field('Condition now')).selectOption('needs_repair');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Return recorded')).toBeVisible();
  await expect(page.getByText('Needs repair').first()).toBeVisible();
});

test('a champion saves a worksheet and opens it with no connection', async ({ page, context }) => {
  await signInAs(page, 'Club Champion');
  await expect(page.locator('.sync-status')).toHaveText('All changes synced', { timeout: 15_000 });
  await nav(page, 'Resources');
  await page.getByRole('link', { name: 'Algorithms with paper and pencil' }).click();
  await expect(
    page.getByRole('heading', { name: 'Algorithms with paper and pencil' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save on this device' }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove from this device' })).toBeVisible();

  await context.setOffline(true);
  await nav(page, 'Resources');
  await expect(page.getByText(/Saved on this device: \d/)).toBeVisible();
  await page.getByRole('link', { name: 'Algorithms with paper and pencil' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Open file' }).click();
  expect((await download).suggestedFilename()).toBe('algorithms-worksheet.pdf');
  await context.setOffline(false);
});

test('a champion records an assessment and enters scores', async ({ page }) => {
  const title = `Loops quiz${RUN}`;
  await signInAs(page, 'Club Champion');
  await expect(page.locator('.sync-status')).toHaveText('All changes synced', { timeout: 15_000 });
  await nav(page, 'Clubs');
  await page.getByRole('link', { name: 'Mwangaza Scratch Stars' }).click();
  await page.getByRole('link', { name: 'Add assessment' }).click();
  await page.getByLabel(field('Title')).fill(title);
  await page.getByLabel(field('Maximum score')).fill('10');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  await page.getByLabel('Score for Zawadi Mwangi').fill('11');
  await expect(page.getByText('A score cannot be higher than the maximum score')).toBeVisible();
  await page.getByLabel('Score for Zawadi Mwangi').fill('8');
  await page.getByLabel('Score for Baraka Otieno').fill('6.5');
  await page.getByRole('button', { name: 'Save scores' }).click();
  await expect(page.getByText('Scores saved')).toBeVisible();
  await expect(page.locator('.sync-status')).toHaveText('All changes synced', { timeout: 15_000 });
  await page.reload();
  await expect(page.getByLabel('Score for Zawadi Mwangi')).toHaveValue('8');
  await expect(page.getByText('Average 73%')).toBeVisible();
});
