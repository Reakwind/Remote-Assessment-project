import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { TaskSaveStatus } from "../../store/AssessmentContext";
import { SaveStateNotice } from "../shared/SaveStateNotice";

interface PatientTaskShellProps {
  children: ReactNode;
  topBanner?: ReactNode;
  mocaVersion: string;
  currentStep: number;
  totalSteps: number;
  isEndScreen: boolean;
  hasEvidence: boolean;
  saveState?: TaskSaveStatus;
  validationMessage?: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function PatientTaskShell({
  children,
  topBanner,
  mocaVersion,
  currentStep,
  totalSteps,
  isEndScreen,
  hasEvidence,
  saveState,
  validationMessage,
  onNext,
  onBack,
}: PatientTaskShellProps) {
  const progressPercent = (Math.min(currentStep, totalSteps) / totalSteps) * 100;
  const continueStateId = validationMessage || saveState ? "continue-state" : undefined;
  const saveBlocksContinue = saveState?.status === "saving" || saveState?.status === "error";
  const canContinue = !saveBlocksContinue;

  return (
    <div dir="rtl" className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-white text-black font-['Heebo',sans-serif]">
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

      {topBanner}

      <div className="h-1 w-full bg-gray-100" data-testid="patient-progress-bar">
        <div
          className="h-full bg-black transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <main className="mx-auto flex w-full max-w-[1100px] min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
        {children}
      </main>

      {!isEndScreen && (
        <footer
          className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)] items-center gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)] sm:flex sm:flex-wrap sm:justify-between sm:px-6 sm:py-4 lg:px-10 lg:py-5"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 text-base font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:min-h-16 sm:px-8 sm:text-xl"
          >
            <ArrowRight className="h-6 w-6" />
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

            {!validationMessage && (
              <SaveStateNotice id="continue-state" state={saveState} />
            )}

            <button
              type="button"
              onClick={onNext}
              aria-disabled={!canContinue}
              aria-describedby={continueStateId}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-black px-4 text-base font-semibold text-white transition-colors hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:min-h-16 sm:px-10 sm:text-xl"
            >
              {saveState?.status === "saving" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>שומר...</span>
                </>
              ) : saveState?.status === "error" ? (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>נסה שוב לשמור</span>
                </>
              ) : (
                <>
                  <span>{hasEvidence ? "המשך" : "דלג והמשך"}</span>
                  <ArrowLeft className="h-6 w-6" />
                </>
              )}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
