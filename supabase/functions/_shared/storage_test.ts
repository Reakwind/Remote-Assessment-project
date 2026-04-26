import { browserReachableSignedUrl, sessionScopedObjectPath } from './storage.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

Deno.test('browserReachableSignedUrl rewrites local Docker signed URLs to request origin', () => {
  const req = new Request('http://supabase_edge_runtime_remote_assessment_project:8081/functions/v1/get-stimuli');
  const signedUrl = 'http://kong:8000/storage/v1/object/sign/stimuli/8.3/moca-cube/cube-stimulus.png?token=abc';

  assertEquals(
    browserReachableSignedUrl(signedUrl, req),
    'http://127.0.0.1:54321/storage/v1/object/sign/stimuli/8.3/moca-cube/cube-stimulus.png?token=abc',
  );
});

Deno.test('browserReachableSignedUrl prefers forwarded public Supabase origin', () => {
  const req = new Request('http://supabase_edge_runtime_remote_assessment_project:8081/functions/v1/get-stimuli', {
    headers: {
      'x-forwarded-host': '127.0.0.1:54321',
      'x-forwarded-proto': 'http',
    },
  });
  const signedUrl = 'http://supabase_edge_runtime_remote_assessment_project:8081/storage/v1/object/sign/stimuli/8.3/moca-cube/cube-stimulus.png?token=abc';

  assertEquals(
    browserReachableSignedUrl(signedUrl, req),
    'http://127.0.0.1:54321/storage/v1/object/sign/stimuli/8.3/moca-cube/cube-stimulus.png?token=abc',
  );
});

Deno.test('browserReachableSignedUrl restores local Supabase API port when forwarded host omits it', () => {
  const req = new Request('http://supabase_edge_runtime_remote_assessment_project:8081/functions/v1/get-stimuli', {
    headers: {
      'x-forwarded-host': '127.0.0.1',
      'x-forwarded-proto': 'http',
    },
  });
  const signedUrl = 'http://supabase_edge_runtime_remote_assessment_project:8081/storage/v1/object/sign/stimuli/8.3/moca-cube/cube-stimulus.png?token=abc';

  assertEquals(
    browserReachableSignedUrl(signedUrl, req),
    'http://127.0.0.1:54321/storage/v1/object/sign/stimuli/8.3/moca-cube/cube-stimulus.png?token=abc',
  );
});

Deno.test('sessionScopedObjectPath accepts only direct objects under the current session', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';

  assertEquals(sessionScopedObjectPath(`${sessionId}/moca-memory-learning.webm`, sessionId), `${sessionId}/moca-memory-learning.webm`);
  assertEquals(sessionScopedObjectPath(`22222222-2222-4222-8222-222222222222/moca-memory-learning.webm`, sessionId), null);
  assertEquals(sessionScopedObjectPath(`${sessionId}/nested/audio.webm`, sessionId), null);
  assertEquals(sessionScopedObjectPath(`${sessionId}/../audio.webm`, sessionId), null);
});
