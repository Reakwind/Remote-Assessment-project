import { expect, test } from '@playwright/test';

test('review regression: backend audio upload failure is not shown as saved evidence', async ({ page }) => {
  await page.route('**/functions/v1/save-audio', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Failed to upload audio' }),
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('moca_assessment_state', JSON.stringify({
      id: 'audio-upload-failure-session',
      linkToken: 'patient-link-token',
      scoringContext: {
        sessionId: 'audio-upload-failure-session',
        sessionDate: new Date().toISOString(),
        educationYears: 12,
        patientAge: 75,
        mocaVersion: '8.3',
      },
      lastPath: '/patient/memory',
      isComplete: false,
      tasks: {},
    }));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }],
        }),
      },
    });

    class MockMediaRecorder {
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      start() {}

      stop() {
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    });
  });

  await page.goto('/#/patient/memory');

  await page.getByRole('button', { name: /התחל הקלטה/ }).click();
  await expect(page.getByRole('button', { name: /עצור הקלטה/ })).toBeVisible();
  await page.getByRole('button', { name: /עצור הקלטה/ }).click();

  await expect(page.getByText('Failed to upload audio')).toBeVisible();
  await expect(page.getByText(/ההקלטה נשמרה בהצלחה/)).toBeHidden();

  const storedTask = await page.evaluate(() => {
    const stored = window.localStorage.getItem('moca_assessment_state');
    return stored ? JSON.parse(stored).tasks?.memory ?? null : null;
  });
  expect(storedTask).toBeNull();
});
