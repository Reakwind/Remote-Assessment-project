import { Outlet, useNavigate, useLocation } from "react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAssessmentStore } from "../store/AssessmentContext";
import { StimuliManifestProvider, StimulusReadinessBanner } from "./StimuliManifestProvider";

type TaskKey =
  | "trailMaking"
  | "cube"
  | "clock"
  | "naming"
  | "memory"
  | "digitSpan"
  | "vigilance"
  | "serial7"
  | "language"
  | "abstraction"
  | "delayedRecall"
  | "orientation";

interface StepConfig {
  step: number;
  next: string;
  prev: string;
  taskKey?: TaskKey;
  incompleteMessage?: string;
}

const STEP_CONFIG: Record<string, StepConfig> = {
  patient: {
    step: 1,
    next: "/patient/cube",
    prev: "/",
    taskKey: "trailMaking",
    incompleteMessage: "יש להשלים את הציור לפני מעבר למשימה הבאה.",
  },
  "trail-making": {
    step: 1,
    next: "/patient/cube",
    prev: "/",
    taskKey: "trailMaking",
    incompleteMessage: "יש להשלים את הציור לפני מעבר למשימה הבאה.",
  },
  cube: {
    step: 2,
    next: "/patient/clock",
    prev: "/patient/trail-making",
    taskKey: "cube",
    incompleteMessage: "יש להשלים את ציור הקובייה לפני מעבר למשימה הבאה.",
  },
  clock: {
    step: 3,
    next: "/patient/naming",
    prev: "/patient/cube",
    taskKey: "clock",
    incompleteMessage: "יש להשלים את ציור השעון לפני מעבר למשימה הבאה.",
  },
  naming: {
    step: 4,
    next: "/patient/memory",
    prev: "/patient/clock",
    taskKey: "naming",
    incompleteMessage: "יש לבחור תשובה לכל שלושת פריטי השיום.",
  },
  memory: {
    step: 5,
    next: "/patient/digit-span",
    prev: "/patient/naming",
    taskKey: "memory",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  "digit-span": {
    step: 6,
    next: "/patient/vigilance",
    prev: "/patient/memory",
    taskKey: "digitSpan",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  vigilance: {
    step: 7,
    next: "/patient/serial7",
    prev: "/patient/digit-span",
    taskKey: "vigilance",
    incompleteMessage: "יש לבצע לפחות הקשה אחת במשימת הקשב לפני מעבר למשימה הבאה.",
  },
  serial7: {
    step: 8,
    next: "/patient/language",
    prev: "/patient/vigilance",
    taskKey: "serial7",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  language: {
    step: 9,
    next: "/patient/abstraction",
    prev: "/patient/serial7",
    taskKey: "language",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  abstraction: {
    step: 10,
    next: "/patient/delayed-recall",
    prev: "/patient/language",
    taskKey: "abstraction",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  "delayed-recall": {
    step: 11,
    next: "/patient/orientation",
    prev: "/patient/abstraction",
    taskKey: "delayedRecall",
    incompleteMessage: "יש להקליט תשובה לפני מעבר למשימה הבאה.",
  },
  orientation: {
    step: 12,
    next: "/patient/end",
    prev: "/patient/delayed-recall",
    taskKey: "orientation",
    incompleteMessage: "יש להקליט תשובה לפני סיום המבדק.",
  },
  end: {
    step: 12,
    next: "/patient/welcome",
    prev: "/patient/orientation",
  },
};

const totalSteps = 12;

function hasStrokeEvidence(data: unknown): boolean {
  const strokes = (data as { strokes?: unknown })?.strokes;
  return Array.isArray(strokes) && strokes.some((stroke) => Array.isArray(stroke) && stroke.length > 0);
}

function hasAudioEvidence(data: unknown): boolean {
  const audio = data as { audioId?: unknown; audioStoragePath?: unknown } | null | undefined;
  return Boolean(
    (typeof audio?.audioStoragePath === "string" && audio.audioStoragePath.length > 0) ||
      (typeof audio?.audioId === "string" && audio.audioId.length > 0),
  );
}

function taskHasEvidence(taskKey: TaskKey | undefined, tasks: ReturnType<typeof useAssessmentStore>["state"]["tasks"]): boolean {
  if (!taskKey) return true;

  switch (taskKey) {
    case "trailMaking":
    case "cube":
    case "clock":
      return hasStrokeEvidence(tasks[taskKey]);
    case "naming": {
      const answers = (tasks.naming as { answers?: unknown })?.answers;
      return Boolean(answers && typeof answers === "object" && Object.keys(answers).length >= 3);
    }
    case "vigilance":
      return Number((tasks.vigilance as { tapped?: unknown })?.tapped ?? 0) > 0;
    default:
      return hasAudioEvidence(tasks[taskKey]);
  }
}

export function AssessmentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, setLastPath, taskSaveStatus } = useAssessmentStore();
  const mocaVersion = state.scoringContext?.mocaVersion ?? "8.3";
  const [validation, setValidation] = useState<{ path: string; message: string } | null>(null);
  const currentPath = location.pathname.split('/').pop() ?? "patient";
  const currentStepConfig = STEP_CONFIG[currentPath] ?? STEP_CONFIG.patient;
  const currentStep = currentStepConfig.step;
  const hasEvidence = useMemo(
    () => taskHasEvidence(currentStepConfig.taskKey, state.tasks),
    [currentStepConfig.taskKey, state.tasks],
  );
  const currentSaveStatus = currentStepConfig.taskKey ? taskSaveStatus[currentStepConfig.taskKey] : undefined;
  const saveBlocksContinue = currentSaveStatus?.status === "saving" || currentSaveStatus?.status === "error";
  const canContinue = hasEvidence && !saveBlocksContinue;
  const isEndScreen = currentPath === "end";

  useEffect(() => {
    // Keep track of the last path the user was on
    setLastPath(location.pathname);
  }, [location.pathname, setLastPath]);

  const handleNext = () => {
    if (!hasEvidence) {
      setValidation({
        path: location.pathname,
        message: currentStepConfig.incompleteMessage ?? "יש להשלים את המשימה לפני מעבר למשימה הבאה.",
      });
      return;
    }
    if (currentSaveStatus?.status === "saving") {
      setValidation({
        path: location.pathname,
        message: "הנתונים נשמרים כעת. יש להמתין לפני המעבר למשימה הבאה.",
      });
      return;
    }
    if (currentSaveStatus?.status === "error") {
      setValidation({
        path: location.pathname,
        message: "שמירת התשובה נכשלה. בדוק חיבור ונסה שוב לפני המעבר.",
      });
      return;
    }
    setValidation(null);
    navigate(currentStepConfig.next);
  };

  const progressPercent = (Math.min(currentStep, totalSteps) / totalSteps) * 100;
  const validationMessage = validation?.path === location.pathname ? validation.message : null;

  return (
    <StimuliManifestProvider>
      <div dir="rtl" className="min-h-screen flex flex-col bg-white text-black font-['Heebo',sans-serif]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10 lg:py-5 border-b border-gray-200 bg-white z-10">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 shrink-0 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xl">
            RC
          </div>
          <div className="min-w-0">
            <div className="font-bold text-lg leading-tight">Remote Check</div>
            <div className="text-sm text-gray-500">הערכה נוירופסיכולוגית</div>
          </div>
        </div>

        <div className="order-3 w-full text-right sm:order-none sm:w-auto sm:text-center">
          <h1 className="font-bold text-lg sm:text-xl">MoCA - עברית</h1>
          <div className="text-sm text-gray-500">גרסה {mocaVersion}</div>
        </div>

        <div className="font-mono text-base sm:text-lg font-medium tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
          {isEndScreen ? "סיום" : `שלב ${currentStep} מתוך ${totalSteps}`}
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
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12 flex flex-col min-w-0">
        <Outlet />
      </main>

      {/* Footer */}
      {!isEndScreen && (
        <>
        {validationMessage && (
          <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-extrabold text-amber-900 sm:mx-6 lg:mx-10" role="alert">
            {validationMessage}
          </div>
        )}
        <footer className="bg-white border-t border-gray-200 px-4 py-4 sm:px-6 lg:px-10 lg:py-5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate(currentStepConfig.prev)}
            className="flex items-center justify-center gap-2 min-h-14 sm:min-h-[80px] px-4 sm:px-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-black font-semibold text-base sm:text-xl transition-colors min-w-[var(--target-size)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
          >
            <ArrowRight className="w-6 h-6" />
            <span>חזרה</span>
          </button>

          {currentSaveStatus && (
            <div
              className="order-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold sm:order-none sm:w-auto"
              role={currentSaveStatus.status === "error" ? "alert" : "status"}
            >
              {currentSaveStatus.status === "saving" && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-700" />
                  <span className="text-blue-900">שומר תשובה...</span>
                </>
              )}
              {currentSaveStatus.status === "saved" && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                  <span className="text-green-900">נשמר</span>
                </>
              )}
              {currentSaveStatus.status === "error" && (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-700" />
                  <span className="text-red-900">שמירה נכשלה</span>
                </>
              )}
            </div>
          )}

          <button 
            type="button"
            onClick={handleNext}
            aria-disabled={!canContinue}
            className="flex items-center justify-center gap-2 min-h-14 sm:min-h-[80px] px-5 sm:px-10 rounded-lg bg-black hover:bg-gray-900 text-white font-semibold text-base sm:text-xl transition-colors min-w-[var(--target-size)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
          >
            <span>המשך</span>
            <ArrowLeft className="w-6 h-6" />
          </button>
        </footer>
        </>
      )}
      </div>
    </StimuliManifestProvider>
  );
}
