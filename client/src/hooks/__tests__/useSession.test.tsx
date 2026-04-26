// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession, type SessionState } from '../useSession';

vi.mock('../../lib/supabase', () => ({
  edgeFn: (name: string) => `https://edge.test/${name}`,
  edgeHeaders: () => ({
    'Content-Type': 'application/json',
    apikey: 'anon-key',
    Authorization: 'Bearer anon-key',
  }),
}));

const mockFetch = vi.fn();

function SessionHarness({ token }: { token?: string }) {
  const state = useSession(token);
  return <output data-testid="session-state">{JSON.stringify(state)}</output>;
}

function currentSessionState(): SessionState {
  const content = screen.getByTestId('session-state').textContent;
  if (!content) throw new Error('Session state output not rendered');
  return JSON.parse(content) as SessionState;
}

async function renderAndWaitForStatus(token: string | undefined, status: SessionState['status']) {
  render(<SessionHarness token={token} />);
  await waitFor(() => {
    expect(currentSessionState().status).toBe(status);
  });
  return currentSessionState();
}

describe('useSession', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('marks session invalid when no token override is provided', async () => {
    window.history.replaceState({}, '', '/?t=query-token');

    const state = await renderAndWaitForStatus(undefined, 'invalid');

    expect(state.sessionId).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends only the patient-facing test number to start-session', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ready',
        sessionId: 'sess-ready',
        linkToken: 'link-token',
        sessionDate: '2026-04-01T00:00:00.000Z',
        educationYears: 12,
        ageBand: '70-79',
        patientAge: 76,
      }),
    } as Response);

    await renderAndWaitForStatus('12345678', 'ready');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://edge.test/start-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'anon-key' }),
        body: JSON.stringify({ token: '12345678' }),
      }),
    );
  });

  it('rejects a successful start-session payload when scoring context is incomplete', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ready',
        sessionId: 'sess-ready',
        linkToken: 'link-token',
        sessionDate: '2026-04-01T00:00:00.000Z',
        educationYears: undefined,
        ageBand: '65-69',
      }),
    } as Response);

    const state = await renderAndWaitForStatus('session-token', 'invalid');

    expect(state.linkToken).toBeNull();
    expect(state.scoringContext).toBeNull();
  });

  it('prefers exact patient age when start-session returns it', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ready',
        sessionId: 'sess-ready',
        linkToken: 'link-token',
        sessionDate: '2026-04-01T00:00:00.000Z',
        educationYears: 14,
        ageBand: '70-74',
        patientAge: 73,
      }),
    } as Response);

    const state = await renderAndWaitForStatus('session-token', 'ready');

    expect(state.scoringContext?.educationYears).toBe(14);
    expect(state.scoringContext?.patientAge).toBe(73);
  });

  it('moves to error state when start-session request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const state = await renderAndWaitForStatus('session-token', 'error');

    expect(state.sessionId).toBeNull();
    expect(state.linkToken).toBeNull();
  });
});
