import { applyManualScores, scoreSession, type ScoringContext } from './scoring.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const CTX: ScoringContext = {
  sessionId: 'test-session',
  sessionDate: new Date('2026-04-21T00:00:00Z'),
  educationYears: 16,
  patientAge: 72,
  mocaVersion: '8.3',
  sessionLocation: { place: 'מרפאה', city: 'תל אביב' },
};

Deno.test('scoreSession preserves selected MoCA version', () => {
  for (const version of ['8.1', '8.2', '8.3']) {
    const report = scoreSession({}, { ...CTX, mocaVersion: version });
    assertEquals(report.mocaVersion, version);
  }
});

Deno.test('scoreSession scores active naming answers object', () => {
  const report = scoreSession({
    'moca-naming': {
      answers: {
        'item-1': 'סוס',
        'item-2': 'נמר',
        'item-3': 'ברווז',
      },
    },
  }, CTX);

  assertEquals(report.domains.find((domain) => domain.domain === 'naming')?.raw, 3);
});

Deno.test('scoreSession does not add an education bonus to the total score', () => {
  const report = scoreSession({
    'moca-naming': {
      answers: {
        'item-1': 'סוס',
        'item-2': 'נמר',
        'item-3': 'ברווז',
      },
    },
  }, { ...CTX, educationYears: 10 });

  assertEquals(report.totalRaw, 3);
  assertEquals(report.totalAdjusted, 3);
});

Deno.test('applyManualScores keeps adjusted total equal to raw total without an education bonus', () => {
  const lowEducationCtx = { ...CTX, educationYears: 10 };
  const report = scoreSession({
    'moca-naming': {
      answers: {
        'item-1': 'סוס',
        'item-2': 'נמר',
        'item-3': 'ברווז',
      },
    },
  }, lowEducationCtx);

  const updated = applyManualScores(report, lowEducationCtx, {});
  assertEquals(updated.totalRaw, 3);
  assertEquals(updated.totalAdjusted, 3);
});

Deno.test('scoreSession scores version-specific naming answers', () => {
  const report = scoreSession({
    'moca-naming': {
      answers: {
        'item-1': 'נחש',
        'item-2': 'פיל',
        'item-3': 'תנין',
      },
    },
  }, { ...CTX, mocaVersion: '8.2' });

  assertEquals(report.domains.find((domain) => domain.domain === 'naming')?.raw, 3);
});

Deno.test('scoreSession scores structured vigilance tap-count payload', () => {
  const report = scoreSession({
    'moca-vigilance': {
      tapped: 10,
      targetLetter: 'א',
      targetCount: 11,
      sequenceLength: 29,
    },
  }, CTX);

  const vigilance = report.domains
    .flatMap((domain) => domain.items)
    .find((item) => item.taskId === 'moca-vigilance');
  assertEquals(vigilance?.score, 1);
  assertEquals(vigilance?.needsReview, false);
});

Deno.test('scoreSession routes off-target vigilance tap counts to clinician review', () => {
  const report = scoreSession({
    'moca-vigilance': {
      tapped: 4,
      targetLetter: 'א',
      targetCount: 11,
      sequenceLength: 29,
    },
  }, CTX);

  const vigilance = report.domains
    .flatMap((domain) => domain.items)
    .find((item) => item.taskId === 'moca-vigilance');
  assertEquals(vigilance?.score, 0);
  assertEquals(vigilance?.needsReview, true);
  assertEquals(vigilance?.reviewReason, 'rule_score_unavailable');
  assertEquals(report.totalProvisional, true);
});

Deno.test('scoreSession uses configured recall words shared with patient flow', () => {
  const report = scoreSession({
    'moca-delayed-recall': { recalled: ['פנים', 'קטיפה', 'כנסייה', 'חרצית', 'אדום'] },
  }, CTX);

  assertEquals(report.domains.find((domain) => domain.domain === 'memory')?.raw, 5);
});

Deno.test('scoreSession routes malformed naming answers to review', () => {
  const report = scoreSession({ 'moca-naming': { answers: { lion: 'אריה' } } }, CTX);
  const namingItem = report.domains.find((domain) => domain.domain === 'naming')?.items[0];
  assertEquals(namingItem?.needsReview, true);
  assertEquals(namingItem?.reviewReason, 'rule_score_unavailable');
});

Deno.test('scoreSession sends orientation place and city to review when session location is absent', () => {
  const report = scoreSession({
    'moca-orientation-task': {
      date: '21',
      month: 'אפריל',
      year: '2026',
      day: 'שלישי',
      place: 'בית',
      city: 'תל אביב',
    },
  }, { ...CTX, sessionLocation: undefined });

  const items = report.domains.flatMap((domain) => domain.items);
  assertEquals(items.find((item) => item.taskId === 'orientation.date')?.needsReview, false);
  assertEquals(items.find((item) => item.taskId === 'orientation.place')?.needsReview, true);
  assertEquals(items.find((item) => item.taskId === 'orientation.city')?.needsReview, true);
});

Deno.test('scoreSession rejects unsupported MoCA versions', () => {
  let threw = false;
  try {
    scoreSession({}, { ...CTX, mocaVersion: '7.1' });
  } catch (error) {
    threw = error instanceof Error && error.message.includes('Unsupported MoCA version');
  }
  assertEquals(threw, true);
});
