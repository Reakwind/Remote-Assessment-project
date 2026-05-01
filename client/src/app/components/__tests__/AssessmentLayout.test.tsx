// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentLayout } from '../AssessmentLayout';

const assessmentMocks = vi.hoisted(() => ({
  useAssessmentStore: vi.fn(),
}));

vi.mock('../../store/AssessmentContext', () => ({
  useAssessmentStore: assessmentMocks.useAssessmentStore,
}));

vi.mock('../StimuliManifestProvider', () => ({
  StimuliManifestProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  StimulusReadinessBanner: () => <div data-testid="stimulus-readiness-banner" />,
}));

const scoringContext = {
  sessionId: 'session-1',
  sessionDate: '2026-04-25T12:00:00.000Z',
  educationYears: 12,
  patientAge: 75,
  mocaVersion: '8.3',
};

function renderLayout(initialPath = '/patient/cube') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <div>start page</div> },
      {
        path: '/patient',
        element: <AssessmentLayout />,
        children: [
          { path: 'cube', element: <div>cube task</div> },
          { path: 'clock', element: <div>clock task</div> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe('AssessmentLayout', () => {
  const store = {
    state: {
      scoringContext,
      tasks: {
        cube: {},
      },
    },
    setLastPath: vi.fn(),
    updateTaskData: vi.fn(),
    taskSaveStatus: {},
    retryFailedSaves: vi.fn(),
    hasInProgressAssessment: true,
  };

  beforeEach(() => {
    assessmentMocks.useAssessmentStore.mockReturnValue(store);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('marks a drawing task skipped when the patient continues without evidence', async () => {
    const router = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: /דלג והמשך/ }));

    expect(store.updateTaskData).toHaveBeenCalledWith('cube', expect.objectContaining({
      skipped: true,
      reason: 'no_evidence',
    }));
    expect(router.state.location.pathname).toBe('/patient/clock');
  });

  it('retries failed saves and blocks navigation until the answer is saved', async () => {
    assessmentMocks.useAssessmentStore.mockReturnValue({
      ...store,
      state: {
        ...store.state,
        tasks: {
          cube: {
            strokes: [[{ x: 1, y: 2 }]],
          },
        },
      },
      taskSaveStatus: {
        cube: {
          status: 'error',
          message: 'בדוק שהחיבור פעיל ואז נסה שוב.',
        },
      },
    });
    const router = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: /נסה שוב לשמור/ }));

    expect(store.retryFailedSaves).toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('בדוק שהחיבור פעיל ואז נסה שוב.');
    expect(router.state.location.pathname).toBe('/patient/cube');
  });

  it('normalizes technical drawing save errors and blocks navigation until the drawing is saved', async () => {
    assessmentMocks.useAssessmentStore.mockReturnValue({
      ...store,
      state: {
        ...store.state,
        tasks: {
          cube: {
            strokes: [[{ x: 1, y: 2 }]],
          },
        },
      },
      taskSaveStatus: {
        cube: {
          status: 'error',
          message: 'Failed to save drawing',
        },
      },
    });
    const router = renderLayout();

    expect(screen.getByText('שמירת הציור נכשלה. בדוק חיבור ונסה שוב לפני המעבר.')).toBeInTheDocument();
    expect(screen.queryByText('Failed to save drawing')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /נסה שוב לשמור/ }));

    expect(store.retryFailedSaves).toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('שמירת הציור נכשלה. בדוק חיבור ונסה שוב לפני המעבר.');
    expect(router.state.location.pathname).toBe('/patient/cube');
  });
});
