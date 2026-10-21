import { test, expect } from '@playwright/test';

test('login page loads and switches to Kiswahili', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('radio', { name: 'Kiswahili' }).click();
  await expect(page.getByRole('heading', { name: 'Ingia' })).toBeVisible();
});
