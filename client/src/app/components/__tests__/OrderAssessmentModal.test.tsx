// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderAssessmentModal } from '../OrderAssessmentModal';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'clinician-token' } },
      })),
    },
  },
}));

const completePatient = {
  id: 'patient-1',
  case_id: 'CASE-001',
  full_name: 'CASE-001',
  phone: '0501234567',
  date_of_birth: '1950-04-15',
  gender: 'male' as const,
  language: 'he',
  dominant_hand: 'right' as const,
  education_years: 12,
};

describe('OrderAssessmentModal', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('blocks test ordering when the case profile is missing required clinical context', () => {
    render(
      <OrderAssessmentModal
        open
        onClose={vi.fn()}
        patient={{
          id: 'patient-legacy',
          case_id: 'CASE-LEGACY',
          full_name: 'CASE-LEGACY',
          language: 'he',
        }}
      />,
    );

    expect(screen.getByText('יש להשלים פרטי רקע לפני פתיחת מבדק:')).toBeInTheDocument();
    expect(screen.getByText(/טלפון/)).toBeInTheDocument();
    expect(screen.getByText(/תאריך לידה/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'צור מספר מבדק' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a session only from a complete patient profile', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ testNumber: '12345678' }),
    } as Response);

    render(<OrderAssessmentModal open onClose={vi.fn()} patient={completePatient} />);

    await userEvent.click(screen.getByRole('button', { name: 'צור מספר מבדק' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'המבדק נוצר בהצלחה' })).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /העתק מספר מבדק/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'סגור' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/create-session'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer clinician-token' }),
        body: JSON.stringify({
          patientId: 'patient-1',
          assessmentType: 'moca',
          language: 'he',
          mocaVersion: '8.3',
        }),
      }),
    );
  });

  it('shows an actionable message when session creation cannot reach the Edge Function', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));

    render(<OrderAssessmentModal open onClose={vi.fn()} patient={completePatient} />);

    await userEvent.click(screen.getByRole('button', { name: 'צור מספר מבדק' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('לא ניתן להתחבר לשרת פתיחת המבדקים');
    });
  });
});
