import { beforeEach, describe, expect, it } from 'vitest';
import {
  ASSESSMENT_STORAGE_KEY,
  getResumeStateForToken,
  readAssessmentState,
  writeAssessmentState,
  type AssessmentState,
} from './assessmentPersistence';

const baseState: AssessmentState = {
  id: 'session-1',
  linkToken: 'token-1',
  scoringContext: {
    sessionId: 'session-1',
    sessionDate: new Date('2026-04-25T10:00:00.000Z'),
    mocaVersion: '8.2',
    educationYears: 12,
    patientAge: 75,
    sessionLocation: { place: 'Clinic', city: 'Tel Aviv' },
  },
  lastPath: '/patient/clock',
  isComplete: false,
  tasks: { clock: { strokes: [{ x: 1, y: 2 }] } },
};

describe('assessmentPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores stored dates and task progress', () => {
    writeAssessmentState(baseState);

    const restored = readAssessmentState();

    expect(restored.id).toBe('session-1');
    expect(restored.lastPath).toBe('/patient/clock');
    expect(restored.tasks.clock).toEqual({ strokes: [{ x: 1, y: 2 }] });
    expect(restored.scoringContext?.sessionDate).toBeInstanceOf(Date);
    expect(restored.scoringContext?.sessionDate.toISOString()).toBe('2026-04-25T10:00:00.000Z');
    expect(restored.scoringContext?.mocaVersion).toBe('8.2');
  });

  it('returns resume state only for the same unfinished token', () => {
    writeAssessmentState(baseState);

    expect(getResumeStateForToken('token-1')?.id).toBe('session-1');
    expect(getResumeStateForToken('other-token')).toBeNull();

    localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify({ ...baseState, isComplete: true }));
    expect(getResumeStateForToken('token-1')).toBeNull();
  });
});
