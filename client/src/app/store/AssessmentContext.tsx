/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ScoringContext } from '../../types/scoring';
import { edgeFn, edgeHeaders } from '../../lib/supabase';
import { scoreSession } from '../../lib/scoring';

// Maps the in-memory task state keys to the moca-prefixed taskIds that the
// scoring engine expects. Drawing/visuospatial lives under three different
// keys in state but aggregates into moca-visuospatial / cube / clock.
const TASK_STATE_TO_SCORING_ID: Record<string, string> = {
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

// Define the shape of our assessment data
export interface AssessmentState {
  id: string | null;
  linkToken: string | null;
  startToken: string | null;
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

export interface TaskSaveStatus {
  status: 'saving' | 'saved' | 'error';
  message?: string;
}

const DEFAULT_STATE: AssessmentState = {
  id: null,
  linkToken: null,
  startToken: null,
  scoringContext: null,
  lastPath: '/patient/welcome',
  isComplete: false,
  tasks: {},
};

const STORAGE_KEY = 'moca_assessment_state';
const PATIENT_ONBOARDING_KEY = 'moca_patient_onboarding_completed';

export function hasCompletedPatientOnboarding(): boolean {
  try {
    return localStorage.getItem(PATIENT_ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markPatientOnboardingComplete(): void {
  try {
    localStorage.setItem(PATIENT_ONBOARDING_KEY, 'true');
  } catch {
    // If storage is unavailable, keep the current session flow working.
  }
}

export function getAssessmentResumePath(path: string | null | undefined) {
  return path?.startsWith('/patient') ? path : '/patient/welcome';
}

function normalizeStoredAssessmentState(value: unknown): AssessmentState {
  if (!value || typeof value !== 'object') return DEFAULT_STATE;

  const candidate = value as Partial<AssessmentState>;
  const tasks = candidate.tasks && typeof candidate.tasks === 'object' ? candidate.tasks : {};
  const lastPath = getAssessmentResumePath(candidate.lastPath);

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.linkToken !== 'string' ||
    !candidate.scoringContext ||
    typeof candidate.scoringContext !== 'object'
  ) {
    return {
      ...DEFAULT_STATE,
      tasks,
      lastPath,
      isComplete: Boolean(candidate.isComplete),
    };
  }

  return {
    ...DEFAULT_STATE,
    ...candidate,
    id: candidate.id,
    linkToken: candidate.linkToken,
    startToken: typeof candidate.startToken === 'string' ? candidate.startToken : candidate.linkToken,
    scoringContext: candidate.scoringContext,
    lastPath,
    isComplete: Boolean(candidate.isComplete),
    tasks,
  };
}

function shouldDeferBackendSync(taskName: keyof AssessmentState['tasks'], data: any): boolean {
  if (taskName === 'naming') {
    const answers = data?.answers;
    return !answers || typeof answers !== 'object' || Object.keys(answers).length < 3;
  }
  if (taskName === 'vigilance') {
    return Number(data?.tapped ?? 0) <= 0;
  }
  return false;
}

interface AssessmentContextType {
  state: AssessmentState;
  startNewAssessment: (sessionId: string, linkToken: string, scoringContext: ScoringContext, startToken?: string | null) => void;
  resumeAssessment: () => void;
  updateTaskData: (taskName: keyof AssessmentState['tasks'], data: any, imageBase64?: string) => void;
  setLastPath: (path: string) => void;
  completeAssessment: () => Promise<boolean>;
  completionStatus: 'idle' | 'submitting' | 'completed' | 'error';
  completionError: string | null;
  taskSaveStatus: Record<string, TaskSaveStatus | undefined>;
  hasInProgressAssessment: boolean;
}

const AssessmentContext = createContext<AssessmentContextType | null>(null);

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AssessmentState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return normalizeStoredAssessmentState(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load assessment state from local storage', e);
    }
    return DEFAULT_STATE;
  });
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'submitting' | 'completed' | 'error'>(
    state.isComplete ? 'completed' : 'idle',
  );
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [taskSaveStatus, setTaskSaveStatus] = useState<Record<string, TaskSaveStatus | undefined>>({});

  // Keep localStorage perfectly in sync with our React state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const startNewAssessment = useCallback((sessionId: string, linkToken: string, scoringContext: ScoringContext, startToken?: string | null) => {
    const newState: AssessmentState = {
      ...DEFAULT_STATE,
      id: sessionId,
      linkToken,
      startToken: startToken ?? linkToken,
      scoringContext,
    };
    setState(newState);
    setTaskSaveStatus({});
  }, []);

  const resumeAssessment = useCallback(() => {
    // Already in state, just a placeholder for potential API fetch in the future
  }, []);

  const updateTaskData = useCallback((taskName: keyof AssessmentState['tasks'], data: any, imageBase64?: string) => {
    setState((prev) => {
      if (prev.tasks[taskName] === data) return prev;
      
      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskName]: data,
        },
      };
    });

    if (!state.id || !state.linkToken || shouldDeferBackendSync(taskName, data)) return;

    const taskKey = String(taskName);
    const taskType = TASK_STATE_TO_SCORING_ID[taskName] ?? `moca-${taskName}`;
    setTaskSaveStatus((prev) => ({ ...prev, [taskKey]: { status: 'saving' } }));

    const syncTask = async () => {
      try {
        let rawData = data;

        if (imageBase64 && ['trailMaking', 'cube', 'clock'].includes(taskName)) {
          const drawingResponse = await fetch(edgeFn('save-drawing'), {
            method: 'POST',
            headers: edgeHeaders(),
            body: JSON.stringify({
              sessionId: state.id,
              linkToken: state.linkToken,
              taskId: taskType,
              imageBase64,
              strokesData: data?.strokes,
            }),
          });

          if (!drawingResponse.ok) throw new Error('Failed to save drawing');
          const { storagePath } = await drawingResponse.json();
          rawData = { ...data, drawingPath: storagePath };
        }

        const response = await fetch(edgeFn('submit-task'), {
          method: 'POST',
          headers: edgeHeaders(),
          body: JSON.stringify({
            sessionId: state.id,
            linkToken: state.linkToken,
            taskType,
            rawData,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Failed to save task');
        }

        setTaskSaveStatus((prev) => ({ ...prev, [taskKey]: { status: 'saved' } }));
      } catch (err) {
        console.error('Failed to sync task data:', err);
        setTaskSaveStatus((prev) => ({
          ...prev,
          [taskKey]: {
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to save task',
          },
        }));
      }
    };

    void syncTask();
  }, [state.id, state.linkToken]);

  const setLastPath = useCallback((path: string) => {
    setState((prev) => {
      if (prev.lastPath === path) return prev;
      return { ...prev, lastPath: path };
    });
  }, []);

  const completeAssessment = useCallback(async (): Promise<boolean> => {
    if (state.isComplete) {
      setCompletionStatus('completed');
      setCompletionError(null);
      return true;
    }

    if (!state.id || !state.linkToken || !state.scoringContext) {
      setCompletionStatus('error');
      setCompletionError('Missing session context');
      return false;
    }

    const scoringInputs: Record<string, unknown> = {};
    for (const [stateKey, scoringId] of Object.entries(TASK_STATE_TO_SCORING_ID)) {
      const taskData = (state.tasks as Record<string, unknown>)[stateKey];
      if (taskData !== undefined) {
        scoringInputs[scoringId] = taskData;
      }
    }

    let report;
    try {
      report = scoreSession(scoringInputs, state.scoringContext);
    } catch (err) {
      console.error('scoreSession failed:', err);
      report = undefined;
    }

    setCompletionStatus('submitting');
    setCompletionError(null);

    try {
      const response = await fetch(edgeFn('complete-session'), {
        method: 'POST',
        headers: edgeHeaders(),
        body: JSON.stringify({
          sessionId: state.id,
          linkToken: state.linkToken,
          scoringReport: report,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to complete session');
      }

      setState((prev) => prev.id === state.id ? { ...prev, isComplete: true } : prev);
      setCompletionStatus('completed');
      return true;
    } catch (err) {
      console.error('Failed to complete session:', err);
      setCompletionStatus('error');
      setCompletionError(err instanceof Error ? err.message : 'Failed to complete session');
      return false;
    }
  }, [state]);

  const hasInProgressAssessment = Boolean(
    state.id &&
      state.linkToken &&
      state.scoringContext &&
      !state.isComplete,
  );

  const contextValue = useMemo(
    () => ({
      state,
      startNewAssessment,
      resumeAssessment,
      updateTaskData,
      setLastPath,
      completeAssessment,
      completionStatus,
      completionError,
      taskSaveStatus,
      hasInProgressAssessment,
    }),
    [
      state,
      startNewAssessment,
      resumeAssessment,
      updateTaskData,
      setLastPath,
      completeAssessment,
      completionStatus,
      completionError,
      taskSaveStatus,
      hasInProgressAssessment,
    ]
  );

  return (
    <AssessmentContext.Provider value={contextValue}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessmentStore() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessmentStore must be used within an AssessmentProvider');
  }
  return context;
}
