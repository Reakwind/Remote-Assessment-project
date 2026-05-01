import { describe, expect, it } from 'vitest';
import { getPatientStepConfig, patientTaskHasEvidence, patientTaskTotalSteps } from './patientTaskFlow';

describe('patientTaskFlow', () => {
  it('resolves cube task step metadata', () => {
    expect(getPatientStepConfig('/patient/cube')).toMatchObject({
      step: 2,
      next: '/patient/clock',
      prev: '/patient/trail-making',
      taskKey: 'cube',
    });
  });

  it('detects drawing stroke evidence', () => {
    expect(patientTaskHasEvidence('cube', { cube: { strokes: [[{ x: 1, y: 2 }]] } })).toBe(true);
    expect(patientTaskHasEvidence('cube', { cube: { strokes: [] } })).toBe(false);
  });

  it('keeps total step count stable', () => {
    expect(patientTaskTotalSteps).toBe(12);
  });
});
