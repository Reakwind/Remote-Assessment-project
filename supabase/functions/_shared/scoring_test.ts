import { scoreSession, type ScoringContext } from './scoring.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const CTX: ScoringContext = {
  sessionId: 'test-session',
  sessionDate: new Date('2026-04-21T00:00:00Z'),
  educationYears: 16,
  patientAge: 72,
  sessionLocation: { place: 'מרפאה', city: 'תל אביב' },
};

Deno.test('scoreSession scores active naming answers object', () => {
  const report = scoreSession({
    'moca-naming': {
      answers: {
        lion: 'אריה',
        rhino: 'קרנף',
        camel: 'גמל',
      },
    },
  }, CTX);

  assertEquals(report.domains.find((domain) => domain.domain === 'naming')?.raw, 3);
});

Deno.test('scoreSession routes malformed naming answers to review', () => {
  const report = scoreSession({ 'moca-naming': { answers: { lion: 'אריה' } } }, CTX);
  const namingItem = report.domains.find((domain) => domain.domain === 'naming')?.items[0];
  assertEquals(namingItem?.needsReview, true);
  assertEquals(namingItem?.reviewReason, 'rule_score_unavailable');
});
