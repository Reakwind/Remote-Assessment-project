import type { ItemScore } from '../../types/scoring';

// Unicode range for Hebrew niqqud (diacritics): U+0591–U+05C7
const NIQQUD_REGEX = /[֑-ׇ]/g;

export function normalizeHebrew(text: string): string {
  return text
    .replace(NIQQUD_REGEX, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function safeScore(
  taskId: string,
  rawData: unknown,
  scorer: (data: unknown) => ItemScore[],
  maxOnFailure = 0
): ItemScore[] {
  try {
    return scorer(rawData);
  } catch {
    return [{
      taskId,
      score: 0,
      max: maxOnFailure,
      needsReview: true,
      reviewReason: 'rule_score_unavailable',
      rawData,
    }];
  }
}
