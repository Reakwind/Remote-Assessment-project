// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianDashboardList } from '../ClinicianDashboardList';

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

const orderMock = vi.fn();
const eqMock = vi.fn(() => ({ order: orderMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));

function renderDashboardList() {
  render(
    <MemoryRouter>
      <ClinicianDashboardList />
    </MemoryRouter>,
  );
}

describe('ClinicianDashboardList', () => {
  beforeEach(() => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'clinician-1' }, access_token: 'clinician-token' } },
    });
    supabaseMocks.from.mockReturnValue({ select: selectMock });
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'patient-1',
          case_id: 'CASE-1',
          full_name: 'CASE-1',
          created_at: '2026-04-25T12:00:00.000Z',
          sessions: [
            {
              id: 'session-1',
              status: 'completed',
              created_at: '2026-04-25T12:05:00.000Z',
              scoring_reports: {
                total_adjusted: 29,
                total_score: 29,
                total_provisional: true,
                needs_review: true,
                pending_review_count: 1,
              },
            },
          ],
        },
      ],
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads cases when Supabase returns a single scoring report object', async () => {
    renderDashboardList();

    expect(await screen.findByText('1 תיקים · 1 דורשים סקירה')).toBeInTheDocument();
    expect(screen.getAllByText('29/30').length).toBeGreaterThan(0);
    expect(screen.getAllByText('בבדיקה').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText('טוען...')).not.toBeInTheDocument());
  });
});
