import { describe, expect, it } from 'vitest';
import { hasCapturedTaskData, skippedTaskPayload, toCanonicalTaskPayload } from './taskMapping';

describe('taskMapping', () => {
  it('keeps skipped payloads as clinician-review evidence', () => {
    const skipped = skippedTaskPayload('naming');

    expect(toCanonicalTaskPayload('naming', skipped)).toMatchObject({
      skipped: true,
      requiresReview: true,
      localTaskName: 'naming',
    });
  });

  it('detects captured task data by task type', () => {
    expect(hasCapturedTaskData('clock', { strokes: [{ x: 1, y: 1 }] })).toBe(true);
    expect(hasCapturedTaskData('clock', { strokes: [] })).toBe(false);
    expect(hasCapturedTaskData('naming', { answers: { lion: 'אריה' } })).toBe(true);
    expect(hasCapturedTaskData('memory', { audioId: 'audio-1' })).toBe(true);
    expect(hasCapturedTaskData('vigilance', { tapped: 0 })).toBe(false);
  });
});
