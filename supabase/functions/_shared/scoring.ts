import { getMocaVersionConfig, type MocaScoringConfig } from './moca-config.ts';

export interface ItemScore {
  taskId: string;
  score: number;
  max: number;
  needsReview: boolean;
  reviewReason?: 'drawing' | 'rule_score_unavailable';
  rawData?: unknown;
}

export interface DomainScore {
  domain: string;
  raw: number;
  max: number;
  items: ItemScore[];
}

export interface ScoringContext {
  sessionId: string;
  sessionDate: Date;
  educationYears: number;
  patientAge: number;
  mocaVersion?: string;
  sessionLocation?: { place?: string | null; city?: string | null };
}

export interface ScoringReport {
  sessionId: string;
  mocaVersion: string;
  totalRaw: number;
  totalAdjusted: number;
  totalProvisional: boolean;
  educationYears: number;
  normPercentile: number | null;
  normSd: number | null;
  domains: DomainScore[];
  pendingReviewCount: number;
  completedAt: string;
}

const NORMS = [
  { ageMin: 60, ageMax: 69, educationLow: { mean: 22.8, sd: 3.9 }, educationHigh: { mean: 25.6, sd: 3.1 } },
  { ageMin: 70, ageMax: 79, educationLow: { mean: 21.4, sd: 4.2 }, educationHigh: { mean: 24.3, sd: 3.5 } },
  { ageMin: 80, ageMax: 99, educationLow: { mean: 19.6, sd: 4.5 }, educationHigh: { mean: 22.8, sd: 3.9 } },
];

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HE_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const NIQQUD_REGEX = /[֑-ׇ]/g;

