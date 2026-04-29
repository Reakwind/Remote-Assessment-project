import { corsHeaders, corsResponse } from './http.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function withAllowedOrigins(value: string | undefined, test: () => void) {
  const previous = Deno.env.get('ALLOWED_ORIGINS');
  try {
    if (value === undefined) Deno.env.delete('ALLOWED_ORIGINS');
    else Deno.env.set('ALLOWED_ORIGINS', value);
    test();
  } finally {
    if (previous === undefined) Deno.env.delete('ALLOWED_ORIGINS');
    else Deno.env.set('ALLOWED_ORIGINS', previous);
  }
}

Deno.test('corsHeaders uses local defaults when ALLOWED_ORIGINS is unset', () => {
  withAllowedOrigins(undefined, () => {
    const headers = corsHeaders(new Request('https://example.test', {
      headers: { Origin: 'http://localhost:5173' },
    }));

    assertEquals(headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
    assertEquals(headers['Vary'], 'Origin');
  });
});

Deno.test('corsHeaders allows configured hosted origins', () => {
  withAllowedOrigins('https://clinician.example.test, https://patient.example.test', () => {
    const headers = corsHeaders(new Request('https://example.test', {
      headers: { Origin: 'https://patient.example.test' },
    }));

    assertEquals(headers['Access-Control-Allow-Origin'], 'https://patient.example.test');
  });
});

Deno.test('corsResponse rejects disallowed preflight origins without CORS allow headers', () => {
  withAllowedOrigins('https://clinician.example.test', () => {
    const response = corsResponse(new Request('https://example.test', {
      method: 'OPTIONS',
      headers: { Origin: 'https://unknown.example.test' },
    }));

    assertEquals(response.status, 403);
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), null);
    assertEquals(response.headers.get('Vary'), 'Origin');
  });
});
