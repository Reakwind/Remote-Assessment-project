import { createMemoryRouter, RouterProvider } from 'react-router';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssessmentLayout } from './AssessmentLayout';
import { LandingHub } from './LandingHub';
import { AssessmentProvider } from '../store/AssessmentContext';
import { ASSESSMENT_STORAGE_KEY, type AssessmentState } from '../store/assessmentPersistence';

const storedState: AssessmentState = {
  id: 'session-1',
  linkToken: 'token-1',
  scoringContext: {
    sessionId: 'session-1',
    sessionDate: new Date('2026-04-25T10:00:00.000Z'),
    mocaVersion: '8.2',
    educationYears: 12,
    patientAge: 75,
    sessionLocation: { place: 'Clinic', city: 'Tel Aviv' },
  },
  lastPath: '/patient/clock',
  isComplete: false,
  tasks: {},
};

describe('patient shell', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    container.remove();
  });

  it('shows the selected MoCA version in the patient assessment header', async () => {
    localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(storedState));

    await renderWithRoutes([
      {
        path: '/patient',
        element: <AssessmentLayout />,
        children: [{ path: 'clock', element: <div>Clock task</div> }],
      },
    ], '/patient/clock');

    expect(container.textContent).toContain('גרסה 8.2');
  });

  it('clears completed patient state when the patient returns home', async () => {
    localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify({ ...storedState, isComplete: true }));

    await renderWithRoutes([{ path: '/', element: <LandingHub /> }], '/');
    await act(async () => {});

    const saved = JSON.parse(localStorage.getItem(ASSESSMENT_STORAGE_KEY) ?? '{}') as AssessmentState;
    expect(saved.id).toBeNull();
    expect(container.textContent).not.toContain('המשך את המבחן מאיפה שהפסקת');
  });

  async function renderWithRoutes(routes: Parameters<typeof createMemoryRouter>[0], initialEntry: string) {
    const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <AssessmentProvider>
          <RouterProvider router={router} />
        </AssessmentProvider>,
      );
    });
  }
});
