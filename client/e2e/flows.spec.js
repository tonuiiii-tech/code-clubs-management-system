import { test, expect } from '@playwright/test';

/** Runs against the demo build (mock API, fictional data). Each test starts with fresh data. */

/** Matches a field label exactly, with or without the required marker. */
const field = (label) => new RegExp(`^${label}( \\*)?$`);

async function signInAs(page, roleLabel) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`^${roleLabel}`) }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('admin adds a school, then a club there, then assigns a champion', async ({ page }) => {
  await signInAs(page, 'System Administrator');

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Schools' })
    .click();
  await page.getByRole('link', { name: 'Add school' }).click();
  await page.getByLabel(field('Name')).fill('Gatina Primary School');
  await page.getByLabel(field('Type')).selectOption('primary_school');
  await page.getByLabel(field('Region')).selectOption('nairobi_central');
  await page.getByLabel(field('County')).selectOption('Nairobi');
  await page.getByLabel(field('Sub-county')).fill('Dagoretti North');
  await page.getByLabel(field('Host contact phone')).fill('0712345678');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Use the format +2547XXXXXXXX or +2541XXXXXXXX')).toBeVisible();
  await page.getByLabel(field('Host contact phone')).fill('+254700000999');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Gatina Primary School' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Clubs' })
    .click();
  await page.getByRole('link', { name: 'Add club' }).click();
  await page.getByLabel(field('Name')).fill('Gatina Code Club');
  await page.getByLabel(field('School')).selectOption({ label: 'Gatina Primary School (Nairobi)' });
  await page.getByLabel(field('Meeting day')).selectOption('wednesday');
  await page.getByLabel(field('Start time')).fill('16:00');
  await page.getByLabel(field('End time')).fill('15:00');
  await page.getByLabel(field('Main track')).selectOption('scratch');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('End time must be after start time')).toBeVisible();
  await page.getByLabel(field('End time')).fill('17:00');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Gatina Code Club' })).toBeVisible();
  await expect(page.getByText('NAC-004')).toBeVisible();

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
  await page.getByRole('button', { name: /^Mratibu/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashibodi' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Menyu kuu' })
    .getByRole('link', { name: 'Vilabu' })
    .click();
  await expect(page.getByRole('heading', { name: 'Vilabu' })).toBeVisible();
  await expect(page.getByText('Kanda zote')).toBeAttached();
});
