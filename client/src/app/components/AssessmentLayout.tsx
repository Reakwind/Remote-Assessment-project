import { Navigate, Outlet, useNavigate, useLocation } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { useAssessmentStore } from "../store/AssessmentContext";
import { StimuliManifestProvider, StimulusReadinessBanner } from "./StimuliManifestProvider";
import { PatientTaskShell } from "./patient/PatientTaskShell";
import {
  getPatientStepConfig,
  patientTaskHasEvidence,
  patientTaskTotalSteps,
} from "./patient/patientTaskFlow";

export function AssessmentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, setLastPath, updateTaskData, taskSaveStatus, retryFailedSaves, hasInProgressAssessment } = useAssessmentStore();
  const mocaVersion = state.scoringContext?.mocaVersion ?? "8.3";
  const [validation, setValidation] = useState<{ path: string; message: string } | null>(null);
  const currentStepConfig = getPatientStepConfig(location.pathname);
  const currentStep = currentStepConfig.step;
  const hasEvidence = useMemo(
    () => patientTaskHasEvidence(currentStepConfig.taskKey, state.tasks),
    [currentStepConfig.taskKey, state.tasks],
  );
  const currentSaveStatus = currentStepConfig.taskKey ? taskSaveStatus[currentStepConfig.taskKey] : undefined;
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
        saveState={currentSaveStatus}
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
