// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionValidation } from '../SessionValidation';

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

const assessmentMocks = vi.hoisted(() => ({
  hasCompletedPatientOnboarding: vi.fn(),
  useAssessmentStore: vi.fn(),
}));

vi.mock('../../../hooks/useSession', () => ({
  useSession: sessionMocks.useSession,
}));

vi.mock('../../store/AssessmentContext', () => ({
  hasCompletedPatientOnboarding: assessmentMocks.hasCompletedPatientOnboarding,
  useAssessmentStore: assessmentMocks.useAssessmentStore,
}));

const scoringContext = {
  sessionId: 'session-1',
  sessionDate: '2026-04-25T12:00:00.000Z',
  educationYears: 12,
  patientAge: 75,
  mocaVersion: '8.3',
};

function renderSessionValidation() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <div>start page</div> },
      { path: '/session/:token', element: <SessionValidation /> },
      { path: '/patient/welcome', element: <div>welcome page</div> },
      { path: '/patient/trail-making', element: <div>trail task</div> },
    ],
    { initialEntries: ['/session/12345678'] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe('SessionValidation', () => {
  beforeEach(() => {
    sessionMocks.useSession.mockReturnValue({ status: 'loading' });
    assessmentMocks.hasCompletedPatientOnboarding.mockReturnValue(false);
    assessmentMocks.useAssessmentStore.mockReturnValue({
      state: {
        id: null,
        linkToken: null,
        startToken: null,
        scoringContext: null,
      },
      hasInProgressAssessment: false,
      startNewAssessment: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('starts a ready session and sends a first-time patient to onboarding', async () => {
    const startNewAssessment = vi.fn();
    sessionMocks.useSession.mockReturnValue({
      status: 'ready',
      sessionId: 'session-1',
      linkToken: 'link-token',
      startToken: '12345678',
      scoringContext,
    });
    assessmentMocks.useAssessmentStore.mockReturnValue({
      state: {
        id: null,
        linkToken: null,
        startToken: null,
        scoringContext: null,
      },
      hasInProgressAssessment: false,
      startNewAssessment,
    });

    const router = renderSessionValidation();

    await waitFor(() => expect(startNewAssessment).toHaveBeenCalledWith(
      'session-1',
      'link-token',
      scoringContext,
      '12345678',
    ));
    expect(router.state.location.pathname).toBe('/patient/welcome');
  });

  it('does not restart an in-progress matching token', async () => {
    const startNewAssessment = vi.fn();
    assessmentMocks.useAssessmentStore.mockReturnValue({
      state: {
        id: 'session-1',
        linkToken: '12345678',
        startToken: null,
        scoringContext,
      },
      hasInProgressAssessment: true,
      startNewAssessment,
    });

    const router = renderSessionValidation();

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(sessionMocks.useSession).toHaveBeenCalledWith('12345678', { enabled: false });
    expect(startNewAssessment).not.toHaveBeenCalled();
  });

  it('shows the patient-safe error message for invalid or already used numbers', async () => {
    sessionMocks.useSession.mockReturnValue({ status: 'already_used' });

    renderSessionValidation();

    expect(await screen.findByRole('heading', { name: 'לא ניתן להתחיל את המבדק' })).toBeInTheDocument();
    expect(screen.getByText('לא ניתן להתחיל את המבדק במספר שהוזן. בדוק את המספר או פנה לקלינאי.')).toBeInTheDocument();
  });
});
