export interface ExportReportRow {
  total_raw?: number | null;
  total_adjusted?: number | null;
  total_provisional?: boolean | null;
  norm_percentile?: number | null;
  norm_sd?: number | string | null;
  pending_review_count?: number | null;
  total_score?: number | null;
  percentile?: number | null;
  needs_review?: boolean | null;
}

export interface ExportSessionRow {
  status?: string | null;
}

export interface NormalizedExportReport {
  totalRaw: number | null;
  totalAdjusted: number | null;
  totalProvisional: boolean;
  normPercentile: number | null;
  normSd: number | string | null;
  pendingReviewCount: number;
  isFinal: boolean;
}

export function normalizeExportReport(report: ExportReportRow | null | undefined): NormalizedExportReport | null {
  if (!report) return null;

  const totalProvisional = report.total_provisional ?? report.needs_review ?? true;
  const pendingReviewCount = report.pending_review_count ?? (totalProvisional ? 1 : 0);

  return {
    totalRaw: report.total_raw ?? report.total_score ?? null,
    totalAdjusted: report.total_adjusted ?? report.total_score ?? null,
    totalProvisional,
    normPercentile: report.norm_percentile ?? report.percentile ?? null,
    normSd: report.norm_sd ?? null,
    pendingReviewCount,
    isFinal: !totalProvisional && pendingReviewCount === 0,
  };
}

export function getFinalizedExportBlockReason(
  session: ExportSessionRow | null | undefined,
  report: ExportReportRow | null | undefined,
): string | null {
  if (!session) return 'Session not found';
  if (session.status !== 'completed') return 'Session must be completed before export';

  const normalized = normalizeExportReport(report);
  if (!normalized) return 'Scoring report not found';
  if (!normalized.isFinal) return 'Clinician review must be finalized before export';

  return null;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '';
  let str = String(field);
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
