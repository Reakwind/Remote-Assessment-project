import { describe, it, expect } from 'vitest';
import { scoreSession, scoreSessionWithConfig } from '../index';
import { getMocaVersionConfig, SUPPORTED_MOCA_VERSIONS, type MocaScoringConfig } from '../moca-config';
import type { ScoringContext } from '../../../types/scoring';

const CTX: ScoringContext = {
  sessionId: 'test-session-1',
  sessionDate: new Date('2026-04-21'),
  educationYears: 16,
  patientAge: 72,
  sessionLocation: { place: 'מרפאה', city: 'תל אביב' },
};

const FULL_RESULTS: Record<string, unknown> = {
  'moca-orientation-task': { date: '21', month: 'אפריל', year: '2026', day: 'שלישי', place: 'מרפאה', city: 'תל אביב' },
  'moca-digit-span': { forward: { isCorrect: true }, backward: { isCorrect: true } },
  'moca-vigilance': { score: 1 },
  'moca-serial-7s': [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }, { isCorrect: true }, { isCorrect: true }],
  'moca-language': { rep1: true, rep2: true, fluencyCount: 12 },
  'moca-abstraction': { pair1: true, pair2: true },
  'moca-delayed-recall': { recalled: ['פנים', 'קטיפה', 'כנסייה', 'חרצית', 'אדום'] },
  'moca-naming': ['סוס', 'נמר', 'ברווז'],
  'moca-cube': null,
  'moca-clock': null,
  'moca-visuospatial': null,
  'moca-memory-learning': { registered: true },
};

