// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientProfilePage } from '../PatientProfilePage';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}));

vi.mock('../OrderAssessmentModal', () => ({
  OrderAssessmentModal: ({ onClose, onOrdered, patient }: {
    onClose: () => void;
    onOrdered: () => void;
    patient: { case_id: string | null };
  }) => (
    <div role="dialog" aria-label="order assessment">
      <span>order for {patient.case_id}</span>
      <button type="button" onClick={onOrdered}>ordered</button>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}));

const patientRecord = {
  id: 'patient-1',
  case_id: 'CASE-1',
  full_name: 'CASE-1',
  phone: '0501234567',
  date_of_birth: '1950-04-25',
  gender: 'female',
  language: 'he',
  dominant_hand: 'right',
  education_years: 14,
  created_at: '2026-04-25T12:00:00.000Z',
};

const sessions = [
  {
    id: 'session-pending',
    case_id: 'CASE-1',
    status: 'pending',
    assessment_type: 'moca',
    created_at: '2026-04-27T12:00:00.000Z',
    completed_at: null,
    access_code: null,
    scoring_reports: null,
  },
  {
    id: 'session-review',
    case_id: 'CASE-1',
    status: 'awaiting_review',
    assessment_type: 'moca',
    created_at: '2026-04-26T12:00:00.000Z',
    completed_at: '2026-04-26T12:30:00.000Z',
    access_code: null,
    scoring_reports: {
      total_adjusted: 29,
      total_score: 29,
      total_provisional: true,
      needs_review: true,
    },
  },
  {
    id: 'session-final',
    case_id: 'CASE-1',
    status: 'completed',
    assessment_type: 'moca',
    created_at: '2026-04-25T12:00:00.000Z',
    completed_at: '2026-04-25T12:30:00.000Z',
    access_code: '12345678',
    scoring_reports: [{
      total_adjusted: 24,
      total_score: 24,
      total_provisional: false,
      needs_review: false,
    }],
  },
];

function makeQuery(table: string) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(async () => {
      if (table === 'sessions') return { data: sessions, error: null };
      return { data: null, error: new Error(`Unexpected order on ${table}`) };
    }),
    maybeSingle: vi.fn(async () => {
      if (table === 'patients') return { data: patientRecord, error: null };
      return { data: null, error: new Error(`Unexpected maybeSingle on ${table}`) };
    }),
  };
  return query;
}

function renderProfile() {
  const router = createMemoryRouter(
    [
      { path: '/dashboard/patient/:patientId', element: <PatientProfilePage /> },
      { path: '/dashboard/session/:sessionId', element: <div>session detail</div> },
      { path: '/dashboard', element: <div>dashboard</div> },
    ],
    { initialEntries: ['/dashboard/patient/patient-1'] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe('PatientProfilePage', () => {
  beforeEach(() => {
    supabaseMocks.from.mockImplementation((table: string) => makeQuery(table));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    supabaseMocks.from.mockReset();
  });

  it('renders patient background, final score, provisional score, and session history', async () => {
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'תיק CASE-1' })).toBeInTheDocument();
    expect(screen.getByText('0501234567')).toBeInTheDocument();
    expect(screen.getByText('נקבה')).toBeInTheDocument();
    expect(screen.getByText('ימין')).toBeInTheDocument();
    expect(screen.getAllByText('24/30').length).toBeGreaterThan(0);
    expect(screen.getByText('29/30 (זמני)')).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
  });

  it('labels pending session detail links as open actions', async () => {
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'תיק CASE-1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'פתח' })).toHaveAttribute('href', '/dashboard/session/session-pending');
    expect(screen.queryByRole('link', { name: 'העתק מספר' })).not.toBeInTheDocument();
  });

  it('prioritizes the awaiting-review session as the profile primary action', async () => {
    const router = renderProfile();

    expect(await screen.findAllByRole('button', { name: 'מבדק חדש' })).toHaveLength(1);
    await userEvent.click(await screen.findByRole('button', { name: 'סקור מבדק' }));

    expect(router.state.location.pathname).toBe('/dashboard/session/session-review');
  });

  it('copies access codes without triggering row navigation', async () => {
    const router = renderProfile();
    await screen.findByRole('heading', { name: 'תיק CASE-1' });

    await userEvent.click(screen.getByRole('button', { name: 'העתק מספר מבדק' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('12345678');
    expect(screen.getByText('הועתק')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard/patient/patient-1');
  });

  it('refreshes sessions in the background after ordering an assessment', async () => {
    renderProfile();
    const newAssessmentButtons = await screen.findAllByRole('button', { name: 'מבדק חדש' });
    await userEvent.click(newAssessmentButtons[0]);
    await screen.findByRole('dialog', { name: 'order assessment' });

    await userEvent.click(screen.getByRole('button', { name: 'ordered' }));

    await waitFor(() => {
      expect(supabaseMocks.from.mock.calls.filter(([table]) => table === 'sessions')).toHaveLength(2);
    });
  });
});
