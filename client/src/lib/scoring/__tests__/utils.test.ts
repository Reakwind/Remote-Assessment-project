import { describe, it, expect } from 'vitest';
import { normalizeHebrew, safeScore } from '../utils';
import type { ItemScore } from '../../../types/scoring';

describe('normalizeHebrew', () => {
  it('trims whitespace', () => {
    expect(normalizeHebrew('  שלום  ')).toBe('שלום');
  });

  it('strips niqqud (Hebrew diacritics)', () => {
    expect(normalizeHebrew('שָׁלוֹם')).toBe('שלום');
  });

  it('normalizes to lowercase (Latin chars in mixed input)', () => {
    expect(normalizeHebrew('Tel Aviv')).toBe('tel aviv');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeHebrew('תל   אביב')).toBe('תל אביב');
  });

  it('handles empty string', () => {
    expect(normalizeHebrew('')).toBe('');
  });
});

describe('safeScore', () => {
  it('returns scorer result on success', () => {
    const result = safeScore('moca-naming', { answers: [] }, () => [
      { taskId: 'moca-naming', score: 2, max: 3, needsReview: false }
    ]);
    expect(result[0].score).toBe(2);
    expect(result[0].needsReview).toBe(false);
  });

  it('returns needsReview item when scorer throws', () => {
    const result = safeScore('moca-naming', { bad: 'data' }, () => {
      throw new Error('unexpected shape');
    });
    expect(result).toHaveLength(1);
    expect(result[0].needsReview).toBe(true);
    expect(result[0].reviewReason).toBe('rule_score_unavailable');
    expect(result[0].score).toBe(0);
  });

  it('preserves rawData when scorer fails', () => {
    const raw = { answers: [null, null] };
    const result = safeScore('moca-naming', raw, () => {
      throw new Error('fail');
    });
    expect(result[0].rawData).toEqual(raw);
  });

  it('preserves max from config when scorer fails', () => {
    const result = safeScore('moca-naming', {}, () => {
      throw new Error('fail');
    }, 3);
    expect(result[0].max).toBe(3);
  });
});

describe('safeScore return type', () => {
  it('returns ItemScore array', () => {
    const result: ItemScore[] = safeScore('moca-vigilance', { score: 1 }, () => [
      { taskId: 'moca-vigilance', score: 1, max: 1, needsReview: false }
    ]);
    expect(Array.isArray(result)).toBe(true);
  });
});