function normalizeHebrew(text: string): string {
  return text.replace(NIQQUD_REGEX, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function item(taskId: string, score: number, max: number): ItemScore {
  if (!Number.isFinite(score)) throw new Error(`Invalid score for ${taskId}`);
  return { taskId, score, max, needsReview: false };
}

function reviewItem(taskId: string, max: number, rawData?: unknown): ItemScore {
  return { taskId, score: 0, max, needsReview: true, reviewReason: 'rule_score_unavailable', rawData };
}

function assertObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, any>;
}

function isSkippedPayload(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (value as { skipped?: unknown }).skipped === true;
}

function safeScore(taskId: string, rawData: unknown, max: number, scorer: (data: unknown) => ItemScore[]): ItemScore[] {
  try {
    return scorer(rawData);
  } catch {
    return [{ taskId, score: 0, max, needsReview: true, reviewReason: 'rule_score_unavailable', rawData }];
  }
}

function matches(userInput: unknown, expected: string): boolean {
  if (typeof userInput !== 'string') throw new Error('Expected text');
  return normalizeHebrew(userInput) === normalizeHebrew(expected);
}

function namingAnswers(rawData: unknown): unknown[] {
  if (Array.isArray(rawData)) return rawData;
  const data = assertObject(rawData);
  const answers = data.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Invalid naming');
  const answerRecord = answers as Record<string, unknown>;
  const keys = ['item-1', 'item-2', 'item-3'].every((key) => typeof answerRecord[key] === 'string')
    ? ['item-1', 'item-2', 'item-3']
    : ['lion', 'rhino', 'camel'];
  return keys.map((key) => {
    const answer = answerRecord[key];
    if (typeof answer !== 'string') throw new Error('Invalid naming');
    return answer;
  });
}

function scoreTask(taskId: string, rawData: unknown, ctx: ScoringContext, max: number, config: MocaScoringConfig): ItemScore[] {
  if (config.drawingTasks.includes(taskId)) {
    return [{ taskId, score: 0, max, needsReview: true, reviewReason: 'drawing' }];
  }
  if (isSkippedPayload(rawData)) {
    return [{ taskId, score: 0, max, needsReview: true, reviewReason: 'rule_score_unavailable', rawData }];
  }
  if (config.noScoreTasks.includes(taskId)) return [];

  switch (taskId) {
    case 'moca-orientation-task':
      return safeScore(taskId, rawData, max, data => {
        const d = assertObject(data);
        const expectedPlace = ctx.sessionLocation?.place?.trim();
        const expectedCity = ctx.sessionLocation?.city?.trim();
        return [
          item('orientation.date', matches(d.date, String(ctx.sessionDate.getDate())) ? 1 : 0, 1),
          item('orientation.month', matches(d.month, HE_MONTHS[ctx.sessionDate.getMonth()]) ? 1 : 0, 1),
          item('orientation.year', matches(d.year, String(ctx.sessionDate.getFullYear())) ? 1 : 0, 1),
          item('orientation.day', matches(d.day, HE_DAYS[ctx.sessionDate.getDay()]) ? 1 : 0, 1),
          expectedPlace ? item('orientation.place', matches(d.place, expectedPlace) ? 1 : 0, 1) : reviewItem('orientation.place', 1, d.place),
          expectedCity ? item('orientation.city', matches(d.city, expectedCity) ? 1 : 0, 1) : reviewItem('orientation.city', 1, d.city),
        ];
      });
    case 'moca-digit-span':
      return safeScore(taskId, rawData, max, data => {
        const d = assertObject(data);
        if (typeof d.forward?.isCorrect !== 'boolean' || typeof d.backward?.isCorrect !== 'boolean') throw new Error('Invalid digit span');
        return [item('digit-span.forward', d.forward.isCorrect ? 1 : 0, 1), item('digit-span.backward', d.backward.isCorrect ? 1 : 0, 1)];
      });
    case 'moca-vigilance':
      return safeScore(taskId, rawData, max, data => {
        const d = assertObject(data);
        if (typeof d.score === 'number') {
          const score = Math.max(0, Math.min(1, d.score));
          return score === 1 ? [item(taskId, score, 1)] : [reviewItem(taskId, 1, d)];
        }
        if (typeof d.tapped !== 'number' || typeof d.targetCount !== 'number') throw new Error('Invalid vigilance');
        const score = d.tapped >= d.targetCount - 1 && d.tapped <= d.targetCount + 1 ? 1 : 0;
        return score === 1 ? [item(taskId, score, 1)] : [reviewItem(taskId, 1, d)];
      });
    case 'moca-serial-7s':
      return safeScore(taskId, rawData, max, data => {
        if (!Array.isArray(data)) throw new Error('Invalid serial 7s');
        const correct = data.filter(s => s?.isCorrect === true).length;
        return [item(taskId, correct >= 4 ? 3 : correct >= 2 ? 2 : correct >= 1 ? 1 : 0, 3)];
      });
    case 'moca-language':
      return safeScore(taskId, rawData, max, data => {
        const d = assertObject(data);
        if (typeof d.rep1 !== 'boolean' || typeof d.rep2 !== 'boolean' || typeof d.fluencyCount !== 'number') throw new Error('Invalid language');
        return [item('language.rep1', d.rep1 ? 1 : 0, 1), item('language.rep2', d.rep2 ? 1 : 0, 1), item('language.fluency', d.fluencyCount >= config.fluencyThreshold ? 1 : 0, 1)];
      });
    case 'moca-abstraction':
      return safeScore(taskId, rawData, max, data => {
        const d = assertObject(data);
        if (typeof d.pair1 !== 'boolean' || typeof d.pair2 !== 'boolean') throw new Error('Invalid abstraction');
        return [item('abstraction.pair1', d.pair1 ? 1 : 0, 1), item('abstraction.pair2', d.pair2 ? 1 : 0, 1)];
      });
    case 'moca-delayed-recall':
      return safeScore(taskId, rawData, max, data => {
        const d = assertObject(data);
        if (!Array.isArray(d.recalled)) throw new Error('Invalid recall');
        const recalled = d.recalled.map((word: unknown) => typeof word === 'string' ? normalizeHebrew(word) : '');
        return config.targetWords.map((word, i) => item(`recall.word${i + 1}`, recalled.includes(normalizeHebrew(word)) ? 1 : 0, 1));
      });
    case 'moca-naming':
      return safeScore(taskId, rawData, max, data => {
        const answers = namingAnswers(data);
        return config.correctAnimalNames.map((correct, i) => {
          const answer = answers[i];
          return item(`naming.item${i + 1}`, typeof answer === 'string' && normalizeHebrew(answer) === normalizeHebrew(correct) ? 1 : 0, 1);
        });
      });
    default:
      return [];
  }
}

function lookupNorm(age: number, educationYears: number) {
  const band = NORMS.find(n => age >= n.ageMin && age <= n.ageMax);
  if (!band) return null;
  return educationYears <= 12 ? band.educationLow : band.educationHigh;
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
  return z >= 0 ? 1 - p : p;
}

export function scoreSession(results: Record<string, unknown>, ctx: ScoringContext): ScoringReport {
  const config = getMocaVersionConfig(ctx.mocaVersion);
  const domains = config.domains.map(domainCfg => {
    const items = domainCfg.tasks.flatMap(task => scoreTask(task.taskId, results[task.taskId], ctx, task.max ?? 1, config));
    return {
      domain: domainCfg.id,
      raw: items.filter(i => !i.needsReview).reduce((sum, i) => sum + i.score, 0),
      max: domainCfg.tasks.reduce((sum, task) => sum + (task.max ?? 0), 0),
      items,
    };
  });

  const allItems = domains.flatMap(d => d.items);
  const pendingReviewCount = allItems.filter(i => i.needsReview).length;
  const totalRaw = allItems.filter(i => !i.needsReview).reduce((sum, i) => sum + i.score, 0);
  const totalProvisional = pendingReviewCount > 0;
  const totalAdjusted = totalRaw;
  const norm = totalProvisional ? null : lookupNorm(ctx.patientAge, ctx.educationYears);
  const normSd = norm ? Number(((totalAdjusted - norm.mean) / norm.sd).toFixed(2)) : null;
  const normPercentile = norm && normSd !== null ? Math.min(100, Math.max(0, Math.round(normalCdf(normSd) * 100))) : null;

  return {
    sessionId: ctx.sessionId,
    mocaVersion: config.version,
    totalRaw,
    totalAdjusted,
    totalProvisional,
    educationYears: ctx.educationYears,
    normPercentile,
    normSd,
    domains,
    pendingReviewCount,
    completedAt: new Date().toISOString(),
  };
}

export function ageFromBand(ageBand: string): number {
  if (ageBand === '60-64') return 62;
  if (ageBand === '65-69') return 67;
  if (ageBand === '70-74') return 72;
  if (ageBand === '75-79') return 77;
  if (ageBand === '60-69') return 65;
  if (ageBand === '70-79') return 75;
  return 85;
}

export function applyManualScores(report: ScoringReport, ctx: ScoringContext, manualScores: Record<string, number>): ScoringReport {
  const domains = report.domains.map(domain => {
    const items = domain.items.map(itemScore => {
      if (!(itemScore.taskId in manualScores)) return itemScore;
      return {
        ...itemScore,
        score: Math.max(0, Math.min(itemScore.max, manualScores[itemScore.taskId])),
        needsReview: false,
        reviewReason: undefined,
      };
    });

    return {
      ...domain,
      raw: items.filter(itemScore => !itemScore.needsReview).reduce((sum, itemScore) => sum + itemScore.score, 0),
      items,
    };
  });

  const allItems = domains.flatMap(domain => domain.items);
  const pendingReviewCount = allItems.filter(itemScore => itemScore.needsReview).length;
  const totalRaw = allItems.filter(itemScore => !itemScore.needsReview).reduce((sum, itemScore) => sum + itemScore.score, 0);
  const totalProvisional = pendingReviewCount > 0;
  const totalAdjusted = totalRaw;
  const norm = totalProvisional ? null : lookupNorm(ctx.patientAge, ctx.educationYears);
  const normSd = norm ? Number(((totalAdjusted - norm.mean) / norm.sd).toFixed(2)) : null;
  const normPercentile = norm && normSd !== null ? Math.min(100, Math.max(0, Math.round(normalCdf(normSd) * 100))) : null;

  return {
    ...report,
    totalRaw,
    totalAdjusted,
    totalProvisional,
    normPercentile,
    normSd,
    domains,
    pendingReviewCount,
  };
}
