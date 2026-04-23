import { describe, it, expect } from 'vitest';
import { scoreSession } from '../index';
import type { ScoringContext } from '../../../types/scoring';
import scoringConfig from '../../../data/scoring-config.json' with { type: 'json' };

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
  'moca-naming': ['אריה', 'קרנף', 'גמל'],
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
    // auto-scored max = 6+2+1+3+3+2+5+3 = 25, all correct
    expect(report.totalRaw).toBe(25);
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

  it('auto-score failure falls back to needsReview', () => {
    const badResults = { ...FULL_RESULTS, 'moca-serial-7s': 'not-an-array' };
    const report = scoreSession(badResults, CTX);
    const serial = report.domains
      .flatMap(d => d.items)
      .find(i => i.taskId === 'moca-serial-7s');
    expect(serial?.needsReview).toBe(true);
    expect(serial?.reviewReason).toBe('auto_score_failed');
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

  it('treats malformed orientation payload as auto-score failure item', () => {
    const malformed = { ...FULL_RESULTS, 'moca-orientation-task': 'bad-shape' };
    const report = scoreSession(malformed, CTX);
    const orientationFailure = report.domains
      .flatMap((d) => d.items)
      .find((i) => i.taskId === 'moca-orientation-task');
    expect(orientationFailure?.needsReview).toBe(true);
    expect(orientationFailure?.reviewReason).toBe('auto_score_failed');
  });

  it('computes norm metrics when config has no manual-review tasks', () => {
    const cfg = scoringConfig as unknown as {
      domains: Array<{ id: string; label: string; tasks: Array<{ taskId: string; max: number }> }>;
      drawingTasks: string[];
      noScoreTasks: string[];
    };
    const originalDomains = cfg.domains;
    const originalDrawingTasks = cfg.drawingTasks;
    const originalNoScoreTasks = cfg.noScoreTasks;

    try {
      cfg.domains = [
        {
          id: 'language',
          label: 'Language',
          tasks: [
            { taskId: 'moca-language', max: 3 },
            { taskId: 'moca-unknown', max: 1 },
          ],
        },
      ];
      cfg.drawingTasks = [];
      cfg.noScoreTasks = [];

      const report = scoreSession(
        {
          'moca-language': { rep1: true, rep2: true, fluencyCount: 12 },
          'moca-unknown': { any: 'value' },
        },
        CTX,
      );

      expect(report.totalProvisional).toBe(false);
      expect(report.normPercentile).not.toBeNull();
      expect(report.normSd).not.toBeNull();
      const unknownItems = report.domains.flatMap((d) => d.items).filter((i) => i.taskId === 'moca-unknown');
      expect(unknownItems).toHaveLength(0);
    } finally {
      cfg.domains = originalDomains;
      cfg.drawingTasks = originalDrawingTasks;
      cfg.noScoreTasks = originalNoScoreTasks;
    }
  });

  it('skips tasks that are configured as no-score', () => {
    const cfg = scoringConfig as unknown as {
      domains: Array<{ id: string; label: string; tasks: Array<{ taskId: string; max: number }> }>;
      drawingTasks: string[];
      noScoreTasks: string[];
    };
    const originalDomains = cfg.domains;
    const originalDrawingTasks = cfg.drawingTasks;
    const originalNoScoreTasks = cfg.noScoreTasks;

    try {
      cfg.domains = [{ id: 'memory', label: 'Memory', tasks: [{ taskId: 'moca-memory-learning', max: 0 }] }];
      cfg.drawingTasks = [];
      cfg.noScoreTasks = ['moca-memory-learning'];

      const report = scoreSession(
        { 'moca-memory-learning': { registered: true } },
        CTX,
      );

      expect(report.totalProvisional).toBe(false);
      expect(report.domains[0].items).toHaveLength(0);
      expect(report.totalRaw).toBe(0);
    } finally {
      cfg.domains = originalDomains;
      cfg.drawingTasks = originalDrawingTasks;
      cfg.noScoreTasks = originalNoScoreTasks;
    }
  });

  it('returns null norm metrics when no matching norm exists and review is not pending', () => {
    const cfg = scoringConfig as unknown as {
      domains: Array<{ id: string; label: string; tasks: Array<{ taskId: string; max: number }> }>;
      drawingTasks: string[];
      noScoreTasks: string[];
    };
    const originalDomains = cfg.domains;
    const originalDrawingTasks = cfg.drawingTasks;
    const originalNoScoreTasks = cfg.noScoreTasks;

    try {
      cfg.domains = [{ id: 'language', label: 'Language', tasks: [{ taskId: 'moca-language', max: 3 }] }];
      cfg.drawingTasks = [];
      cfg.noScoreTasks = [];

      const report = scoreSession(
        { 'moca-language': { rep1: true, rep2: true, fluencyCount: 12 } },
        { ...CTX, patientAge: 40 },
      );

      expect(report.totalProvisional).toBe(false);
      expect(report.normPercentile).toBeNull();
      expect(report.normSd).toBeNull();
    } finally {
      cfg.domains = originalDomains;
      cfg.drawingTasks = originalDrawingTasks;
      cfg.noScoreTasks = originalNoScoreTasks;
    }
  });

  it('scores drawing task id as pending review when manually configured in drawingTasks', () => {
    const cfg = scoringConfig as unknown as {
      domains: Array<{ id: string; label: string; tasks: Array<{ taskId: string; max: number }> }>;
      drawingTasks: string[];
      noScoreTasks: string[];
    };
    const originalDomains = cfg.domains;
    const originalDrawingTasks = cfg.drawingTasks;
    const originalNoScoreTasks = cfg.noScoreTasks;

    try {
      cfg.domains = [{ id: 'custom', label: 'Custom', tasks: [{ taskId: 'moca-free-draw', max: 2 }] }];
      cfg.drawingTasks = ['moca-free-draw'];
      cfg.noScoreTasks = [];

      const report = scoreSession({ 'moca-free-draw': { strokes: [] } }, CTX);
      const drawingItem = report.domains[0]?.items[0];
      expect(drawingItem?.taskId).toBe('moca-free-draw');
      expect(drawingItem?.needsReview).toBe(true);
      expect(drawingItem?.reviewReason).toBe('drawing');
      expect(drawingItem?.max).toBe(2);
    } finally {
      cfg.domains = originalDomains;
      cfg.drawingTasks = originalDrawingTasks;
      cfg.noScoreTasks = originalNoScoreTasks;
    }
  });

  it('uses fallback max=1 for drawing tasks when configured task max is undefined', () => {
    const cfg = scoringConfig as unknown as {
      domains: Array<{ id: string; label: string; tasks: Array<{ taskId: string; max?: number }> }>;
      drawingTasks: string[];
      noScoreTasks: string[];
    };
    const originalDomains = cfg.domains;
    const originalDrawingTasks = cfg.drawingTasks;
    const originalNoScoreTasks = cfg.noScoreTasks;

    try {
      cfg.domains = [{ id: 'custom', label: 'Custom', tasks: [{ taskId: 'moca-free-draw-no-max' }] }];
      cfg.drawingTasks = ['moca-free-draw-no-max'];
      cfg.noScoreTasks = [];

      const report = scoreSession({ 'moca-free-draw-no-max': { strokes: [] } }, CTX);
      const drawingItem = report.domains[0]?.items[0];
      expect(drawingItem?.taskId).toBe('moca-free-draw-no-max');
      expect(drawingItem?.needsReview).toBe(true);
      expect(drawingItem?.max).toBe(1);
    } finally {
      cfg.domains = originalDomains;
      cfg.drawingTasks = originalDrawingTasks;
      cfg.noScoreTasks = originalNoScoreTasks;
    }
  });
});
