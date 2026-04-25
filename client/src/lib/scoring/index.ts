import type { ScoringReport, ScoringContext, ItemScore, DomainScore } from '../../types/scoring';
import { safeScore } from './utils';
import {
  scoreOrientation, scoreDigitSpan, scoreVigilance,
  scoreSerial7s, scoreLanguage, scoreAbstraction,
  scoreDelayedRecall, scoreNaming, scoreDrawing,
} from './scorers';
import { lookupNorm, computePercentile } from './norms';
import { getMocaVersionConfig, type MocaScoringConfig } from './moca-config';
import normsData from '../../data/lifshitz-norms.json' with { type: 'json' };

function namingAnswers(rawData: unknown): (string | null)[] {
  if (Array.isArray(rawData)) return rawData as (string | null)[];
  if (!rawData || typeof rawData !== 'object') throw new Error('Invalid naming');
  const answers = (rawData as { answers?: unknown }).answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Invalid naming');
  return ['lion', 'rhino', 'camel'].map((key) => {
    const answer = (answers as Record<string, unknown>)[key];
    if (typeof answer !== 'string') throw new Error('Invalid naming');
    return answer;
  });
}

function scoreTask(taskId: string, rawData: unknown, ctx: ScoringContext, config: MocaScoringConfig): ItemScore[] {
  // Assessment context is persisted in localStorage; on resume, sessionDate can
  // come back as an ISO string. Coerce it so orientation scoring stays correct.
  const sessionDate = new Date((ctx as unknown as { sessionDate: Date | string }).sessionDate);
  if ((config.drawingTasks as string[]).includes(taskId)) {
    const domainTask = config.domains.flatMap(d => d.tasks).find(t => t.taskId === taskId);
    return scoreDrawing(taskId, domainTask?.max ?? 1);
  }
  if ((config.noScoreTasks as string[]).includes(taskId)) return [];

  const loc = ctx.sessionLocation ?? { place: '', city: '' };

  switch (taskId) {
    case 'moca-orientation-task':
      return safeScore(taskId, rawData, d =>
        scoreOrientation(d as Parameters<typeof scoreOrientation>[0], sessionDate, loc)
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
        scoreLanguage(d as Parameters<typeof scoreLanguage>[0], config.fluencyThreshold)
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
        scoreNaming(namingAnswers(d), config.correctAnimalNames)
      );
    default:
      return [];
  }
}

export function scoreSession(
  results: Record<string, unknown>,
  ctx: ScoringContext
): ScoringReport {
  return scoreSessionWithConfig(results, ctx, getMocaVersionConfig(ctx.mocaVersion));
}

export function scoreSessionWithConfig(
  results: Record<string, unknown>,
  ctx: ScoringContext,
  config: MocaScoringConfig,
): ScoringReport {
  const domains: DomainScore[] = config.domains.map(domainCfg => {
    const items = domainCfg.tasks.flatMap(t =>
      scoreTask(t.taskId, results[t.taskId], ctx, config)
    );
    return {
      domain: domainCfg.id,
      raw: items.filter(i => !i.needsReview).reduce((s, i) => s + i.score, 0),
      max: domainCfg.tasks.reduce((s, t) => s + (t.max ?? 0), 0),
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
