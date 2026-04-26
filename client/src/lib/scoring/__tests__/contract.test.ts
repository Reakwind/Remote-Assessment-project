import { describe, expect, it } from 'vitest';
import { scoreSession } from '../index';
import fixtureData from '../__fixtures__/scoring-contract-cases.json' with { type: 'json' };
import type { ScoringContext, ScoringReport } from '../../../types/scoring';

interface ExpectedSummary {
  mocaVersion: string;
  totalRaw: number;
  totalAdjusted: number;
  totalProvisional: boolean;
  pendingReviewCount: number;
  educationYears: number;
  normPercentile: number | null;
  normSd: number | null;
}

interface ContractCase {
  name: string;
  context: Omit<ScoringContext, 'sessionDate'> & { sessionDate: string };
  results: Record<string, unknown>;
  expected: {
    summary: ExpectedSummary;
    domains: Record<string, { raw: number; max: number }>;
    items: Record<string, { score: number; max: number; needsReview: boolean; reviewReason?: string }>;
  };
}

const fixture = fixtureData as unknown as { cases: ContractCase[] };

function contextFromFixture(context: ContractCase['context']): ScoringContext {
  return {
    ...context,
    sessionDate: new Date(context.sessionDate),
  };
}

function summary(report: ScoringReport): ExpectedSummary {
  return {
    mocaVersion: report.mocaVersion,
    totalRaw: report.totalRaw,
    totalAdjusted: report.totalAdjusted,
    totalProvisional: report.totalProvisional,
    pendingReviewCount: report.pendingReviewCount,
    educationYears: report.educationYears,
    normPercentile: report.normPercentile,
    normSd: report.normSd,
  };
}

describe('client scoring contract', () => {
  it.each(fixture.cases)('matches shared scoring fixture: $name', (testCase) => {
    const report = scoreSession(testCase.results, contextFromFixture(testCase.context));
    expect(summary(report)).toEqual(testCase.expected.summary);

    const domains = new Map(report.domains.map((domain) => [domain.domain, domain]));
    for (const [domainId, expectedDomain] of Object.entries(testCase.expected.domains)) {
      expect(domains.get(domainId), `${testCase.name}:${domainId}`).toEqual(
        expect.objectContaining(expectedDomain),
      );
    }

    const items = new Map(report.domains.flatMap((domain) => domain.items).map((item) => [item.taskId, item]));
    for (const [itemId, expectedItem] of Object.entries(testCase.expected.items)) {
      expect(items.get(itemId), `${testCase.name}:${itemId}`).toEqual(expect.objectContaining(expectedItem));
    }
  });
});
