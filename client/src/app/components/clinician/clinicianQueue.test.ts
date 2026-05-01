import { describe, expect, it } from 'vitest';
import { deriveClinicianQueueSummary, deriveClinicianStatus } from './clinicianQueue';

describe('clinicianQueue', () => {
  it('derives review status from awaiting-review session', () => {
    expect(deriveClinicianStatus([
      { status: 'awaiting_review', scoring_reports: { total_provisional: true, needs_review: true, pending_review_count: 2 } },
    ])).toBe('review');
  });

  it('builds queue counts by actionable state', () => {
    const summary = deriveClinicianQueueSummary([
      { status: 'new' },
      { status: 'in_progress' },
      { status: 'review' },
      { status: 'completed' },
    ]);
    expect(summary).toEqual({
      all: 4,
      new: 1,
      in_progress: 1,
      review: 1,
      completed: 1,
    });
  });
});
