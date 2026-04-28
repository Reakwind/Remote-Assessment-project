// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { edgeErrorMessage, edgeFetch } from './edgeFetch';

const fetchMock = vi.fn();

describe('edgeFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  it('retries transient retired-worker failures', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Request failed due to an internal server error',
        trace: 'WorkerAlreadyRetired: request cannot be handled because the worker has already retired',
      }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const responsePromise = edgeFetch('/functions/v1/submit-results', { method: 'POST' });
    await vi.runOnlyPendingTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry validation failures', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 }));

    const response = await edgeFetch('/functions/v1/submit-results', { method: 'POST' });

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('edgeErrorMessage', () => {
  it('uses Edge Function message payloads before fallback text', async () => {
    const response = new Response(JSON.stringify({ message: 'Temporary upstream failure' }), { status: 502 });

    await expect(edgeErrorMessage(response, 'fallback')).resolves.toBe('Temporary upstream failure');
  });
});
