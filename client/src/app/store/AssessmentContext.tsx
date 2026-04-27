/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { ScoringContext } from '../../types/scoring';
import { edgeFn, edgeHeaders } from '../../lib/supabase';
import { scoreSession } from '../../lib/scoring';
import { AudioStore } from './audioStore';
import {
  clearAutosaveQueueForSession,
  loadAutosaveQueue,
  queuedSavesForSession,
  removeQueuedTaskSave,
  updateQueuedTaskSave,
  upsertQueuedTaskSave,
  type QueuedTaskSave,
} from './autosaveQueue';

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
  localStartedAt: string | null;
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
  localStartedAt: null,
  tasks: {},
};

const STORAGE_KEY = 'moca_assessment_state';
const PATIENT_ONBOARDING_KEY = 'moca_patient_onboarding_completed';
const LOCAL_RESUME_EXPIRY_MS = 6 * 60 * 60 * 1000;

export function hasCompletedPatientOnboarding(sessionId?: string | null): boolean {
  try {
    const value = localStorage.getItem(PATIENT_ONBOARDING_KEY);
    if (!sessionId) return value === 'true';
    return value === sessionId;
  } catch {
    return false;
  }
}

export function markPatientOnboardingComplete(sessionId?: string | null): void {
  try {
    localStorage.setItem(PATIENT_ONBOARDING_KEY, sessionId || 'true');
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
    localStartedAt: typeof candidate.localStartedAt === 'string' ? candidate.localStartedAt : null,
    tasks,
  };
}

function isStoredAssessmentExpired(state: AssessmentState): boolean {
  if (!state.id || state.isComplete || !state.localStartedAt) return false;
  const startedAt = Date.parse(state.localStartedAt);
  return Number.isFinite(startedAt) && Date.now() - startedAt > LOCAL_RESUME_EXPIRY_MS;
}

function localAudioIds(state: AssessmentState): string[] {
  return Object.values(state.tasks).flatMap((taskData) => {
    if (!taskData || typeof taskData !== 'object' || Array.isArray(taskData)) return [];
    const audioId = (taskData as { audioId?: unknown }).audioId;
    return typeof audioId === 'string' && audioId.length > 0 && !audioId.startsWith('http') ? [audioId] : [];
  });
}

function cleanupLocalSessionArtifacts(state: AssessmentState): void {
  try {
    if (state.id) clearAutosaveQueueForSession(state.id);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PATIENT_ONBOARDING_KEY);
  } catch {
    // Storage cleanup is best-effort; backend completion remains authoritative.
  }

  for (const audioId of localAudioIds(state)) {
    AudioStore.deleteAudio(audioId).catch((error) => {
      console.error('Failed to clear local audio evidence:', error);
    });
  }
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read audio recording'));
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to encode audio recording'));
    };
    reader.readAsDataURL(blob);
  });
}

function isPendingAudioUpload(rawData: unknown): rawData is {
  audioId: string;
  audioContentType?: string;
  audioUploadPending?: boolean;
} {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return false;
  const audio = rawData as { audioId?: unknown; audioStoragePath?: unknown; audioUploadPending?: unknown };
  return (
    audio.audioUploadPending === true &&
    typeof audio.audioId === 'string' &&
    audio.audioId.length > 0 &&
    typeof audio.audioStoragePath !== 'string'
  );
}

function saveStatusFromQueue(item: QueuedTaskSave): TaskSaveStatus {
  if (item.status === 'error') {
    return {
      status: 'error',
      message: item.lastError ?? 'שמירת התשובה נכשלה. בדוק חיבור ונסה שוב.',
    };
  }

  return { status: 'saving' };
}

