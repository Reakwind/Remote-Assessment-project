// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({
  edgeFn: (name: string) => `/functions/v1/${name}`,
  edgeHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

import { AssessmentLayout } from '../AssessmentLayout';
import { LandingHub } from '../LandingHub';
import { SessionValidation } from '../SessionValidation';
import { AssessmentProvider } from '../../store/AssessmentContext';

const STORAGE_KEY = 'moca_assessment_state';

function storedAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    linkToken: 'token-1',
    scoringContext: {
      sessionId: 'session-1',
      sessionDate: new Date('2026-04-25T12:00:00Z').toISOString(),
      educationYears: 12,
      patientAge: 75,
      mocaVersion: '8.2',
    },
    lastPath: '/patient/clock',
    isComplete: false,
    tasks: {},
    ...overrides,
  };
}

function renderWithProvider(routes: Parameters<typeof createMemoryRouter>[0], initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  render(
    <AssessmentProvider>
      <RouterProvider router={router} />
    </AssessmentProvider>,
  );
  return router;
}

describe('patient resume state', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reopens a matching in-progress link from local resume state without consuming the token again', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const router = renderWithProvider(
      [
        { path: '/session/:token', element: <SessionValidation /> },
        { path: '/patient/clock', element: <div>Clock task resumed</div> },
      ],
      '/session/token-1',
    );

    await screen.findByText('Clock task resumed');
    expect(router.state.location.pathname).toBe('/patient/clock');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not offer resume controls for stale stored state without a token', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment({ linkToken: null })));

    renderWithProvider([{ path: '/', element: <LandingHub /> }], '/');

    expect(screen.queryByText('המשך את המבחן מאיפה שהפסקת')).not.toBeInTheDocument();
  });

  it('shows the stored MoCA version in the patient assessment header', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));

    renderWithProvider(
      [
        {
          path: '/patient',
          element: <AssessmentLayout />,
          children: [{ path: 'clock', element: <div>Clock body</div> }],
        },
      ],
      '/patient/clock',
    );

    await waitFor(() => {
      expect(screen.getByText('גרסה 8.2')).toBeInTheDocument();
    });
  });
});
