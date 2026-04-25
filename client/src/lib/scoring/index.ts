import type { ScoringReport, ScoringContext, ItemScore, DomainScore } from '../../types/scoring';
import { safeScore } from './utils';
import {
  scoreOrientation, scoreDigitSpan, scoreVigilance,
  scoreSerial7s, scoreLanguage, scoreAbstraction,
  scoreDelayedRecall, scoreNaming, scoreDrawing,
} from './scorers';
import { lookupNorm, computePercentile } from './norms';
import config from '../../data/scoring-config.json' with { type: 'json' };
import normsData from '../../data/lifshitz-norms.json' with { type: 'json' };

function isSkippedPayload(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (value as { skipped?: unknown }).skipped === true;
}

function maxForTask(taskId: string): number {
  return config.domains.flatMap(d => d.tasks).find(t => t.taskId === taskId)?.max ?? 0;
}

function scoreTask(taskId: string, rawData: unknown, ctx: ScoringContext): ItemScore[] {
  if ((config.drawingTasks as string[]).includes(taskId)) {
    return scoreDrawing(taskId, maxForTask(taskId) || 1);
  }
  if (isSkippedPayload(rawData)) {
    return [{ taskId, score: 0, max: maxForTask(taskId), needsReview: true, reviewReason: 'rule_score_unavailable', rawData }];
  }
  if ((config.noScoreTasks as string[]).includes(taskId)) return [];

  const loc = ctx.sessionLocation ?? { place: '', city: '' };

  switch (taskId) {
    case 'moca-orientation-task':
      return safeScore(taskId, rawData, d =>
        scoreOrientation(d as Parameters<typeof scoreOrientation>[0], ctx.sessionDate, loc)
      );
    case 'moca-digit-span':
      return safeScore(taskId, rawData, d =>
        scoreDigitSpan(d as Parameters<typeof scoreDigitSpan>[0])
      );
    case 'moca-vigilance':
      return safeScore(taskId, rawData, d =>
        scoreVigilance(d as Parameters<typeof scoreVigilance>[0])
      );
    case 'moca-serial-7s':
      return safeScore(taskId, rawData, d =>
        scoreSerial7s(d as Parameters<typeof scoreSerial7s>[0]), 3
      );
    case 'moca-language':
      return safeScore(taskId, rawData, d =>
        scoreLanguage(d as Parameters<typeof scoreLanguage>[0])
      );
    case 'moca-abstraction':
      return safeScore(taskId, rawData, d =>
        scoreAbstraction(d as Parameters<typeof scoreAbstraction>[0])
      );
    case 'moca-delayed-recall':
      return safeScore(taskId, rawData, d =>
        scoreDelayedRecall(d as Parameters<typeof scoreDelayedRecall>[0], config.targetWords)
      );
    case 'moca-naming':
      return safeScore(taskId, rawData, d =>
        scoreNaming(d as Parameters<typeof scoreNaming>[0], config.correctAnimalNames)
      );
    default:
      return [];
  }
}

export function scoreSession(
  results: Record<string, unknown>,
  ctx: ScoringContext
): ScoringReport {
  const domains: DomainScore[] = config.domains.map(domainCfg => {
    const items = domainCfg.tasks.flatMap(t =>
      scoreTask(t.taskId, results[t.taskId], ctx)
    );
    return {
      domain: domainCfg.id,
      raw: items.filter(i => !i.needsReview).reduce((s, i) => s + i.score, 0),
      max: domainCfg.tasks.reduce((s, t) => s + t.max, 0),
      items,
    };
  });

  const allItems = domains.flatMap(d => d.items);
  const pendingReviewCount = allItems.filter(i => i.needsReview).length;
  const totalRaw = allItems.filter(i => !i.needsReview).reduce((s, i) => s + i.score, 0);
  const totalProvisional = pendingReviewCount > 0;

  const educationCorrection = ctx.educationYears <= config.educationCorrectionThreshold ? 1 : 0;
  const totalAdjusted = Math.min(30, totalRaw + educationCorrection);

  const normPercentile = totalProvisional ? null : (() => {
    const norm = lookupNorm(normsData.norms, ctx.patientAge, ctx.educationYears);
    return norm ? computePercentile(totalAdjusted, norm) : null;
  })();

  const normSd = totalProvisional ? null : (() => {
    const norm = lookupNorm(normsData.norms, ctx.patientAge, ctx.educationYears);
    return norm ? parseFloat(((totalAdjusted - norm.mean) / norm.sd).toFixed(2)) : null;
  })();

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
