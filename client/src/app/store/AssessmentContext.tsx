import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ScoringContext } from '../../types/scoring';
import { edgeAnonHeaders, edgeFn } from '../../lib/supabase';
import { DRAWING_TASKS, TASK_TYPE_BY_LOCAL, toCanonicalTaskPayload, type LocalTaskName } from '../../lib/taskMapping';
import {
  DEFAULT_ASSESSMENT_STATE,
  readAssessmentState,
  writeAssessmentState,
  type AssessmentState,
} from './assessmentPersistence';
import { AssessmentContext } from './AssessmentContextValue';

export type { AssessmentState } from './assessmentPersistence';

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AssessmentState>(() => readAssessmentState());

  // Keep localStorage perfectly in sync with our React state
  useEffect(() => {
    writeAssessmentState(state);
  }, [state]);

  const startNewAssessment = useCallback((sessionId: string, linkToken: string, scoringContext: ScoringContext) => {
    const newState: AssessmentState = {
      ...DEFAULT_ASSESSMENT_STATE,
      id: sessionId,
      linkToken,
      scoringContext,
    };
    setState(newState);
  }, []);

  const resumeAssessment = useCallback(() => {
    // Already in state, just a placeholder for potential API fetch in the future
  }, []);

  const updateTaskData = useCallback((taskName: LocalTaskName, data: any, imageBase64?: string, audioBlob?: Blob) => {
    setState((prev) => {
      if (prev.tasks[taskName] === data) return prev;
      
      const newState = {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskName]: data,
        },
      };

      if (prev.id) {
        const taskType = TASK_TYPE_BY_LOCAL[taskName];
        const rawData = toCanonicalTaskPayload(taskName, data);
        const linkToken = prev.linkToken;

        if (!linkToken) {
          console.error('Cannot sync task data without a patient link token');
          return newState;
        }

        if (DRAWING_TASKS.has(taskName) && imageBase64) {
          fetch(edgeFn('save-drawing'), {
            method: 'POST',
            headers: edgeAnonHeaders,
            body: JSON.stringify({
              sessionId: prev.id,
              linkToken,
              taskId: taskType,
              strokesData: data?.strokes ?? [],
              imageBase64,
            }),
          })
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(({ storagePath }) =>
              fetch(edgeFn('submit-results'), {
                method: 'POST',
                headers: edgeAnonHeaders,
                body: JSON.stringify({ 
                  sessionId: prev.id, 
                  linkToken,
                  taskType, 
                  rawData: { ...data, storagePath } 
                }),
              })
            )
            .catch(err => console.error('Failed to save drawing:', err));
        } else if (audioBlob) {
          blobToDataUrl(audioBlob)
            .then(audioBase64 =>
              fetch(edgeFn('save-audio'), {
                method: 'POST',
                headers: edgeAnonHeaders,
                body: JSON.stringify({
                  sessionId: prev.id,
                  linkToken,
                  taskType,
                  audioBase64,
                  contentType: audioBlob.type || 'audio/webm',
                }),
              })
            )
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(({ storagePath, contentType }) =>
              fetch(edgeFn('submit-results'), {
                method: 'POST',
                headers: edgeAnonHeaders,
                body: JSON.stringify({
                  sessionId: prev.id,
                  linkToken,
                  taskType,
                  rawData: withAudioStorage(rawData, storagePath, contentType),
                }),
              })
            )
            .catch(err => console.error('Failed to save audio task:', err));
        } else {
          fetch(edgeFn('submit-results'), {
            method: 'POST',
            headers: edgeAnonHeaders,
            body: JSON.stringify({ 
              sessionId: prev.id, 
              linkToken,
              taskType, 
              rawData,
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
      
      // Notify backend that assessment is complete
      if (prev.id && prev.linkToken) {
        fetch(edgeFn('complete-session'), {
          method: 'POST',
          headers: edgeAnonHeaders,
          body: JSON.stringify({ sessionId: prev.id, linkToken: prev.linkToken }),
        }).catch(err => console.error('Failed to complete session:', err));
      }

      return { ...prev, isComplete: true };
    });
  }, []);

  const clearAssessment = useCallback(() => {
    setState(DEFAULT_ASSESSMENT_STATE);
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
      clearAssessment,
      hasInProgressAssessment,
    }),
    [state, startNewAssessment, resumeAssessment, updateTaskData, setLastPath, completeAssessment, clearAssessment, hasInProgressAssessment]
  );

  return (
    <AssessmentContext.Provider value={contextValue}>
      {children}
    </AssessmentContext.Provider>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function withAudioStorage(rawData: unknown, storagePath: string, contentType: string): unknown {
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    return { ...rawData, audioStoragePath: storagePath, audioContentType: contentType };
  }
  return { value: rawData, audioStoragePath: storagePath, audioContentType: contentType };
}
