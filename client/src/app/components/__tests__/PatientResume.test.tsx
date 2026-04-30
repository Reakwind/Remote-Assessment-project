// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const ONBOARDING_KEY = 'moca_patient_onboarding_completed';

function storedAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    linkToken: 'token-1',
    startToken: '12345678',
    scoringContext: {
      sessionId: 'session-1',
      sessionDate: new Date('2026-04-25T12:00:00Z').toISOString(),
      educationYears: 12,
      patientAge: 75,
      mocaVersion: '8.2',
    },
    lastPath: '/patient/clock',
    isComplete: false,
    localStartedAt: new Date().toISOString(),
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

  it('opens a fresh valid test number at the welcome and system-check page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: 'session-fresh',
          linkToken: 'link-token-fresh',
          sessionDate: '2026-04-25T12:00:00.000Z',
          educationYears: 14,
          patientAge: 72,
          mocaVersion: '8.3',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const router = renderWithProvider(
      [
        { path: '/session/:token', element: <SessionValidation /> },
        { path: '/patient/welcome', element: <div>Welcome system check</div> },
        { path: '/patient/trail-making', element: <div>Trail making task</div> },
      ],
      '/session/87654321',
    );

    await screen.findByText('Welcome system check');
    expect(router.state.location.pathname).toBe('/patient/welcome');
    expect(screen.queryByText('Trail making task')).not.toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.id).toBe('session-fresh');
    expect(stored.startToken).toBe('87654321');
    expect(stored.lastPath).toBe('/patient/welcome');
  });

  it('opens a fresh valid test number at the first task after local onboarding is complete', async () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: 'session-returning',
          linkToken: 'link-token-returning',
          sessionDate: '2026-04-25T12:00:00.000Z',
          educationYears: 14,
          patientAge: 72,
          mocaVersion: '8.3',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const router = renderWithProvider(
      [
        { path: '/session/:token', element: <SessionValidation /> },
        { path: '/patient/welcome', element: <div>Welcome system check</div> },
        { path: '/patient/trail-making', element: <div>Trail making task</div> },
      ],
      '/session/87654322',
    );

    await screen.findByText('Trail making task');
    expect(router.state.location.pathname).toBe('/patient/trail-making');
    expect(screen.queryByText('Welcome system check')).not.toBeInTheDocument();
  });

  it('treats legacy session-scoped onboarding as local onboarding complete', async () => {
    localStorage.setItem(ONBOARDING_KEY, 'previous-session');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: 'session-new',
          linkToken: 'link-token-new',
          sessionDate: '2026-04-25T12:00:00.000Z',
          educationYears: 14,
          patientAge: 72,
          mocaVersion: '8.3',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const router = renderWithProvider(
      [
        { path: '/session/:token', element: <SessionValidation /> },
        { path: '/patient/welcome', element: <div>Welcome system check</div> },
        { path: '/patient/trail-making', element: <div>Trail making task</div> },
      ],
      '/session/87654323',
    );

    await screen.findByText('Trail making task');
    expect(router.state.location.pathname).toBe('/patient/trail-making');
    expect(screen.queryByText('Welcome system check')).not.toBeInTheDocument();
  });

  it('sends a matching in-progress link to the explicit continue-test button without consuming the token again', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const router = renderWithProvider(
      [
        { path: '/session/:token', element: <SessionValidation /> },
        { path: '/', element: <LandingHub /> },
        { path: '/patient/clock', element: <div>Clock task resumed</div> },
      ],
      '/session/token-1',
    );

    await screen.findByRole('button', { name: 'המשך מהמקום שעצרת' });
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Clock task resumed')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends a matching in-progress test number to the explicit continue-test button without consuming it again', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const router = renderWithProvider(
      [
        { path: '/session/:token', element: <SessionValidation /> },
        { path: '/', element: <LandingHub /> },
        { path: '/patient/clock', element: <div>Clock task resumed</div> },
      ],
      '/session/12345678',
    );

    await screen.findByRole('button', { name: 'המשך מהמקום שעצרת' });
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Clock task resumed')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resumes an in-progress test only after the patient clicks continue', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));

    const router = renderWithProvider(
      [
        { path: '/', element: <LandingHub /> },
        { path: '/patient/clock', element: <div>Clock task resumed</div> },
      ],
      '/',
    );

    await userEvent.click(screen.getByRole('button', { name: 'המשך מהמקום שעצרת' }));

    await screen.findByText('Clock task resumed');
    expect(router.state.location.pathname).toBe('/patient/clock');
  });

  it('formats patient test numbers as two four-digit chunks before starting', async () => {
    const router = renderWithProvider(
      [
        { path: '/', element: <LandingHub /> },
        { path: '/session/:token', element: <div>Session validation</div> },
      ],
      '/',
    );

    const input = screen.getByRole('textbox', { name: 'מספר מבדק בן 8 ספרות' });
    await userEvent.type(input, '12345678');

    expect(input).toHaveValue('1234-5678');
    expect(screen.getByText('המספר מלא. אפשר להתחיל.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /התחל מבדק/ }));

    expect(router.state.location.pathname).toBe('/session/12345678');
  });

  it('does not offer resume controls for stale stored state without a token', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment({ linkToken: null })));

    renderWithProvider([{ path: '/', element: <LandingHub /> }], '/');

    expect(screen.queryByText('המשך מהמקום שעצרת')).not.toBeInTheDocument();
  });

  it('expires abandoned same-device resume state after six hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T19:00:01Z'));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment({
      localStartedAt: '2026-04-25T12:00:00.000Z',
    })));

    renderWithProvider([{ path: '/', element: <LandingHub /> }], '/');

    expect(screen.queryByText('המשך מהמקום שעצרת')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.useRealTimers();
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

  it('redirects direct task routes back to patient entry without a started session', async () => {
    const router = renderWithProvider(
      [
        { path: '/', element: <LandingHub /> },
        {
          path: '/patient',
          element: <AssessmentLayout />,
          children: [{ path: 'trail-making', element: <div>Trail body</div> }],
        },
      ],
      '/patient/trail-making',
    );

    await screen.findByRole('heading', { name: 'כניסת מטופל' });
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Trail body')).not.toBeInTheDocument();
  });

  it('records skipped evidence when patients advance without evidence', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment({ lastPath: '/patient/trail-making' })));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const router = renderWithProvider(
      [
        {
          path: '/patient',
          element: <AssessmentLayout />,
          children: [
            { path: 'trail-making', element: <div>Trail body</div> },
            { path: 'cube', element: <div>Cube body</div> },
          ],
        },
      ],
      '/patient/trail-making',
    );

    await screen.findByText('Trail body');
    await userEvent.click(screen.getByRole('button', { name: /המשך/ }));

    expect(router.state.location.pathname).toBe('/patient/cube');
    await screen.findByText('Cube body');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.tasks.trailMaking).toMatchObject({
      skipped: true,
      reason: 'no_evidence',
    });
  });

  it('keeps patients on the completion screen without a dashboard navigation action', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment({ lastPath: '/patient/end' })));

    const router = renderWithProvider(
      [
        {
          path: '/patient',
          element: <AssessmentLayout />,
          children: [{ path: 'end', element: <div>Patient completion body</div> }],
        },
        { path: '/dashboard', element: <div>Clinician dashboard</div> },
      ],
      '/patient/end',
    );

    await screen.findByText('Patient completion body');
    expect(router.state.location.pathname).toBe('/patient/end');
    expect(screen.queryByRole('button', { name: 'סיום משימה' })).not.toBeInTheDocument();
    expect(screen.queryByText('Clinician dashboard')).not.toBeInTheDocument();
  });
});
