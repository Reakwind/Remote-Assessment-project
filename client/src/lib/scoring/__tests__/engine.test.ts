import { describe, it, expect } from 'vitest';
import { scoreSession } from '../index';
import type { ScoringContext } from '../../../types/scoring';

describe('Scoring Engine', () => {
  it('keeps adjusted total equal to raw total without an education bonus', () => {
    const ctx: ScoringContext = {
      sessionId: 'test-1',
      sessionDate: new Date(),
      educationYears: 10,
      patientAge: 70
    };
    
    const results = {
      'moca-orientation': { }
    };
    
    const report = scoreSession(results, ctx);
    expect(report.totalAdjusted).toBe(report.totalRaw);
  });
});
