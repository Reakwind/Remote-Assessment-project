import { useContext } from 'react';
import { AssessmentContext } from './AssessmentContextValue';

export function useAssessmentStore() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessmentStore must be used within an AssessmentProvider');
  }
  return context;
}
