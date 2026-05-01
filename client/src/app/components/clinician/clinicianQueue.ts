export type ClinicianQueueStatus = 'new' | 'in_progress' | 'review' | 'completed';

export interface ClinicianScoringSummary {
  total_provisional?: boolean | null;
  needs_review?: boolean | null;
  pending_review_count?: number | null;
}

export interface ClinicianSessionSummary {
  status: 'pending' | 'in_progress' | 'completed' | 'awaiting_review';
  scoring_reports?: ClinicianScoringSummary | ClinicianScoringSummary[] | null;
}

export interface ClinicianQueueRow {
  status: ClinicianQueueStatus;
}

function relationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function reportNeedsReview(report: ClinicianScoringSummary | null | undefined): boolean {
  if (!report) return false;
  return report.total_provisional ?? report.needs_review ?? false;
}

export function deriveClinicianStatus(
  sessionValue: ClinicianSessionSummary[] | null | undefined,
): ClinicianQueueStatus {
  const sessions = relationArray(sessionValue);
  if (sessions.length === 0) return 'new';
  if (
    sessions.some(
      (session) =>
        session.status === 'awaiting_review' ||
        relationArray(session.scoring_reports).some(reportNeedsReview),
    )
  ) {
    return 'review';
  }
  if (sessions.some((session) => session.status === 'in_progress')) return 'in_progress';
  if (sessions.every((session) => session.status === 'completed')) return 'completed';
  return 'new';
}

export function deriveClinicianQueueSummary(rows: ClinicianQueueRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.all += 1;
      summary[row.status] += 1;
      return summary;
    },
    {
      all: 0,
      new: 0,
      in_progress: 0,
      review: 0,
      completed: 0,
    },
  );
}
