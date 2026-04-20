import { useState } from 'react';
import type { BatteryManifest, AssessmentState } from '../types/battery';

export function useBatteryEngine(manifest: BatteryManifest) {
  const [state, setState] = useState<AssessmentState>({
    currentIndex: 0,
    results: {},
    isFinished: false,
  });

  const activeStep = manifest.steps[state.currentIndex];

  const nextStep = (stepResult?: any) => {
    setState((prev) => {
      const isLast = prev.currentIndex === manifest.steps.length - 1;
      return {
        ...prev,
        results: { ...prev.results, [activeStep.id]: stepResult },
        currentIndex: isLast ? prev.currentIndex : prev.currentIndex + 1,
        isFinished: isLast,
      };
    });
  };

  const prevStep = () => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  };

  return {
    state,
    activeStep,
    nextStep,
    prevStep,
  };
}
