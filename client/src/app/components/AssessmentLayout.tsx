import { Navigate, Outlet, useNavigate, useLocation } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { useAssessmentStore } from "../store/AssessmentContext";
import type { TaskSaveStatus } from "../store/AssessmentContext";
import { StimuliManifestProvider, StimulusReadinessBanner } from "./StimuliManifestProvider";
import { PatientTaskShell } from "./patient/PatientTaskShell";
import {
  getPatientStepConfig,
  patientTaskHasEvidence,
  patientTaskTotalSteps,
} from "./patient/patientTaskFlow";

const DRAWING_SAVE_ERROR_MESSAGE = "שמירת הציור נכשלה. בדוק חיבור ונסה שוב לפני המעבר.";
const ANSWER_SAVE_ERROR_MESSAGE = "שמירת התשובה נכשלה. בדוק חיבור ונסה שוב לפני המעבר.";

function isDrawingTask(taskKey: string | null) {
  return taskKey === "trailMaking" || taskKey === "cube" || taskKey === "clock";
}

function isGenericSaveError(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized.includes("failed to save") ||
    normalized.includes("save failed") ||
    normalized.includes("שמירת התשובה נכשלה") ||
    normalized.includes("שמירת הציור נכשלה")
  );
}

function saveErrorMessageForTask(taskKey: string | null, message?: string) {
  if (isDrawingTask(taskKey)) {
    if (!message || isGenericSaveError(message)) {
      return DRAWING_SAVE_ERROR_MESSAGE;
    }
    return message;
  }

  return message ?? ANSWER_SAVE_ERROR_MESSAGE;
}

function displaySaveStatusForTask(taskKey: string | null, saveStatus?: TaskSaveStatus) {
  if (saveStatus?.status !== "error") {
    return saveStatus;
  }

  return {
    ...saveStatus,
    message: saveErrorMessageForTask(taskKey, saveStatus.message),
  };
}

export function AssessmentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, setLastPath, updateTaskData, taskSaveStatus, retryFailedSaves, hasInProgressAssessment } = useAssessmentStore();
  const mocaVersion = state.scoringContext?.mocaVersion ?? "8.3";
  const [validation, setValidation] = useState<{ path: string; message: string } | null>(null);
  const currentStepConfig = getPatientStepConfig(location.pathname);
  const currentTaskKey = currentStepConfig.taskKey ?? null;
  const currentStep = currentStepConfig.step;
  const hasEvidence = useMemo(
    () => patientTaskHasEvidence(currentTaskKey ?? undefined, state.tasks),
    [currentTaskKey, state.tasks],
  );
  const currentSaveStatus = currentTaskKey ? taskSaveStatus[currentTaskKey] : undefined;
  const displaySaveStatus = displaySaveStatusForTask(currentTaskKey, currentSaveStatus);
  const isEndScreen = location.pathname.endsWith("/end");

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
        message: saveErrorMessageForTask(currentTaskKey, currentSaveStatus.message),
      });
      return;
    }
    if (!hasEvidence && currentTaskKey) {
      updateTaskData(currentTaskKey, {
        skipped: true,
        skippedAt: new Date().toISOString(),
        reason: "no_evidence",
      });
    }
    setValidation(null);
    navigate(currentStepConfig.next);
  };

  const validationMessage = validation?.path === location.pathname ? validation.message : null;

  if (!hasInProgressAssessment && !isEndScreen) {
    return <Navigate to="/" replace />;
  }

  return (
    <StimuliManifestProvider>
      <PatientTaskShell
        mocaVersion={mocaVersion}
        currentStep={currentStep}
        totalSteps={patientTaskTotalSteps}
        isEndScreen={isEndScreen}
        hasEvidence={hasEvidence}
        saveState={displaySaveStatus}
        validationMessage={validationMessage}
        topBanner={<StimulusReadinessBanner />}
        onBack={() => navigate(currentStepConfig.prev)}
        onNext={handleNext}
      >
        <Outlet />
      </PatientTaskShell>
    </StimuliManifestProvider>
  );
}