interface AssessmentContextType {
  state: AssessmentState;
  startNewAssessment: (sessionId: string, linkToken: string, scoringContext: ScoringContext, startToken?: string | null) => void;
  resumeAssessment: () => void;
  updateTaskData: (taskName: keyof AssessmentState['tasks'], data: any, imageBase64?: string) => void;
  setLastPath: (path: string) => void;
  completeAssessment: () => Promise<boolean>;
  retryFailedSaves: () => void;
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
        const normalized = normalizeStoredAssessmentState(JSON.parse(saved));
        if (isStoredAssessmentExpired(normalized)) {
          cleanupLocalSessionArtifacts(normalized);
          return DEFAULT_STATE;
        }
        return normalized;
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
  const [taskSaveStatus, setTaskSaveStatus] = useState<Record<string, TaskSaveStatus | undefined>>(() => {
    if (!state.id) return {};
    return Object.fromEntries(
      queuedSavesForSession(state.id).map((item) => [item.taskName, saveStatusFromQueue(item)]),
    );
  });
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);

  // Keep localStorage perfectly in sync with our React state
  useEffect(() => {
    if (!state.id) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const syncQueuedTask = useCallback(async (item: QueuedTaskSave): Promise<unknown> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('אין חיבור רשת זמין. הנתונים נשמרו במכשיר ויישלחו כשיהיה חיבור.');
    }

    let rawData = item.rawData;

    if (item.imageBase64) {
      const drawingResponse = await fetch(edgeFn('save-drawing'), {
        method: 'POST',
        headers: edgeHeaders(),
        body: JSON.stringify({
          sessionId: item.sessionId,
          linkToken: item.linkToken,
          taskId: item.taskType,
          imageBase64: item.imageBase64,
          strokesData: (rawData as { strokes?: unknown } | null | undefined)?.strokes,
        }),
      });

      if (!drawingResponse.ok) {
        const payload = await drawingResponse.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to save drawing');
      }

      const { storagePath } = await drawingResponse.json();
      rawData = { ...(rawData as object), drawingPath: storagePath };
    }

    if (isPendingAudioUpload(rawData)) {
      const audioBlob = await AudioStore.getAudio(rawData.audioId);
      if (!audioBlob) throw new Error('ההקלטה המקומית לא נמצאה. יש להקליט את התשובה מחדש.');

      const contentType = rawData.audioContentType || audioBlob.type || 'audio/webm';
      const audioResponse = await fetch(edgeFn('save-audio'), {
        method: 'POST',
        headers: edgeHeaders(),
        body: JSON.stringify({
          sessionId: item.sessionId,
          linkToken: item.linkToken,
          taskType: item.taskType,
          audioBase64: await blobToDataUrl(audioBlob),
          contentType,
        }),
      });

      if (!audioResponse.ok) {
        const payload = await audioResponse.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to save audio');
      }

      const payload = await audioResponse.json();
      rawData = {
        ...(rawData as object),
        audioId: payload.url ?? payload.storagePath ?? rawData.audioId,
        audioStoragePath: payload.audioStoragePath ?? payload.storagePath,
        audioContentType: payload.audioContentType ?? payload.contentType ?? contentType,
        audioUploadPending: undefined,
      };
    }

    const response = await fetch(edgeFn('submit-results'), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({
        sessionId: item.sessionId,
        linkToken: item.linkToken,
        taskType: item.taskType,
        rawData,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to save task');
    }

    return rawData;
  }, []);

  const flushPendingSaves = useCallback(async (): Promise<boolean> => {
    if (!state.id) return true;
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const sessionId = state.id;
    const flushPromise = (async () => {
      let allSaved = true;
      const queue = queuedSavesForSession(sessionId);

      for (const item of queue) {
        updateQueuedTaskSave(item.id, { status: 'syncing', attempts: item.attempts + 1, lastError: undefined });
        setTaskSaveStatus((prev) => ({ ...prev, [item.taskName]: { status: 'saving' } }));

        try {
          const rawData = await syncQueuedTask(item);
          const removed = removeQueuedTaskSave(item.id, item.version);

          if (removed) {
            setTaskSaveStatus((prev) => ({ ...prev, [item.taskName]: { status: 'saved' } }));
            setState((prev) => {
              if (prev.id !== sessionId) return prev;
              return {
                ...prev,
                tasks: {
                  ...prev.tasks,
                  [item.taskName]: rawData,
                },
              };
            });
          }
        } catch (err) {
          allSaved = false;
          const message = err instanceof Error ? err.message : 'Failed to save task';
          console.error('Failed to sync queued task data:', err);
          updateQueuedTaskSave(item.id, {
            status: 'error',
            attempts: item.attempts + 1,
            lastError: message,
          });
          setTaskSaveStatus((prev) => ({
            ...prev,
            [item.taskName]: { status: 'error', message },
          }));
        }
      }

      return allSaved && queuedSavesForSession(sessionId).length === 0;
    })();

    flushPromiseRef.current = flushPromise;
    try {
      return await flushPromise;
    } finally {
      flushPromiseRef.current = null;
      const hasPending = queuedSavesForSession(sessionId).some((item) => item.status === 'pending');
      if (hasPending) {
        window.setTimeout(() => {
          void flushPendingSaves();
        }, 0);
      }
    }
  }, [state.id, syncQueuedTask]);

  useEffect(() => {
    if (!state.id) return;
    const queued = queuedSavesForSession(state.id);
    if (queued.length === 0) return;
    void flushPendingSaves();
  }, [flushPendingSaves, state.id]);

  useEffect(() => {
    const handleOnline = () => {
      loadAutosaveQueue()
        .filter((item) => item.status === 'error')
        .forEach((item) => {
          updateQueuedTaskSave(item.id, { status: 'pending', lastError: undefined });
        });
      void flushPendingSaves();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushPendingSaves]);

  const startNewAssessment = useCallback((sessionId: string, linkToken: string, scoringContext: ScoringContext, startToken?: string | null) => {
    const newState: AssessmentState = {
      ...DEFAULT_STATE,
      id: sessionId,
      linkToken,
      startToken: startToken ?? linkToken,
      scoringContext,
      localStartedAt: new Date().toISOString(),
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
    try {
      upsertQueuedTaskSave({
        sessionId: state.id,
        linkToken: state.linkToken,
        taskName: taskKey,
        taskType,
        rawData: data,
        imageBase64: imageBase64 || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue task save';
      console.error('Failed to queue task data:', err);
      setTaskSaveStatus((prev) => ({ ...prev, [taskKey]: { status: 'error', message } }));
      return;
    }

    void flushPendingSaves();
  }, [flushPendingSaves, state.id, state.linkToken]);

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

    setCompletionStatus('submitting');
    setCompletionError(null);

    const savesFlushed = await flushPendingSaves();
    if (!savesFlushed) {
      setCompletionStatus('error');
      setCompletionError('חלק מהתשובות עדיין לא נשמרו. בדוק חיבור ונסה שוב.');
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

      cleanupLocalSessionArtifacts(state);
      setState(DEFAULT_STATE);
      setCompletionStatus('completed');
      return true;
    } catch (err) {
      console.error('Failed to complete session:', err);
      setCompletionStatus('error');
      setCompletionError(err instanceof Error ? err.message : 'Failed to complete session');
      return false;
    }
  }, [flushPendingSaves, state]);

  const retryFailedSaves = useCallback(() => {
    if (!state.id) return;
    queuedSavesForSession(state.id).forEach((item) => {
      updateQueuedTaskSave(item.id, { status: 'pending', lastError: undefined });
      setTaskSaveStatus((prev) => ({ ...prev, [item.taskName]: { status: 'saving' } }));
    });
    void flushPendingSaves();
  }, [flushPendingSaves, state.id]);

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
      retryFailedSaves,
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
      retryFailedSaves,
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
