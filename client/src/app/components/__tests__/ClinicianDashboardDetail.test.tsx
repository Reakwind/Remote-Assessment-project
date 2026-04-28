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

function sessionPayload(sessionOverrides: Record<string, unknown> = {}) {
  return {
    session: {
      id: 'session-1',
      case_id: 'CASE-1',
      status: 'completed',
      moca_version: '8.3',
      age_band: '70-74',
      created_at: '2026-04-25T12:00:00.000Z',
      started_at: '2026-04-25T12:05:00.000Z',
      completed_at: '2026-04-25T12:25:00.000Z',
      device_context: {
        platform: 'iPad',
        language: 'he-IL',
        viewportWidth: 768,
        viewportHeight: 1024,
        screenWidth: 820,
        screenHeight: 1180,
        touchPoints: 5,
        standalone: true,
        pointer: 'coarse',
        formFactor: 'tablet',
        orientation: 'portrait',
      },
      patients: {
        id: 'patient-1',
        case_id: 'CASE-1',
        full_name: 'CASE-1',
      },
      task_results: [
        {
          id: 'task-naming-1',
          session_id: 'session-1',
          task_name: 'naming',
          task_type: 'moca-naming',
          raw_data: {
            answers: {
              'item-1': 'סוס',
              'item-2': 'נמר',
              'item-3': 'ברבור',
            },
          },
          submitted_at: '2026-04-25T12:10:00.000Z',
        },
      ],
      drawings: [],
      scoring_reviews: [],
      audio_evidence_reviews: [
        {
          id: 'audio-1',
          item_id: 'moca-digit-span',
          task_type: 'moca-digit-span',
          max_score: 0,
          raw_data: {
            audioId: 'session-1/moca-digit-span.mp4',
            audioContentType: 'audio/mp4',
            audioStoragePath: 'session-1/moca-digit-span.mp4',
            audioSignedUrl: 'http://127.0.0.1/audio/session-1/moca-digit-span.mp4',
          },
          clinician_score: null,
          clinician_notes: null,
        },
      ],
      scoring_report: {
        total_adjusted: 24,
        total_score: 24,
        total_provisional: false,
        needs_review: false,
        pending_review_count: 0,
        domains: [
          { domain: 'visuospatial', raw: 5, max: 5, items: [] },
          {
            domain: 'naming',
            raw: 2,
            max: 3,
            items: [
              { taskId: 'naming.item1', score: 1, max: 1, needsReview: false },
              { taskId: 'naming.item2', score: 1, max: 1, needsReview: false },
              { taskId: 'naming.item3', score: 0, max: 1, needsReview: false },
            ],
          },
          { domain: 'attention', raw: 6, max: 6, items: [] },
          { domain: 'memory', raw: 5, max: 5, items: [] },
        ],
        subscores: {},
      },
      ...sessionOverrides,
    },
  };
}

function exactText(expected: string) {
  return (_content: string, element: Element | null) => element?.textContent === expected;
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
    expect(screen.getByRole('heading', { name: 'מכשיר המטופל' })).toBeInTheDocument();
    expect(screen.getByText('PWA מותקן')).toBeInTheDocument();
    expect(screen.getByText('טאבלט')).toBeInTheDocument();
    expect(screen.getByText('לאורך')).toBeInTheDocument();
    expect(screen.getByText('768x1024')).toBeInTheDocument();
    expect(screen.getAllByText('שיום').length).toBeGreaterThan(0);
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'פירוט ניקוד לפי פריט' })).toBeInTheDocument();
    expect(screen.getByText('שיום 3')).toBeInTheDocument();
    expect(screen.getByText('תשובת מטופל: ברבור · תשובה צפויה: ברווז')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'האזן להקלטת המטופל' })).toBeInTheDocument();
    expect(screen.queryByText(/audioStoragePath/)).not.toBeInTheDocument();
    expect(screen.queryByText(/audioSignedUrl/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ייצוא CSV' }));
    expect(screen.getByRole('dialog', { name: 'אישור ייצוא CSV' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /אני מבין/ }));
    await userEvent.click(screen.getByRole('button', { name: 'ייצא CSV' }));

    expect(await screen.findByRole('status')).toHaveTextContent('CSV ירד בהצלחה.');
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({ sessionId: 'session-1' });
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:csv-export');
  });

  it('scores five correct Serial 7 review items as 3 out of 3', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(sessionPayload({
          scoring_reviews: [
            {
              id: 'serial7-review',
              item_id: 'moca-serial-7s',
              task_type: 'moca-serial-7s',
              max_score: 3,
              raw_data: null,
              clinician_score: null,
              clinician_notes: null,
            },
          ],
          audio_evidence_reviews: [],
        })),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    renderDetail();
    await screen.findByRole('heading', { name: 'תיק CASE-1' });

    for (const label of ['93', '86', '79', '72', '65']) {
      await userEvent.click(screen.getByText(label));
    }

    expect(screen.getByText(exactText('3/3'))).toBeInTheDocument();
    expect(screen.queryByText(exactText('5/3'))).not.toBeInTheDocument();
  });
});
