const TRANSIENT_STATUS = new Set([502, 503, 504]);
const TRANSIENT_TEXT = [
  'WorkerAlreadyRetired',
  'worker has already retired',
  'invalid response was received from the upstream server',
  'upstream server',
];

export interface EdgeFetchRetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

export async function edgeFetch(input: RequestInfo | URL, init?: RequestInit, options: EdgeFetchRetryOptions = {}) {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (attempt >= retries || !(await isTransientEdgeResponse(response))) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
    }

    await delay(baseDelayMs * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error('Edge request failed');
}

export async function edgeErrorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.clone().json();
    return payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
}

async function isTransientEdgeResponse(response: Response) {
  if (TRANSIENT_STATUS.has(response.status)) return true;
  if (response.status !== 500) return false;

  const text = await response.clone().text().catch(() => '');
  return TRANSIENT_TEXT.some((value) => text.includes(value));
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
