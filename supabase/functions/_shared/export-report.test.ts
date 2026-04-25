import {
  escapeCsvField,
  getFinalizedExportBlockReason,
  normalizeExportReport,
} from './export-report.ts';

Deno.test('normalizeExportReport prefers modern scoring columns', () => {
  const report = normalizeExportReport({
    total_raw: 22,
    total_adjusted: 23,
    total_provisional: false,
    norm_percentile: 44,
    norm_sd: -0.6,
    pending_review_count: 0,
    total_score: 10,
    percentile: 12,
    needs_review: true,
  });

  if (!report) throw new Error('expected normalized report');
  if (report.totalRaw !== 22) throw new Error('expected modern raw score');
  if (report.totalAdjusted !== 23) throw new Error('expected modern adjusted score');
  if (report.normPercentile !== 44) throw new Error('expected modern percentile');
  if (report.totalProvisional !== false) throw new Error('expected finalized report');
  if (!report.isFinal) throw new Error('expected final report');
});

Deno.test('normalizeExportReport falls back to legacy compatibility columns', () => {
  const report = normalizeExportReport({
    total_score: 25,
    percentile: 61,
    needs_review: false,
  });

  if (!report) throw new Error('expected normalized report');
  if (report.totalRaw !== 25) throw new Error('expected legacy total fallback');
  if (report.totalAdjusted !== 25) throw new Error('expected legacy adjusted fallback');
  if (report.normPercentile !== 61) throw new Error('expected legacy percentile fallback');
  if (!report.isFinal) throw new Error('expected final legacy report');
});

Deno.test('getFinalizedExportBlockReason blocks provisional and unfinished sessions', () => {
  const pendingReason = getFinalizedExportBlockReason({ status: 'awaiting_review' }, {
    total_adjusted: 20,
    total_provisional: true,
    pending_review_count: 2,
  });
  if (pendingReason !== 'Session must be completed before export') {
    throw new Error(`unexpected pending reason: ${pendingReason}`);
  }

  const reviewReason = getFinalizedExportBlockReason({ status: 'completed' }, {
    total_adjusted: 20,
    total_provisional: true,
    pending_review_count: 1,
  });
  if (reviewReason !== 'Clinician review must be finalized before export') {
    throw new Error(`unexpected review reason: ${reviewReason}`);
  }
});

Deno.test('escapeCsvField handles spreadsheet injection and quoting', () => {
  const value = escapeCsvField('=SUM(1,2)');
  if (value !== '"\'=SUM(1,2)"') throw new Error(`unexpected escaped value: ${value}`);
});
