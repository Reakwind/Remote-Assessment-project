import { useTranslation } from 'react-i18next';
import { useBatteryEngine } from './hooks/useBatteryEngine';
import { AssessmentLayout } from './components/AssessmentLayout';
import type { BatteryManifest } from './types/battery';

const SAMPLE_MANIFEST: BatteryManifest = {
  id: 'moca-hebrew-v1',
  version: '1.0',
  steps: [
    { id: 'orientation', type: 'orientation', titleKey: 'orientation.title' },
    { id: 'memory', type: 'moca-memory', titleKey: 'memory.title' },
  ],
};

function App() {
  const { t } = useTranslation();
  const { state, activeStep, nextStep, prevStep } = useBatteryEngine(SAMPLE_MANIFEST);

  if (state.isFinished) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
        <h1>תודה רבה</h1>
        <p>ההערכה הסתיימה בהצלחה.</p>
      </div>
    );
  }

  return (
    <AssessmentLayout
      title={t(activeStep.titleKey)}
      onNext={() => nextStep({ completed: true })}
      onBack={state.currentIndex > 0 ? prevStep : undefined}
      isLastStep={state.currentIndex === SAMPLE_MANIFEST.steps.length - 1}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '1.5rem' }}>{t(`${activeStep.id}.welcome` as any)}</p>
      </div>
    </AssessmentLayout>
  );
}

export default App;
