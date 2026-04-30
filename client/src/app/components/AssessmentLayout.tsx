import { Navigate, Outlet, useNavigate, useLocation } from "react-router";
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
  const taskData = tasks[taskKey];
  if (taskData && typeof taskData === "object" && !Array.isArray(taskData) && (taskData as { skipped?: unknown }).skipped === true) {
    return true;
  }

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
  const { state, setLastPath, updateTaskData, taskSaveStatus, retryFailedSaves, hasInProgressAssessment } = useAssessmentStore();
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
  const canContinue = !saveBlocksContinue;
  const isEndScreen = currentPath === "end";

  useEffect(() => {
    // Keep track of the last path the user was on
    setLastPath(location.pathname);
  }, [location.pathname, setLastPath]);

  const handleNext = () => {
    if (currentSaveStatus?.status === "saving") {
      setValidation({
        path: location.pathname,
        message: "הנתונים נשמרים כעת. יש להמתין לפני המעבר למשימה הבאה.",
      });
      return;
    }
    if (currentSaveStatus?.status === "error") {
      retryFailedSaves();
      setValidation({
        path: location.pathname,
        message: currentSaveStatus.message ?? "שמירת התשובה נכשלה. בדוק חיבור ונסה שוב לפני המעבר.",
      });
      return;
    }
    if (!hasEvidence && currentStepConfig.taskKey) {
      updateTaskData(currentStepConfig.taskKey, {
        skipped: true,
        skippedAt: new Date().toISOString(),
        reason: "no_evidence",
      });
    }
    setValidation(null);
    navigate(currentStepConfig.next);
  };

  const progressPercent = (Math.min(currentStep, totalSteps) / totalSteps) * 100;
  const validationMessage = validation?.path === location.pathname ? validation.message : null;
  const continueStateId = validationMessage || currentSaveStatus ? "continue-state" : undefined;

  if (!hasInProgressAssessment && !isEndScreen) {
    return <Navigate to="/" replace />;
  }

  return (
    <StimuliManifestProvider>
      <div dir="rtl" className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-white text-black font-['Heebo',sans-serif]">
      {/* Header */}
      <header className="z-10 border-b border-gray-200 bg-white px-4 py-2.5 sm:px-6 sm:py-3 lg:px-10">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-base font-bold text-white sm:h-10 sm:w-10 sm:text-xl">
              RC
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-base font-bold leading-tight sm:text-lg">Remote Check</div>
              <div className="truncate text-xs text-gray-500 sm:text-sm">הערכה נוירופסיכולוגית</div>
            </div>
          </div>

          <div className="shrink-0 text-center">
            <h1 className="text-base font-bold leading-tight sm:text-xl">MoCA - עברית</h1>
            <div className="text-xs font-medium text-gray-500 sm:text-sm">גרסה {mocaVersion}</div>
          </div>

          <div
            className="shrink-0 text-left font-mono text-base font-extrabold tabular-nums sm:text-lg"
            data-testid="patient-step-indicator"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            <div className="inline-flex min-w-14 items-center justify-center rounded-full bg-gray-100 px-3 py-1 text-gray-950 sm:bg-transparent sm:px-0 sm:py-0">
              {isEndScreen ? (
                "סיום"
              ) : (
                <>
                  <span className="sm:hidden">{currentStep}/{totalSteps}</span>
                  <span className="hidden sm:inline">שלב {currentStep} מתוך {totalSteps}</span>
                </>
              )}
            </div>
            {!isEndScreen && <div className="mt-0.5 text-center text-[0.65rem] font-bold text-gray-500 sm:hidden">שלב</div>}
          </div>
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
      <main className="mx-auto flex w-full max-w-[1100px] min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
        <Outlet />
      </main>

      {/* Footer */}
      {!isEndScreen && (
        <>
        <footer
          className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)] items-center gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)] sm:flex sm:flex-wrap sm:justify-between sm:px-6 sm:py-4 lg:px-10 lg:py-5"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={() => navigate(currentStepConfig.prev)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 text-base font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:min-h-16 sm:px-8 sm:text-xl"
          >
            <ArrowRight className="w-6 h-6" />
            <span>חזרה</span>
          </button>

          <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-none sm:items-end">
            {validationMessage && (
              <div
                id="continue-state"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-extrabold text-amber-900 sm:text-right"
                role="alert"
              >
                {validationMessage}
              </div>
            )}

            {!validationMessage && currentSaveStatus && (
              <div
                id="continue-state"
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold sm:justify-end"
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
              aria-describedby={continueStateId}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-black px-4 text-base font-semibold text-white transition-colors hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:min-h-16 sm:px-10 sm:text-xl"
            >
              {currentSaveStatus?.status === "saving" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>שומר...</span>
                </>
              ) : currentSaveStatus?.status === "error" ? (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>נסה שוב לשמור</span>
                </>
              ) : (
                <>
                  <span>{hasEvidence ? "המשך" : "דלג והמשך"}</span>
                  <ArrowLeft className="w-6 h-6" />
                </>
              )}
            </button>
          </div>
        </footer>
        </>
      )}
      </div>
    </StimuliManifestProvider>
  );
}
