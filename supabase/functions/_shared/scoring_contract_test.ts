import { scoreSession, type ScoringContext, type ScoringReport } from './scoring.ts';

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

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertObjectContains(actual: unknown, expected: Record<string, unknown>, label: string) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    throw new Error(`${label}: expected object, got ${JSON.stringify(actual)}`);
  }

  const actualRecord = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    assertEquals(actualRecord[key], value, `${label}.${key}`);
  }
}

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

const fixture = JSON.parse(
  await Deno.readTextFile(
    new URL('../../../client/src/lib/scoring/__fixtures__/scoring-contract-cases.json', import.meta.url),
  ),
) as { cases: ContractCase[] };

for (const testCase of fixture.cases) {
  Deno.test(`server scoring contract: ${testCase.name}`, () => {
    const report = scoreSession(testCase.results, contextFromFixture(testCase.context));
    assertEquals(summary(report), testCase.expected.summary, `${testCase.name}.summary`);

    const domains = new Map(report.domains.map((domain) => [domain.domain, domain]));
    for (const [domainId, expectedDomain] of Object.entries(testCase.expected.domains)) {
      assertObjectContains(domains.get(domainId), expectedDomain, `${testCase.name}.${domainId}`);
    }

    const items = new Map(report.domains.flatMap((domain) => domain.items).map((item) => [item.taskId, item]));
    for (const [itemId, expectedItem] of Object.entries(testCase.expected.items)) {
      assertObjectContains(items.get(itemId), expectedItem, `${testCase.name}.${itemId}`);
    }
  });
}
