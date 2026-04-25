import { createContext } from 'react';
import type { ScoringContext } from '../../types/scoring';
import type { LocalTaskName } from '../../lib/taskMapping';
import type { AssessmentState } from './assessmentPersistence';

export interface AssessmentContextValue {
  state: AssessmentState;
  startNewAssessment: (sessionId: string, linkToken: string, scoringContext: ScoringContext) => void;
  resumeAssessment: () => void;
  updateTaskData: (taskName: LocalTaskName, data: any, imageBase64?: string, audioBlob?: Blob) => void;
  setLastPath: (path: string) => void;
  completeAssessment: () => void;
  clearAssessment: () => void;
  hasInProgressAssessment: boolean;
}

export const AssessmentContext = createContext<AssessmentContextValue | null>(null);
