import type { AssessmentState } from '../app/store/assessmentPersistence';

export type LocalTaskName = keyof AssessmentState['tasks'];

export const TASK_TYPE_BY_LOCAL: Record<LocalTaskName, string> = {
  trailMaking: 'moca-visuospatial',
  cube: 'moca-cube',
  clock: 'moca-clock',
  naming: 'moca-naming',
  memory: 'moca-memory-learning',
  digitSpan: 'moca-digit-span',
  vigilance: 'moca-vigilance',
  serial7: 'moca-serial-7s',
  language: 'moca-language',
  abstraction: 'moca-abstraction',
  delayedRecall: 'moca-delayed-recall',
  orientation: 'moca-orientation-task',
};

export const DRAWING_TASKS = new Set<LocalTaskName>(['trailMaking', 'cube', 'clock']);

export const TASK_NAME_BY_PATIENT_PATH: Record<string, LocalTaskName> = {
  '/patient': 'trailMaking',
  '/patient/trail-making': 'trailMaking',
  '/patient/cube': 'cube',
  '/patient/clock': 'clock',
  '/patient/naming': 'naming',
  '/patient/memory': 'memory',
  '/patient/digit-span': 'digitSpan',
  '/patient/vigilance': 'vigilance',
  '/patient/serial7': 'serial7',
  '/patient/language': 'language',
  '/patient/abstraction': 'abstraction',
  '/patient/delayed-recall': 'delayedRecall',
  '/patient/orientation': 'orientation',
};

export function toCanonicalTaskPayload(taskName: LocalTaskName, data: any): unknown {
  if (data?.skipped === true) {
    return {
      skipped: true,
      requiresReview: true,
      reason: data.reason ?? 'patient_advanced_without_response',
      localTaskName: taskName,
    };
  }

  if (taskName === 'naming') {
    const answers = data?.answers ?? {};
    return [answers.lion ?? null, answers.rhino ?? null, answers.camel ?? null];
  }

  return data;
}

export function hasCapturedTaskData(taskName: LocalTaskName, data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const value = data as Record<string, any>;
  if (value.skipped === true) return true;

  if (DRAWING_TASKS.has(taskName)) return Array.isArray(value.strokes) && value.strokes.length > 0;
  if (taskName === 'naming') return Object.values(value.answers ?? {}).some(Boolean);
  if (taskName === 'vigilance') return typeof value.tapped === 'number' && value.tapped > 0;

  return Boolean(value.audioId);
}

export function skippedTaskPayload(taskName: LocalTaskName) {
  return {
    skipped: true,
    requiresReview: true,
    reason: 'patient_advanced_without_response',
    localTaskName: taskName,
    skippedAt: new Date().toISOString(),
  };
}
