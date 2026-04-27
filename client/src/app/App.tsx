import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AssessmentProvider } from './store/AssessmentContext';
import { EnvironmentBanner } from './components/EnvironmentBanner';
import '../styles/index.css';

// App entry point with styles
export default function App() {
  return (
    <AssessmentProvider>
      <EnvironmentBanner />
      <RouterProvider router={router} />
    </AssessmentProvider>
  );
}
