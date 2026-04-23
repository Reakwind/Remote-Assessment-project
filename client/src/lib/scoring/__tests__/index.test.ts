import { describe, it, expect } from 'vitest';
import { scoreSession } from '../index';
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
});
