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
  sessionLocation?: { place: string; city: string };
}

export interface ScoringReport {
  sessionId: string;
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

const CONFIG = {
  domains: [
    { id: 'visuospatial', tasks: [{ taskId: 'moca-visuospatial', max: 1 }, { taskId: 'moca-cube', max: 1 }, { taskId: 'moca-clock', max: 3 }] },
    { id: 'naming', tasks: [{ taskId: 'moca-naming', max: 3 }] },
    { id: 'attention', tasks: [{ taskId: 'moca-digit-span', max: 2 }, { taskId: 'moca-vigilance', max: 1 }, { taskId: 'moca-serial-7s', max: 3 }] },
    { id: 'language', tasks: [{ taskId: 'moca-language', max: 3 }] },
    { id: 'abstraction', tasks: [{ taskId: 'moca-abstraction', max: 2 }] },
    { id: 'memory', tasks: [{ taskId: 'moca-delayed-recall', max: 5 }] },
    { id: 'orientation', tasks: [{ taskId: 'moca-orientation-task', max: 6 }] },
  ],
  drawingTasks: ['moca-visuospatial', 'moca-cube', 'moca-clock'],
  noScoreTasks: ['moca-memory-learning'],
  targetWords: ['פנס', 'חסידה', 'ורד', 'ירח', 'אמת'],
  correctAnimalNames: ['אריה', 'קרנף', 'גמל'],
  educationCorrectionThreshold: 12,
};

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

function scoreTask(taskId: string, rawData: unknown, ctx: ScoringContext, max: number): ItemScore[] {
  if (CONFIG.drawingTasks.includes(taskId)) {
    return [{ taskId, score: 0, max, needsReview: true, reviewReason: 'drawing' }];
  }
  if (isSkippedPayload(rawData)) {
    return [{ taskId, score: 0, max, needsReview: true, reviewReason: 'rule_score_unavailable', rawData }];
  }
  if (CONFIG.noScoreTasks.includes(taskId)) return [];

  switch (taskId) {
    case 'moca-orientation-task':
      return safeScore(taskId, rawData, max, data => {
        const d = assertObject(data);
        const loc = ctx.sessionLocation ?? { place: '', city: '' };
        return [
          item('orientation.date', matches(d.date, String(ctx.sessionDate.getDate())) ? 1 : 0, 1),
          item('orientation.month', matches(d.month, HE_MONTHS[ctx.sessionDate.getMonth()]) ? 1 : 0, 1),
          item('orientation.year', matches(d.year, String(ctx.sessionDate.getFullYear())) ? 1 : 0, 1),
          item('orientation.day', matches(d.day, HE_DAYS[ctx.sessionDate.getDay()]) ? 1 : 0, 1),
          item('orientation.place', matches(d.place, loc.place) ? 1 : 0, 1),
          item('orientation.city', matches(d.city, loc.city) ? 1 : 0, 1),
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
        if (typeof d.score !== 'number') throw new Error('Invalid vigilance');
        return [item(taskId, Math.max(0, Math.min(1, d.score)), 1)];
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
        return [item('language.rep1', d.rep1 ? 1 : 0, 1), item('language.rep2', d.rep2 ? 1 : 0, 1), item('language.fluency', d.fluencyCount >= 11 ? 1 : 0, 1)];
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
        return CONFIG.targetWords.map((word, i) => item(`recall.word${i + 1}`, recalled.includes(normalizeHebrew(word)) ? 1 : 0, 1));
      });
    case 'moca-naming':
      return safeScore(taskId, rawData, max, data => {
        if (!Array.isArray(data)) throw new Error('Invalid naming');
        return CONFIG.correctAnimalNames.map((correct, i) => {
          const answer = data[i];
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
  const domains = CONFIG.domains.map(domainCfg => {
    const items = domainCfg.tasks.flatMap(task => scoreTask(task.taskId, results[task.taskId], ctx, task.max));
    return {
      domain: domainCfg.id,
      raw: items.filter(i => !i.needsReview).reduce((sum, i) => sum + i.score, 0),
      max: domainCfg.tasks.reduce((sum, task) => sum + task.max, 0),
      items,
    };
  });

  const allItems = domains.flatMap(d => d.items);
  const pendingReviewCount = allItems.filter(i => i.needsReview).length;
  const totalRaw = allItems.filter(i => !i.needsReview).reduce((sum, i) => sum + i.score, 0);
  const totalProvisional = pendingReviewCount > 0;
  const totalAdjusted = Math.min(30, totalRaw + (ctx.educationYears <= CONFIG.educationCorrectionThreshold ? 1 : 0));
  const norm = totalProvisional ? null : lookupNorm(ctx.patientAge, ctx.educationYears);
  const normSd = norm ? Number(((totalAdjusted - norm.mean) / norm.sd).toFixed(2)) : null;
  const normPercentile = norm && normSd !== null ? Math.min(100, Math.max(0, Math.round(normalCdf(normSd) * 100))) : null;

  return {
    sessionId: ctx.sessionId,
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
  const totalAdjusted = Math.min(30, totalRaw + (ctx.educationYears <= CONFIG.educationCorrectionThreshold ? 1 : 0));
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
