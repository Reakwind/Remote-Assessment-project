import type { ScoringContext } from '../../types/scoring';

export interface AssessmentState {
  id: string | null;
  linkToken: string | null;
  scoringContext: ScoringContext | null;
  lastPath: string;
  isComplete: boolean;
  tasks: {
    trailMaking?: any;
    cube?: any;
    clock?: any;
    naming?: any;
    memory?: any;
    digitSpan?: any;
    vigilance?: any;
    serial7?: any;
    language?: any;
    abstraction?: any;
    delayedRecall?: any;
    orientation?: any;
  };
}

export const ASSESSMENT_STORAGE_KEY = 'moca_assessment_state';

export const DEFAULT_ASSESSMENT_STATE: AssessmentState = {
  id: null,
  linkToken: null,
  scoringContext: null,
  lastPath: '/patient/welcome',
  isComplete: false,
  tasks: {},
};

export function readAssessmentState(storage: Storage = localStorage): AssessmentState {
  try {
    const saved = storage.getItem(ASSESSMENT_STORAGE_KEY);
    if (!saved) return DEFAULT_ASSESSMENT_STATE;
    return normalizeAssessmentState(JSON.parse(saved));
  } catch (error) {
    console.error('Failed to load assessment state from local storage', error);
    return DEFAULT_ASSESSMENT_STATE;
  }
}

export function writeAssessmentState(state: AssessmentState, storage: Storage = localStorage): void {
  storage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(state));
}

export function getResumeStateForToken(token: string, storage: Storage = localStorage): AssessmentState | null {
  const state = readAssessmentState(storage);
  if (!state.id || state.isComplete || state.linkToken !== token || !state.scoringContext) return null;
  return state;
}

function normalizeAssessmentState(value: unknown): AssessmentState {
  if (!value || typeof value !== 'object') return DEFAULT_ASSESSMENT_STATE;

  const candidate = value as Partial<AssessmentState>;
  return {
    id: typeof candidate.id === 'string' ? candidate.id : null,
    linkToken: typeof candidate.linkToken === 'string' ? candidate.linkToken : null,
    scoringContext: normalizeScoringContext(candidate.scoringContext),
    lastPath: typeof candidate.lastPath === 'string' ? candidate.lastPath : DEFAULT_ASSESSMENT_STATE.lastPath,
    isComplete: candidate.isComplete === true,
    tasks: candidate.tasks && typeof candidate.tasks === 'object' ? candidate.tasks : {},
  };
}

function normalizeScoringContext(value: unknown): ScoringContext | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<ScoringContext> & { sessionDate?: unknown };
  if (
    typeof candidate.sessionId !== 'string' ||
    typeof candidate.educationYears !== 'number' ||
    typeof candidate.patientAge !== 'number'
  ) {
    return null;
  }

  return {
    sessionId: candidate.sessionId,
    sessionDate: new Date(typeof candidate.sessionDate === 'string' || candidate.sessionDate instanceof Date ? candidate.sessionDate : Date.now()),
    mocaVersion: isMocaVersion(candidate.mocaVersion) ? candidate.mocaVersion : undefined,
    educationYears: candidate.educationYears,
    patientAge: candidate.patientAge,
    sessionLocation: normalizeLocation(candidate.sessionLocation),
  };
}

function isMocaVersion(value: unknown): value is NonNullable<ScoringContext['mocaVersion']> {
  return value === '8.1' || value === '8.2' || value === '8.3';
}

function normalizeLocation(value: unknown): ScoringContext['sessionLocation'] {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<NonNullable<ScoringContext['sessionLocation']>>;
  return {
    place: typeof candidate.place === 'string' ? candidate.place : '',
    city: typeof candidate.city === 'string' ? candidate.city : '',
  };
}
