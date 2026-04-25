import { Outlet, useNavigate, useLocation } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { useAssessmentStore } from "../store/AssessmentContext";
import { StimuliManifestProvider, StimulusReadinessBanner } from "./StimuliManifestProvider";

export function AssessmentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, setLastPath } = useAssessmentStore();
  const mocaVersion = state.scoringContext?.mocaVersion ?? "8.3";

  useEffect(() => {
    // Keep track of the last path the user was on
    setLastPath(location.pathname);
  }, [location.pathname, setLastPath]);

  const getStepNumber = () => {
    const path = location.pathname.split('/').pop();
    switch (path) {
      case 'patient': return 1;
      case 'trail-making': return 1;
      case 'cube': return 2;
      case 'clock': return 3;
      case 'naming': return 4;
      case 'memory': return 5;
      case 'digit-span': return 6;
      case 'vigilance': return 7;
      case 'serial7': return 8;
      case 'language': return 9;
      case 'abstraction': return 11;
      case 'delayed-recall': return 12;
      case 'orientation': return 13;
      case 'end': return 14;
      default: return 1;
    }
  };

  const currentStep = getStepNumber();
  const totalSteps = 14;

  const getNextRoute = () => {
    switch (currentStep) {
      case 1: return '/patient/cube';
      case 2: return '/patient/clock';
      case 3: return '/patient/naming';
      case 4: return '/patient/memory';
      case 5: return '/patient/digit-span';
      case 6: return '/patient/vigilance';
      case 7: return '/patient/serial7';
      case 8: return '/patient/language';
      case 9: return '/patient/abstraction';
      case 11: return '/patient/delayed-recall';
      case 12: return '/patient/orientation';
      case 13: return '/patient/end';
      case 14: return '/dashboard';
      default: return '/dashboard';
    }
  };

  const getPrevRoute = () => {
    switch (currentStep) {
      case 1: return '/';
      case 2: return '/patient/trail-making';
      case 3: return '/patient/cube';
      case 4: return '/patient/clock';
      case 5: return '/patient/naming';
      case 6: return '/patient/memory';
      case 7: return '/patient/digit-span';
      case 8: return '/patient/vigilance';
      case 9: return '/patient/serial7';
      case 11: return '/patient/language';
      case 12: return '/patient/abstraction';
      case 13: return '/patient/delayed-recall';
      case 14: return '/patient/orientation';
      default: return '/';
    }
  };
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <StimuliManifestProvider>
      <div dir="rtl" className="min-h-screen flex flex-col bg-white text-black font-['Heebo',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-5 border-b border-gray-200 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xl">
            RC
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">Remote Check</div>
            <div className="text-sm text-gray-500">הערכה נוירופסיכולוגית</div>
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-bold text-xl">MoCA - עברית</h1>
          <div className="text-sm text-gray-500">גרסה {mocaVersion}</div>
        </div>

        <div className="font-mono text-lg font-medium tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
          שלב {currentStep} מתוך {totalSteps}
        </div>
      </header>
      <StimulusReadinessBanner />

      {/* Progress Bar */}
      <div className="h-1 bg-gray-100 w-full">
        <div 
          className="h-full bg-black transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-10 py-12 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 bg-white border-t border-gray-200 px-10 py-5 flex items-center justify-between">
        <button
          onClick={() => navigate(getPrevRoute())}
          className="flex items-center gap-2 h-[80px] px-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-black font-semibold text-xl transition-colors min-w-[var(--target-size)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
        >
          <ArrowRight className="w-6 h-6" />
          <span>חזרה</span>
        </button>

          <button 
          onClick={() => {
            // Optional: you could add validation here based on state.tasks
            if (currentStep === 14) {
              navigate('/dashboard');
            } else {
              navigate(getNextRoute());
            }
          }}
          className="flex items-center gap-2 h-[80px] px-10 rounded-lg bg-black hover:bg-gray-900 text-white font-semibold text-xl transition-colors min-w-[var(--target-size)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
        >
          <span>{currentStep === 14 ? 'סיום משימה' : 'המשך'}</span>
          <ArrowLeft className="w-6 h-6" />
        </button>
      </footer>
      </div>
    </StimuliManifestProvider>
  );
}
