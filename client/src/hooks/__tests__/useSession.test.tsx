// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  edgeFn: (name: string) => `https://edge.test/${name}`,
}));

import { useSession, type SessionState } from '../useSession';

const mockFetch = vi.fn();

function SessionHarness({ token, code }: { token?: string; code?: string }) {
  const state = useSession(token, code);
  return <output data-testid="session-state">{JSON.stringify(state)}</output>;
}

function readSessionState(container: HTMLDivElement): SessionState {
  const node = container.querySelector('[data-testid="session-state"]');
  if (!node?.textContent) {
    throw new Error('Session state output not rendered');
  }
  return JSON.parse(node.textContent) as SessionState;
}

async function renderAndFlush(token?: string, code?: string): Promise<SessionState> {
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<SessionHarness token={token} code={code} />);
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const snapshot = readSessionState(container);
  root.unmount();
  return snapshot;
}

describe('useSession', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks session invalid when no token override is provided', async () => {
    window.history.replaceState({}, '', '/?t=query-token');

    const state = await renderAndFlush();
    expect(state.status).toBe('invalid');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces invalid access code responses', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 } as Response);

    const state = await renderAndFlush('session-token', '1234');
    expect(state.status).toBe('invalid_code');
    expect(state.requiresAccessCode).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://edge.test/start-session',
      expect.objectContaining({
        method: 'POST',
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

    const state = await renderAndFlush('session-token');
    expect(state.status).toBe('code_required');
    expect(state.sessionId).toBe('sess-code');
    expect(state.linkToken).toBe('session-token');
    expect(state.requiresAccessCode).toBe(true);
  });

  it('maps a successful start-session payload into ready scoring context', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: 'sess-ready',
        sessionDate: '2026-04-01T00:00:00.000Z',
        educationYears: undefined,
        ageBand: '65-69',
      }),
    } as Response);

    const state = await renderAndFlush('session-token');
    expect(state.status).toBe('ready');
    expect(state.linkToken).toBe('session-token');
    expect(state.scoringContext?.sessionId).toBe('sess-ready');
    expect(state.scoringContext?.educationYears).toBe(12);
    expect(state.scoringContext?.patientAge).toBe(67);
  });

  it('moves to error state when start-session request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const state = await renderAndFlush('session-token');
    expect(state.status).toBe('error');
    expect(state.sessionId).toBeNull();
    expect(state.linkToken).toBeNull();
  });
});
