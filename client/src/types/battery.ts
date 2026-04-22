/* eslint-disable @typescript-eslint/no-explicit-any */
export type TestType = 
  | 'orientation' 
  | 'moca-visuospatial' 
  | 'moca-cube'
  | 'moca-clock' 
  | 'moca-naming' 
  | 'moca-memory-learning' 
  | 'moca-digit-span' 
  | 'moca-vigilance' 
  | 'moca-serial-7s' 
  | 'moca-language'
  | 'moca-abstraction'
  | 'moca-delayed-recall'
  | 'moca-orientation-task';

export interface TestStep {
  id: string;
  type: TestType;
  titleKey: string;
  config?: Record<string, any>;
}

export interface BatteryManifest {
  id: string;
  version: string;
  steps: TestStep[];
}

export interface AssessmentState {
  currentIndex: number;
  results: Record<string, any>;
  isFinished: boolean;
}
