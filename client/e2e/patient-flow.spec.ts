import { expect, test } from '@playwright/test';

test('patient entry loads from the configured app URL', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Remote (Assessment|Check)/);
  await expect(page.getByRole('heading', { name: 'כניסת מטופל' })).toBeVisible();
  await expect(page.getByLabel('מספר מבדק בן 8 ספרות')).toBeVisible();
  await expect(page.getByRole('button', { name: 'התחלת המבדק' })).toBeDisabled();
});

test.describe('patient PWA deploy preview', () => {
  test.skip(
    process.env.E2E_EXPECT_PATIENT_SURFACE !== '1',
    'Set E2E_EXPECT_PATIENT_SURFACE=1 and E2E_APP_URL to a patient build preview URL.',
  );

  test('exposes install assets and hides clinician routes', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Remote Assessment');
    await expect(page.getByRole('heading', { name: 'הערכה קוגניטיבית' })).toBeVisible();

    const manifest = await page.request.get('/patient.webmanifest');
    expect(manifest.ok()).toBe(true);
    const manifestJson = await manifest.json();
    expect(manifestJson.name).toBe('Remote Assessment');

    const serviceWorker = await page.request.get('/patient-sw.js');
    expect(serviceWorker.ok()).toBe(true);

    await page.goto('/#/clinician/auth');
    await expect(page).toHaveURL(/\/#\/$/);
    await expect(page.getByRole('heading', { name: 'כניסת מטופל' })).toBeVisible();
  });
});
