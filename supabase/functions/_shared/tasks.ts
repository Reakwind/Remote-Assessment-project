export const TASK_TYPES = new Set([
  'moca-visuospatial',
  'moca-cube',
  'moca-clock',
  'moca-naming',
  'moca-memory-learning',
  'moca-digit-span',
  'moca-vigilance',
  'moca-serial-7s',
  'moca-language',
  'moca-abstraction',
  'moca-delayed-recall',
  'moca-orientation-task',
]);

export const DRAWING_TASKS = new Set(['moca-visuospatial', 'moca-cube', 'moca-clock']);

export const AUDIO_TASKS = new Set([
  'moca-memory-learning',
  'moca-digit-span',
  'moca-serial-7s',
  'moca-language',
  'moca-abstraction',
  'moca-delayed-recall',
  'moca-orientation-task',
]);

export const AUDIO_CONTENT_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
]);

const MAX_RAW_JSON_LENGTH = 100_000;

export function isCanonicalTaskType(taskType: string): boolean {
  return TASK_TYPES.has(taskType);
}

export function isAudioTask(taskType: string): boolean {
  return AUDIO_TASKS.has(taskType);
}

export function validateTaskPayload(taskType: string, rawData: unknown): string | null {
  if (!isCanonicalTaskType(taskType)) return 'Invalid taskType';

  const rawLength = JSON.stringify(rawData)?.length ?? 0;
  if (rawLength > MAX_RAW_JSON_LENGTH) return 'rawData is too large';
  if (isSkippedPayload(rawData)) return null;

  if (DRAWING_TASKS.has(taskType)) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return 'Drawing rawData must be an object';
    return null;
  }

  switch (taskType) {
    case 'moca-naming':
      if (Array.isArray(rawData) && rawData.length === 3) return null;
      if (hasThreeNamingAnswers(rawData)) return null;
      return 'Naming rawData must be an array of 3 answers or an answers object';
    case 'moca-memory-learning':
      return isObject(rawData) ? null : 'Memory rawData must be an object';
    case 'moca-digit-span':
    case 'moca-serial-7s':
      return Array.isArray(rawData) || isObject(rawData) ? null : 'Serial 7s rawData must be an array or object';
    case 'moca-language':
    case 'moca-abstraction':
    case 'moca-delayed-recall':
    case 'moca-orientation-task':
      return isObject(rawData) ? null : `${taskType} rawData must be an object`;
    case 'moca-vigilance':
      return isObject(rawData) ? null : 'Vigilance rawData must be an object';
    default:
      return null;
  }
}

export function normalizeAudioContentType(contentType?: string): string | null {
  const normalized = (contentType || 'audio/webm').split(';')[0].trim().toLowerCase();
  return AUDIO_CONTENT_TYPES.has(normalized) ? normalized : null;
}

export function audioExtension(contentType: string): string {
  if (contentType === 'audio/mp4') return 'mp4';
  if (contentType === 'audio/ogg') return 'ogg';
  if (contentType === 'audio/mpeg') return 'mp3';
  if (contentType === 'audio/wav' || contentType === 'audio/x-wav') return 'wav';
  return 'webm';
}

function isObject(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSkippedPayload(value: unknown): boolean {
  return isObject(value) && (value as { skipped?: unknown }).skipped === true;
}

function hasThreeNamingAnswers(value: unknown): boolean {
  if (!isObject(value) || !isObject((value as { answers?: unknown }).answers)) return false;
  const answers = (value as { answers: Record<string, unknown> }).answers;
  return ['lion', 'rhino', 'camel'].every((key) => typeof answers[key] === 'string');
}
