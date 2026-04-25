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

const DEFAULT_STATE: AssessmentState = {
  id: null,
  linkToken: null,
  scoringContext: null,
  lastPath: '/patient/trail-making',
  isComplete: false,
  tasks: {},
};

const STORAGE_KEY = 'moca_assessment_state';

interface AssessmentContextType {
  state: AssessmentState;
  startNewAssessment: (sessionId: string, linkToken: string, scoringContext: ScoringContext) => void;
  resumeAssessment: () => void;
  updateTaskData: (taskName: keyof AssessmentState['tasks'], data: any, imageBase64?: string) => void;
  setLastPath: (path: string) => void;
  completeAssessment: () => void;
  hasInProgressAssessment: boolean;
}

const AssessmentContext = createContext<AssessmentContextType | null>(null);

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AssessmentState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load assessment state from local storage', e);
    }
    return DEFAULT_STATE;
  });

  // Keep localStorage perfectly in sync with our React state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const startNewAssessment = useCallback((sessionId: string, linkToken: string, scoringContext: ScoringContext) => {
    const newState: AssessmentState = {
      ...DEFAULT_STATE,
      id: sessionId,
      linkToken,
      scoringContext,
    };
    setState(newState);
  }, []);

  const resumeAssessment = useCallback(() => {
    // Already in state, just a placeholder for potential API fetch in the future
  }, []);

  const updateTaskData = useCallback((taskName: keyof AssessmentState['tasks'], data: any, imageBase64?: string) => {
    setState((prev) => {
      if (prev.tasks[taskName] === data) return prev;
      
      const newState = {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskName]: data,
        },
      };

      // Sync with backend
      if (prev.id) {
        const taskType = TASK_STATE_TO_SCORING_ID[taskName] ?? `moca-${taskName}`;
        
        if (imageBase64 && ['trailMaking', 'cube', 'clock'].includes(taskName)) {
          // Drawing task: save image first
          fetch(edgeFn('save-drawing'), {
            method: 'POST',
            headers: edgeHeaders(),
            body: JSON.stringify({
              sessionId: prev.id,
              linkToken: prev.linkToken,
              taskId: taskType,
              imageBase64,
            }),
          })
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(({ storagePath }) => {
              fetch(edgeFn('submit-task'), {
                method: 'POST',
                headers: edgeHeaders(),
                body: JSON.stringify({ 
                  sessionId: prev.id, 
                  linkToken: prev.linkToken,
                  taskType, 
                  rawData: { ...data, drawingPath: storagePath } 
                }),
              });
            })
            .catch(err => console.error('Failed to save drawing:', err));
        } else {
          // Normal task
          fetch(edgeFn('submit-task'), {
            method: 'POST',
            headers: edgeHeaders(),
            body: JSON.stringify({ 
              sessionId: prev.id, 
              linkToken: prev.linkToken,
              taskType, 
              rawData: data 
            }),
          }).catch(err => console.error('Failed to sync task data:', err));
        }
      }

      return newState;
    });
  }, []);

  const setLastPath = useCallback((path: string) => {
    setState((prev) => {
      if (prev.lastPath === path) return prev;
      return { ...prev, lastPath: path };
    });
  }, []);

  const completeAssessment = useCallback(() => {
    setState((prev) => {
      if (prev.isComplete) return prev;

      if (prev.id && prev.scoringContext) {
        const scoringInputs: Record<string, unknown> = {};
        for (const [stateKey, scoringId] of Object.entries(TASK_STATE_TO_SCORING_ID)) {
          const taskData = (prev.tasks as Record<string, unknown>)[stateKey];
          if (taskData !== undefined) {
            scoringInputs[scoringId] = taskData;
          }
        }

        let report;
        try {
          report = scoreSession(scoringInputs, prev.scoringContext);
        } catch (err) {
          console.error('scoreSession failed:', err);
          report = undefined;
        }

        fetch(edgeFn('complete-session'), {
          method: 'POST',
          headers: edgeHeaders(),
          body: JSON.stringify({
            sessionId: prev.id,
            linkToken: prev.linkToken,
            scoringReport: report,
          }),
        }).catch((err) => console.error('Failed to complete session:', err));
      }

      return { ...prev, isComplete: true };
    });
  }, []);

  const hasInProgressAssessment = state.id !== null && !state.isComplete;

  const contextValue = useMemo(
    () => ({
      state,
      startNewAssessment,
      resumeAssessment,
      updateTaskData,
      setLastPath,
      completeAssessment,
      hasInProgressAssessment,
    }),
    [state, startNewAssessment, resumeAssessment, updateTaskData, setLastPath, completeAssessment, hasInProgressAssessment]
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
