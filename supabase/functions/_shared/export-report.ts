export interface ExportReportRow {
  total_raw?: number | null;
  total_adjusted?: number | null;
  total_provisional?: boolean | null;
  norm_percentile?: number | null;
  norm_sd?: number | string | null;
  pending_review_count?: number | null;
  domains?: unknown;
  finalized_at?: string | null;
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
  finalizedAt: string | null;
  domains: NormalizedExportDomain[];
}

export interface NormalizedExportDomain {
  domain: string;
  raw: number | null;
  max: number | null;
  pendingReviewCount: number;
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
    finalizedAt: report.finalized_at ?? null,
    domains: normalizeExportDomains(report.domains),
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

export function formatMaybeDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toISOString().split('T')[0];
}

export function formatDomainSummary(domains: NormalizedExportDomain[]): string {
  if (domains.length === 0) return 'N/A';
  return domains
    .map((domain) => {
      const score = `${formatScore(domain.raw)}/${formatScore(domain.max)}`;
      const pending = domain.pendingReviewCount > 0 ? ` (${domain.pendingReviewCount} pending)` : '';
      return `${domain.domain}: ${score}${pending}`;
    })
    .join('; ');
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

function normalizeExportDomains(value: unknown): NormalizedExportDomain[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((domain) => normalizeExportDomain(domain))
    .filter((domain): domain is NormalizedExportDomain => !!domain);
}

function normalizeExportDomain(value: unknown): NormalizedExportDomain | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const domain = typeof row.domain === 'string' ? row.domain : null;
  if (!domain) return null;
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    domain,
    raw: numberOrNull(row.raw),
    max: numberOrNull(row.max),
    pendingReviewCount: items.filter((item) => isPendingReviewItem(item)).length,
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isPendingReviewItem(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as { needsReview?: unknown }).needsReview === true;
}
