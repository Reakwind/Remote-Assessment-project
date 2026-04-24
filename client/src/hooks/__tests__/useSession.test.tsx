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
let latestState: SessionState | null = null;

function SessionHarness({ token, code }: { token?: string; code?: string }) {
  latestState = useSession(token, code);
  return null;
}

async function renderAndFlush(token?: string, code?: string) {
  latestState = null;
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<SessionHarness token={token} code={code} />);
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  root.unmount();
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

    await renderAndFlush();
    expect(latestState?.status).toBe('invalid');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces invalid access code responses', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 } as Response);

    await renderAndFlush('session-token', '1234');
    expect(latestState?.status).toBe('invalid_code');
    expect(latestState?.requiresAccessCode).toBe(true);
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

    await renderAndFlush('session-token');
    expect(latestState?.status).toBe('code_required');
    expect(latestState?.sessionId).toBe('sess-code');
    expect(latestState?.linkToken).toBe('session-token');
    expect(latestState?.requiresAccessCode).toBe(true);
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

    await renderAndFlush('session-token');
    expect(latestState?.status).toBe('ready');
    expect(latestState?.linkToken).toBe('session-token');
    expect(latestState?.scoringContext?.sessionId).toBe('sess-ready');
    expect(latestState?.scoringContext?.educationYears).toBe(12);
    expect(latestState?.scoringContext?.patientAge).toBe(67);
  });

  it('moves to error state when start-session request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    await renderAndFlush('session-token');
    expect(latestState?.status).toBe('error');
    expect(latestState?.sessionId).toBeNull();
    expect(latestState?.linkToken).toBeNull();
  });
});
