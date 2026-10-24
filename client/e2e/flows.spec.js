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

// A real 1×1 PNG, so the browser can shrink it before upload like a camera photo.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const isoDaysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

test('a champion registers a learner, records consent, reports a session and takes attendance', async ({
  page,
}) => {
  const first = `Wanjiku${RUN.replace(' ', '-')}`;
  const name = `${first} Kamau`;
  await signInAs(page, 'Club Champion');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });

  // US-07 and US-08: register with a guardian contact the champion cannot read back.
  await nav.getByRole('link', { name: 'Learners' }).click();
  await page.getByRole('link', { name: 'Register learner' }).click();
  // The list page also has a "Club" filter, so wait for the form before filling it.
  await expect(page.getByRole('heading', { name: 'Register learner' })).toBeVisible();
  await page.getByLabel(field('Club')).selectOption({ label: 'NAC-001 · Mwangaza Scratch Stars' });
  await page.getByLabel(field('First name')).fill(first);
  await page.getByLabel(field('Last name')).fill('Kamau');
  await page.getByLabel(field('Age')).fill('7');
  await page.getByLabel(field('Gender')).selectOption('girl');
  await page.getByLabel(field('Grade')).selectOption('grade_6');
  await page.getByLabel(field('School admission number')).fill(`E2E-${Date.now()}`);
  await page.getByLabel(field('Guardian name')).fill('Lucy Kamau');
  await page.getByLabel(field('Relationship')).selectOption('mother');
  await page.getByLabel(field('Phone')).fill('+254700000901');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Must be at least 9')).toBeVisible();
  await page.getByLabel(field('Age')).fill('11');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('A guardian contact is on file.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show contact' })).toHaveCount(0);
  await expect(page.getByText('Lucy Kamau')).toHaveCount(0);

  // US-09: participation consent with the signed form.
  await page.getByRole('button', { name: 'Record consent' }).first().click();
  const consent = page.getByRole('dialog');
  await consent.getByLabel(field('Consent status')).selectOption('given');
  await consent
    .getByLabel(field('Signed form \\(photo or PDF\\)'))
    .setInputFiles({ name: 'form.png', mimeType: 'image/png', buffer: PNG });
  await consent.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Participation: Given')).toBeVisible();
  await expect(page.getByText(/· Signed form uploaded/)).toBeVisible();
  // Champions record consent but cannot open the form (D2-1).
  await expect(page.getByRole('button', { name: 'Download form' })).toHaveCount(0);

  // US-10: report a session. Real data persists, so pick a free day in the edit window.
  await nav.getByRole('link', { name: 'Sessions' }).click();
  await page.getByRole('link', { name: 'Report a session' }).click();
  await expect(page.getByRole('heading', { name: 'Report a session' })).toBeVisible();
  await page.getByLabel(field('Club')).selectOption({ label: 'NAC-001 · Mwangaza Scratch Stars' });
  await page
    .getByLabel(field('Date'))
    .fill(isoDaysAgo(REAL ? [0, 2, 3, 4, 5, 6][Date.now() % 6] : 0));
  await page.getByLabel(field('Topic covered')).fill(`Scratch: broadcast messages${RUN}`);
  await page.getByLabel('What was done and any challenges').fill('Built a chat between sprites.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(`Scratch: broadcast messages${RUN}`).first()).toBeVisible();

  // US-11: attendance in one step.
  await page.getByRole('button', { name: 'All present' }).click();
  await page.getByRole('radiogroup', { name }).getByRole('radio', { name: 'Late' }).click();
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await expect(page.getByText('Attendance saved')).toBeVisible();
  await expect(
    page.getByRole('radiogroup', { name }).getByRole('radio', { name: 'Late' }),
  ).toHaveAttribute('aria-checked', 'true');

  // D2-7: the new learner has no photo consent, so the photo needs a confirmation.
  await page.getByLabel('Add photo').setInputFiles({
    name: 'session.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  const check = page.getByRole('dialog');
  await expect(check.getByText(name)).toBeVisible();
  await expect(check.getByRole('button', { name: 'Add photo' })).toBeDisabled();
  await check.getByLabel('I confirm none of these learners can be seen in the photo').check();
  await check.getByRole('button', { name: 'Add photo' }).click();
  await expect(page.getByRole('img', { name: 'Session photo 1' })).toBeVisible();
});
