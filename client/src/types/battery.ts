export type TestType = 'orientation' | 'moca-visuospatial' | 'moca-clock' | 'moca-naming' | 'moca-memory';

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
