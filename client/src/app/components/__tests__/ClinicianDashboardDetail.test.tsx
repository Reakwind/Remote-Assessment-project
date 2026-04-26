// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianDashboardDetail } from '../ClinicianDashboardDetail';

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
    },
    from: supabaseMocks.from,
  },
}));

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => 'blob:csv-export');
const revokeObjectURLMock = vi.fn();
const originalCreateObjectURL = window.URL.createObjectURL;
const originalRevokeObjectURL = window.URL.revokeObjectURL;

function sessionPayload() {
  return {
    session: {
      id: 'session-1',
      case_id: 'CASE-1',
      status: 'completed',
      age_band: '70-74',
      created_at: '2026-04-25T12:00:00.000Z',
      started_at: '2026-04-25T12:05:00.000Z',
      completed_at: '2026-04-25T12:25:00.000Z',
      patients: {
        id: 'patient-1',
        case_id: 'CASE-1',
        full_name: 'CASE-1',
      },
      task_results: [],
      drawings: [],
      scoring_reviews: [],
      audio_evidence_reviews: [],
      scoring_report: {
        total_adjusted: 24,
        total_score: 24,
        total_provisional: false,
        needs_review: false,
        pending_review_count: 0,
        subscores: {},
      },
    },
  };
}

function renderDetail() {
  const router = createMemoryRouter(
    [
      { path: '/dashboard/session/:sessionId', element: <ClinicianDashboardDetail /> },
      { path: '/dashboard', element: <div>Dashboard</div> },
    ],
    { initialEntries: ['/dashboard/session/session-1'] },
  );

  render(<RouterProvider router={router} />);
}

describe('ClinicianDashboardDetail', () => {
  beforeEach(() => {
    supabaseMocks.getSession.mockResolvedValue({ data: { session: { access_token: 'clinician-token' } } });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [] }),
        })),
      })),
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sessionPayload()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('case_id,total\nCASE-1,24\n', {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    fetchMock.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    supabaseMocks.getSession.mockReset();
    supabaseMocks.from.mockReset();
  });

  it('shows CSV export progress and success feedback in the detail page', async () => {
    renderDetail();

    await screen.findByRole('heading', { name: 'תיק CASE-1' });
    expect(screen.getByText('CSV זמין גם לפני סיום סקירה ויכול לכלול נתונים זמניים.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'CSV' }));

    expect(await screen.findByRole('status')).toHaveTextContent('CSV ירד בהצלחה.');
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({ sessionId: 'session-1' });
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:csv-export');
  });
});
