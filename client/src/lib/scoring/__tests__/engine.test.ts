import { describe, it, expect } from 'vitest';
import { scoreSession } from '../index';
import type { ScoringContext } from '../../../types/scoring';

describe('Scoring Engine', () => {
  it('calculates total score correctly with education correction', () => {
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
    // Since raw is 0 and education <= 12, adjusted should be 1
    expect(report.totalAdjusted).toBe(1);
  });
});
