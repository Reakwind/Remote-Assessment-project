import { expect, test } from '@playwright/test';

test('review regression: backend audio upload failure is queued for retry before continuing', async ({ page }) => {
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

  await expect(page.getByText(/ההקלטה נשמרה בהצלחה/)).toBeVisible();
  await expect(page.getByRole('button', { name: /נסה שוב לשמור/ })).toBeVisible();

  const { storedTask, queuedSaves } = await page.evaluate(() => {
    const stored = window.localStorage.getItem('moca_assessment_state');
    const queue = window.localStorage.getItem('moca_assessment_autosave_queue_v1');
    return {
      storedTask: stored ? JSON.parse(stored).tasks?.memory ?? null : null,
      queuedSaves: queue ? JSON.parse(queue) : [],
    };
  });
  expect(storedTask).toEqual(expect.objectContaining({
    audioContentType: 'audio/webm',
    audioUploadPending: true,
  }));
  expect(queuedSaves).toEqual([
    expect.objectContaining({
      sessionId: 'audio-upload-failure-session',
      taskName: 'memory',
      taskType: 'moca-memory-learning',
      status: 'error',
      rawData: expect.objectContaining({ audioUploadPending: true }),
    }),
  ]);
});
