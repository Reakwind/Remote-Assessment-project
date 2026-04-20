import React from 'react';
import { useBatteryEngine } from '../hooks/useBatteryEngine';
import { OrientationModule } from './OrientationModule';
import { TrailMakingTask } from './TrailMakingTask';
import { ClockDrawingTask } from './ClockDrawingTask';
import type { BatteryManifest } from '../types/battery';

interface Props {
  manifest: BatteryManifest;
}

export const BatteryPlayer: React.FC<Props> = ({ manifest }) => {
  const { state, activeStep, nextStep } = useBatteryEngine(manifest);

  if (state.isFinished) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
        <h1>תודה רבה</h1>
        <p>ההערכה הסתיימה בהצלחה.</p>
      </div>
    );
  }

  // Switch based on test type
  switch (activeStep.type) {
    case 'orientation':
      return <OrientationModule onComplete={() => nextStep({ orientation: 'completed' })} />;
    case 'moca-visuospatial':
      return <TrailMakingTask onComplete={(data) => nextStep({ trails: data })} />;
    case 'moca-clock':
      return <ClockDrawingTask onComplete={(data) => nextStep({ clock: data })} />;
    default:
      return (
        <div className="container">
          <h2>משימה בתהליך: {activeStep.id}</h2>
          <button className="high-contrast-btn" onClick={() => nextStep()}>
            הבא
          </button>
        </div>
      );
  }
};
