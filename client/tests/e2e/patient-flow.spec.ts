import { test, expect } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page).toHaveTitle(/client/);
});
