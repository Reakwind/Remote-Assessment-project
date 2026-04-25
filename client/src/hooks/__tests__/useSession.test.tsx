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

function SessionHarness({ token, code }: { token?: string; code?: string }) {
  const state = useSession(token, code);
  return <output data-testid="session-state">{JSON.stringify(state)}</output>;
}

function currentSessionState(): SessionState {
  const content = screen.getByTestId('session-state').textContent;
  if (!content) throw new Error('Session state output not rendered');
  return JSON.parse(content) as SessionState;
}

async function renderAndWaitForStatus(token: string | undefined, code: string | undefined, status: SessionState['status']) {
  render(<SessionHarness token={token} code={code} />);
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

    const state = await renderAndWaitForStatus(undefined, undefined, 'invalid');

    expect(state.sessionId).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces invalid access code responses', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 } as Response);

    const state = await renderAndWaitForStatus('session-token', '1234', 'invalid_code');

    expect(state.requiresAccessCode).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://edge.test/start-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'anon-key' }),
        body: JSON.stringify({ token: 'session-token', accessCode: '1234' }),
      }),
    );
  });

  it('returns code_required state when backend requires an access code', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'code_required', sessionId: 'sess-code' }),
    } as Response);

    const state = await renderAndWaitForStatus('session-token', undefined, 'code_required');

    expect(state.sessionId).toBe('sess-code');
    expect(state.linkToken).toBe('session-token');
    expect(state.requiresAccessCode).toBe(true);
    expect(state.scoringContext).toBeNull();
  });

  it('maps a successful start-session payload into ready scoring context', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ready',
        sessionId: 'sess-ready',
        sessionDate: '2026-04-01T00:00:00.000Z',
        educationYears: undefined,
        ageBand: '65-69',
      }),
    } as Response);

    const state = await renderAndWaitForStatus('session-token', undefined, 'ready');

    expect(state.linkToken).toBe('session-token');
    expect(state.scoringContext?.sessionId).toBe('sess-ready');
    expect(state.scoringContext?.educationYears).toBe(12);
    expect(state.scoringContext?.patientAge).toBe(67);
  });

  it('moves to error state when start-session request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const state = await renderAndWaitForStatus('session-token', undefined, 'error');

    expect(state.sessionId).toBeNull();
    expect(state.linkToken).toBeNull();
  });
});
