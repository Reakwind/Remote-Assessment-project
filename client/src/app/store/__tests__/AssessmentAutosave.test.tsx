// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessmentProvider, useAssessmentStore } from '../AssessmentContext';
import { queuedSavesForSession } from '../autosaveQueue';

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
    lastPath: '/patient/naming',
    isComplete: false,
    tasks: {
      naming: { answers: { 'item-1': 'סוס', 'item-2': 'נמר', 'item-3': 'ברווז' } },
    },
  };
}

function Harness() {
  const { updateTaskData, completeAssessment, completionStatus, completionError, taskSaveStatus } = useAssessmentStore();

  return (
    <div>
      <button
        type="button"
        onClick={() => updateTaskData('naming', { answers: { 'item-1': 'סוס', 'item-2': 'נמר', 'item-3': 'ברווז' } })}
      >
        save naming
      </button>
      <button
        type="button"
        onClick={() => updateTaskData('clock', { strokes: [[{ x: 1, y: 2 }]] }, 'data:image/png;base64,clock')}
      >
        save clock
      </button>
      <button type="button" onClick={() => void completeAssessment()}>
        complete
      </button>
      <div data-testid="naming-status">{taskSaveStatus.naming?.status ?? 'none'}</div>
      <div data-testid="clock-status">{taskSaveStatus.clock?.status ?? 'none'}</div>
      <div data-testid="completion-status">{completionStatus}</div>
      <div data-testid="completion-error">{completionError ?? ''}</div>
    </div>
  );
}

function renderHarness() {
  render(
    <AssessmentProvider>
      <Harness />
    </AssessmentProvider>,
  );
}

describe('AssessmentProvider autosave queue', () => {
  beforeEach(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedAssessment()));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('keeps failed task saves in a durable queue and retries them after refresh', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'offline' }), { status: 500 }));
    renderHarness();

    await userEvent.click(screen.getByRole('button', { name: 'save naming' }));

    await waitFor(() => expect(screen.getByTestId('naming-status')).toHaveTextContent('error'));
    expect(queuedSavesForSession('session-1')).toHaveLength(1);

    cleanup();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    renderHarness();

    await waitFor(() => expect(screen.getByTestId('naming-status')).toHaveTextContent('saved'));
    expect(queuedSavesForSession('session-1')).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('saves drawing evidence before submitting the task result payload', async () => {
    const submittedBodies: unknown[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/save-drawing')) {
        return new Response(JSON.stringify({ storagePath: 'drawings/session-1/clock.png' }), { status: 200 });
      }
      if (url.endsWith('/submit-results')) {
        submittedBodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    renderHarness();
    await userEvent.click(screen.getByRole('button', { name: 'save clock' }));

    await waitFor(() => expect(screen.getByTestId('clock-status')).toHaveTextContent('saved'));
    expect(submittedBodies).toEqual([
      expect.objectContaining({
        taskType: 'moca-clock',
        rawData: expect.objectContaining({ drawingPath: 'drawings/session-1/clock.png' }),
      }),
    ]);
    expect(queuedSavesForSession('session-1')).toHaveLength(0);
  });

  it('blocks completion while queued evidence cannot be saved', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'offline' }), { status: 500 }));
    renderHarness();

    await userEvent.click(screen.getByRole('button', { name: 'save naming' }));
    await waitFor(() => expect(screen.getByTestId('naming-status')).toHaveTextContent('error'));

    await userEvent.click(screen.getByRole('button', { name: 'complete' }));

    await waitFor(() => expect(screen.getByTestId('completion-status')).toHaveTextContent('error'));
    expect(screen.getByTestId('completion-error')).toHaveTextContent('חלק מהתשובות עדיין לא נשמרו');
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/complete-session'))).toBe(false);
  });
});

