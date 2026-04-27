// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EndScreen } from '../EndScreen';
import { AssessmentProvider } from '../../store/AssessmentContext';

vi.mock('../../../lib/supabase', () => ({
  edgeFn: (name: string) => `/functions/v1/${name}`,
  edgeHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

const STORAGE_KEY = 'moca_assessment_state';
const fetchMock = vi.fn();

function storedAssessment() {
  return {
    id: 'session-1',
    linkToken: 'link-token-1',
    startToken: '12345678',
    scoringContext: {
      sessionId: 'session-1',
      sessionDate: new Date('2026-04-25T12:00:00Z').toISOString(),
      educationYears: 12,
      patientAge: 75,
      mocaVersion: '8.3',
    },
    lastPath: '/patient/end',
    isComplete: false,
    localStartedAt: new Date().toISOString(),
    tasks: {
      naming: { answers: { 'item-1': 'סוס', 'item-2': 'נמר', 'item-3': 'ברווז' } },
    },
  };
}

function renderEndScreen() {
  render(
    <AssessmentProvider>
      <EndScreen />
    </AssessmentProvider>,
  );
}

describe('EndScreen', () => {
  beforeEach(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('shows success only after complete-session succeeds', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    renderEndScreen();

    expect(screen.getByRole('heading', { name: 'שומר את המבדק' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'המבדק הושלם' })).not.toBeInTheDocument();

    await screen.findByRole('heading', { name: 'המבדק הושלם' });
    expect(screen.getByText('אפשר לסגור את האפליקציה. הקלינאי יבדוק את התוצאות ויצור קשר במידת הצורך.')).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  it('keeps resume state and allows retry when complete-session fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'server unavailable' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    renderEndScreen();

    await screen.findByText('השמירה לא הושלמה');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.isComplete).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));

    await screen.findByRole('heading', { name: 'המבדק הושלם' });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
