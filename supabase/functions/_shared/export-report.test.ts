import {
  escapeCsvField,
  formatDeviceContextScreen,
  formatDeviceContextSummary,
  formatDeviceContextUserAgent,
  formatDeviceContextViewport,
  formatDomainSummary,
  formatMaybeDate,
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
    finalized_at: '2026-04-25T10:20:30.000Z',
    domains: [
      {
        domain: 'attention',
        raw: 5,
        max: 6,
        items: [
          { taskId: 'moca-digit-span', needsReview: false },
          { taskId: 'moca-serial-7s', needsReview: false },
        ],
      },
    ],
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
  if (report.finalizedAt !== '2026-04-25T10:20:30.000Z') throw new Error('expected finalized timestamp');
  if (report.domains[0]?.domain !== 'attention') throw new Error('expected domain summary');
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

Deno.test('formatDomainSummary includes scores and pending counts', () => {
  const report = normalizeExportReport({
    total_raw: 18,
    total_adjusted: 19,
    total_provisional: true,
    pending_review_count: 1,
    domains: [
      {
        domain: 'visuospatial',
        raw: 2,
        max: 5,
        items: [
          { taskId: 'moca-cube', needsReview: true },
          { taskId: 'moca-clock', needsReview: false },
        ],
      },
      { domain: 'naming', raw: 3, max: 3, items: [] },
    ],
  });

  const summary = formatDomainSummary(report?.domains ?? []);
  if (summary !== 'visuospatial: 2/5 (1 pending); naming: 3/3') {
    throw new Error(`unexpected domain summary: ${summary}`);
  }
});

Deno.test('formatMaybeDate returns stable ISO date or N/A', () => {
  if (formatMaybeDate('2026-04-25T23:59:00.000Z') !== '2026-04-25') {
    throw new Error('expected ISO date');
  }
  if (formatMaybeDate('not-a-date') !== 'N/A') throw new Error('expected invalid dates to be hidden');
  if (formatMaybeDate(null) !== 'N/A') throw new Error('expected null date fallback');
});

Deno.test('device context export helpers format concise patient device details', () => {
  const context = {
    platform: 'iPad',
    viewportWidth: 768,
    viewportHeight: 1024,
    screenWidth: 820,
    screenHeight: 1180,
    touchPoints: 5,
    standalone: true,
    pointer: 'coarse',
    userAgent: 'Mobile Safari',
  };

  if (formatDeviceContextSummary(context) !== 'PWA installed; iPad; Pointer coarse; 5 touch points') {
    throw new Error(`unexpected summary: ${formatDeviceContextSummary(context)}`);
  }
  if (formatDeviceContextViewport(context) !== '768x1024') throw new Error('expected viewport dimensions');
  if (formatDeviceContextScreen(context) !== '820x1180') throw new Error('expected screen dimensions');
  if (formatDeviceContextUserAgent(context) !== 'Mobile Safari') throw new Error('expected user agent');
  if (formatDeviceContextSummary(null) !== 'N/A') throw new Error('expected empty context fallback');
});
