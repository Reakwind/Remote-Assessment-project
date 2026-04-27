// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientWelcome } from '../PatientWelcome';
import { AssessmentProvider } from '../../store/AssessmentContext';

vi.mock('../../../lib/supabase', () => ({
  edgeFn: (name: string) => `/functions/v1/${name}`,
  edgeHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

const STORAGE_KEY = 'moca_assessment_state';
const ONBOARDING_KEY = 'moca_patient_onboarding_completed';

class MockMediaRecorder {
  state = 'inactive';
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {}

  start() {
    this.state = 'recording';
    window.setTimeout(() => {
      this.stop();
    }, 0);
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

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
    lastPath: '/patient/welcome',
    isComplete: false,
    localStartedAt: new Date().toISOString(),
    tasks: {},
  };
}

function renderWelcome() {
  const router = createMemoryRouter(
    [
      { path: '/patient/welcome', element: <PatientWelcome /> },
      { path: '/patient/trail-making', element: <div>Trail task</div> },
    ],
    { initialEntries: ['/patient/welcome'] },
  );
  render(
    <AssessmentProvider>
      <RouterProvider router={router} />
    </AssessmentProvider>,
  );
  return router;
}

describe('PatientWelcome', () => {
  beforeEach(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      lang = '';
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    });
    vi.stubGlobal('speechSynthesis', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [{ lang: 'he-IL' }]),
      speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
        utterance.onend?.({} as SpeechSynthesisEvent);
      }),
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requires audio, microphone, and readiness acknowledgement before starting tasks', async () => {
    const router = renderWelcome();

    expect(screen.getByRole('button', { name: /התחלת המבדק/ })).toBeDisabled();
    expect(screen.getByText(/בטלפון מומלץ לסובב לרוחב לפני הציור/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /בדיקת שמע בעברית/ }));
    await waitFor(() => expect(screen.getByText('השמעת ההוראות בעברית עובדת.')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /בדיקת מיקרופון/ }));
    await waitFor(() => expect(screen.getByText('המיקרופון זמין להקלטת תשובות.')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /התחלת המבדק/ })).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /התחלת המבדק/ }));

    await screen.findByText('Trail task');
    expect(router.state.location.pathname).toBe('/patient/trail-making');
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('session-1');
  });
});
