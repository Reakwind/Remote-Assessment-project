import { BatteryPlayer } from './components/BatteryPlayer';
import type { BatteryManifest } from './types/battery';

const MOCA_MANIFEST: BatteryManifest = {
  id: 'moca-hebrew-v1',
  version: '1.0',
  steps: [
    { id: 'orientation', type: 'orientation', titleKey: 'orientation.title' },
    { id: 'trails', type: 'moca-visuospatial', titleKey: 'visuospatial.trails' },
    { id: 'clock', type: 'moca-clock', titleKey: 'visuospatial.clock' },
  ],
};

function App() {
  return <BatteryPlayer manifest={MOCA_MANIFEST} />;
}

export default App;