describe('scoreSession', () => {
  it('returns a ScoringReport with sessionId', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    expect(report.sessionId).toBe('test-session-1');
  });

  it('uses default MoCA version 8.3 when context has no version', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    expect(report.mocaVersion).toBe('8.3');
  });

  it.each(SUPPORTED_MOCA_VERSIONS)('uses selected MoCA version %s config', (version) => {
    const report = scoreSession(FULL_RESULTS, { ...CTX, mocaVersion: version });
    expect(report.mocaVersion).toBe(version);
    expect(report.domains.map((domain) => domain.domain)).toEqual(
      getMocaVersionConfig(version).domains.map((domain) => domain.id),
    );
  });

  it('throws on unsupported MoCA versions instead of scoring with the wrong contract', () => {
    expect(() => scoreSession(FULL_RESULTS, { ...CTX, mocaVersion: '7.1' })).toThrow('Unsupported MoCA version');
  });

  it('drawing tasks always set pendingReviewCount > 0', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    expect(report.pendingReviewCount).toBeGreaterThan(0);
  });

  it('totalProvisional is true when drawings pending', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    expect(report.totalProvisional).toBe(true);
  });

  it('totalRaw excludes drawing scores (they are 0 pending)', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    // deterministic rule-scored max = 6+2+1+3+3+2+5+3 = 25, all correct
    expect(report.totalRaw).toBe(25);
  });

  it('scores naming answers persisted by the active client payload shape', () => {
    const report = scoreSession(
      {
        ...FULL_RESULTS,
        'moca-naming': {
          answers: {
            'item-1': 'סוס',
            'item-2': 'נמר',
            'item-3': 'ברווז',
          },
        },
      },
      CTX,
    );

    const naming = report.domains.find((d) => d.domain === 'naming');
    expect(naming?.raw).toBe(3);
    expect(naming?.items.every((item) => item.needsReview === false)).toBe(true);
  });

  it('scores naming answers against the selected MoCA version', () => {
    const report = scoreSession(
      {
        ...FULL_RESULTS,
        'moca-naming': {
          answers: {
            'item-1': 'נחש',
            'item-2': 'פיל',
            'item-3': 'תנין',
          },
        },
      },
      { ...CTX, mocaVersion: '8.2' },
    );

    const naming = report.domains.find((d) => d.domain === 'naming');
    expect(naming?.raw).toBe(3);
  });

  it('routes malformed naming payloads to clinician review', () => {
    const missingAnswers = scoreSession({ ...FULL_RESULTS, 'moca-naming': {} }, CTX);
    const nullPayload = scoreSession({ ...FULL_RESULTS, 'moca-naming': null }, CTX);
    const arrayAnswers = scoreSession({ ...FULL_RESULTS, 'moca-naming': { answers: [] } }, CTX);
    const nonStringAnswer = scoreSession(
      { ...FULL_RESULTS, 'moca-naming': { answers: { lion: 'אריה', rhino: null, camel: 'גמל' } } },
      CTX,
    );

    for (const report of [missingAnswers, nullPayload, arrayAnswers, nonStringAnswer]) {
      const naming = report.domains.find((d) => d.domain === 'naming');
      expect(naming?.items).toContainEqual(expect.objectContaining({
        taskId: 'moca-naming',
        needsReview: true,
      }));
    }
  });

  it('applies education correction +1 for <= 12 years', () => {
    const ctx = { ...CTX, educationYears: 12 };
    const report = scoreSession(FULL_RESULTS, ctx);
    expect(report.totalAdjusted).toBe(report.totalRaw + 1);
  });

  it('does not apply education correction for > 12 years', () => {
    const report = scoreSession(FULL_RESULTS, CTX); // educationYears: 16
    expect(report.totalAdjusted).toBe(report.totalRaw);
  });

  it('totalAdjusted never exceeds 30', () => {
    const ctx = { ...CTX, educationYears: 12 };
    // even with max score, adjusted caps at 30
    const report = scoreSession(FULL_RESULTS, ctx);
    expect(report.totalAdjusted).toBeLessThanOrEqual(30);
  });

  it('accepts persisted sessionDate strings for orientation scoring', () => {
    const report = scoreSession(FULL_RESULTS, {
      ...CTX,
      // localStorage serialization path can rehydrate this as a string
      sessionDate: '2026-04-21T00:00:00.000Z' as unknown as Date,
    });
    const orientation = report.domains.find((d) => d.domain === 'orientation');
    expect(orientation?.raw).toBe(6);
  });

  it('normPercentile is null when totalProvisional', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    expect(report.normPercentile).toBeNull();
  });

  it('has 7 domains', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    expect(report.domains).toHaveLength(7);
  });

  it('memory-learning task not included in domains', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    const allTaskIds = report.domains.flatMap(d => d.items.map(i => i.taskId));
    expect(allTaskIds.some(id => id.includes('memory-learning'))).toBe(false);
  });

  it('unsupported rule payload falls back to needsReview', () => {
    const badResults = { ...FULL_RESULTS, 'moca-serial-7s': 'not-an-array' };
    const report = scoreSession(badResults, CTX);
    const serial = report.domains
      .flatMap(d => d.items)
      .find(i => i.taskId === 'moca-serial-7s');
    expect(serial?.needsReview).toBe(true);
    expect(serial?.reviewReason).toBe('rule_score_unavailable');
  });

  it('sets completedAt as ISO string', () => {
    const report = scoreSession(FULL_RESULTS, CTX);
    expect(() => new Date(report.completedAt)).not.toThrow();
  });

  it('returns null norm values when no matching age norm exists', () => {
    const report = scoreSession(FULL_RESULTS, { ...CTX, patientAge: 40 });
    expect(report.normPercentile).toBeNull();
    expect(report.normSd).toBeNull();
  });

  it('skips unknown task ids during scoring', () => {
    const withUnknown = { ...FULL_RESULTS, 'unknown-task': { any: 'value' } };
    const report = scoreSession(withUnknown, CTX);
    const unknownItems = report.domains.flatMap((d) => d.items).filter((i) => i.taskId === 'unknown-task');
    expect(unknownItems).toHaveLength(0);
  });

  it('treats malformed orientation payload as a clinician review item', () => {
    const malformed = { ...FULL_RESULTS, 'moca-orientation-task': 'bad-shape' };
    const report = scoreSession(malformed, CTX);
    const orientationFailure = report.domains
      .flatMap((d) => d.items)
      .find((i) => i.taskId === 'moca-orientation-task');
    expect(orientationFailure?.needsReview).toBe(true);
    expect(orientationFailure?.reviewReason).toBe('rule_score_unavailable');
  });

  it('routes orientation place and city to clinician review when no session location exists', () => {
    const report = scoreSession(FULL_RESULTS, { ...CTX, sessionLocation: undefined });
    const items = report.domains.flatMap((d) => d.items);

    expect(items.find((i) => i.taskId === 'orientation.date')?.needsReview).toBe(false);
    expect(items.find((i) => i.taskId === 'orientation.place')).toEqual(expect.objectContaining({
      needsReview: true,
      reviewReason: 'rule_score_unavailable',
    }));
    expect(items.find((i) => i.taskId === 'orientation.city')).toEqual(expect.objectContaining({
      needsReview: true,
      reviewReason: 'rule_score_unavailable',
    }));
  });

  it('computes norm metrics when config has no manual-review tasks', () => {
    const cfg: MocaScoringConfig = {
      ...getMocaVersionConfig('8.3'),
      domains: [
        {
          id: 'language',
          label: 'Language',
          tasks: [
            { taskId: 'moca-language', max: 3 },
            { taskId: 'moca-unknown', max: 1 },
          ],
        },
      ],
      drawingTasks: [],
      noScoreTasks: [],
    };

    const report = scoreSessionWithConfig(
      {
        'moca-language': { rep1: true, rep2: true, fluencyCount: 12 },
        'moca-unknown': { any: 'value' },
      },
      CTX,
      cfg,
    );

    expect(report.totalProvisional).toBe(false);
    expect(report.normPercentile).not.toBeNull();
    expect(report.normSd).not.toBeNull();
    const unknownItems = report.domains.flatMap((d) => d.items).filter((i) => i.taskId === 'moca-unknown');
    expect(unknownItems).toHaveLength(0);
  });

  it('skips tasks that are configured as no-score', () => {
    const cfg: MocaScoringConfig = {
      ...getMocaVersionConfig('8.3'),
      domains: [{ id: 'memory', label: 'Memory', tasks: [{ taskId: 'moca-memory-learning', max: 0 }] }],
      drawingTasks: [],
      noScoreTasks: ['moca-memory-learning'],
    };

    const report = scoreSessionWithConfig(
      { 'moca-memory-learning': { registered: true } },
      CTX,
      cfg,
    );

    expect(report.totalProvisional).toBe(false);
    expect(report.domains[0].items).toHaveLength(0);
    expect(report.totalRaw).toBe(0);
  });

  it('returns null norm metrics when no matching norm exists and review is not pending', () => {
    const cfg: MocaScoringConfig = {
      ...getMocaVersionConfig('8.3'),
      domains: [{ id: 'language', label: 'Language', tasks: [{ taskId: 'moca-language', max: 3 }] }],
      drawingTasks: [],
      noScoreTasks: [],
    };

    const report = scoreSessionWithConfig(
      { 'moca-language': { rep1: true, rep2: true, fluencyCount: 12 } },
      { ...CTX, patientAge: 40 },
      cfg,
    );

    expect(report.totalProvisional).toBe(false);
    expect(report.normPercentile).toBeNull();
    expect(report.normSd).toBeNull();
  });

  it('scores drawing task id as pending review when manually configured in drawingTasks', () => {
    const cfg: MocaScoringConfig = {
      ...getMocaVersionConfig('8.3'),
      domains: [{ id: 'custom', label: 'Custom', tasks: [{ taskId: 'moca-free-draw', max: 2 }] }],
      drawingTasks: ['moca-free-draw'],
      noScoreTasks: [],
    };

    const report = scoreSessionWithConfig({ 'moca-free-draw': { strokes: [] } }, CTX, cfg);
    const drawingItem = report.domains[0]?.items[0];
    expect(drawingItem?.taskId).toBe('moca-free-draw');
    expect(drawingItem?.needsReview).toBe(true);
    expect(drawingItem?.reviewReason).toBe('drawing');
    expect(drawingItem?.max).toBe(2);
  });

  it('uses fallback max=1 for drawing tasks when configured task max is undefined', () => {
    const cfg = {
      ...getMocaVersionConfig('8.3'),
      domains: [{ id: 'custom', label: 'Custom', tasks: [{ taskId: 'moca-free-draw-no-max' }] }],
      drawingTasks: ['moca-free-draw-no-max'],
      noScoreTasks: [],
    } as MocaScoringConfig;

    const report = scoreSessionWithConfig({ 'moca-free-draw-no-max': { strokes: [] } }, CTX, cfg);
    const drawingItem = report.domains[0]?.items[0];
    expect(drawingItem?.taskId).toBe('moca-free-draw-no-max');
    expect(drawingItem?.needsReview).toBe(true);
    expect(drawingItem?.max).toBe(1);
  });
});
