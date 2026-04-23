import { createHashRouter } from "react-router";
import { AssessmentLayout } from "./components/AssessmentLayout";
import { TrailMakingTask } from "./components/TrailMakingTask";
import { CubeTask } from "./components/CubeTask";
import { ClockTask } from "./components/ClockTask";
import { NamingTask } from "./components/NamingTask";
import { MemoryTask } from "./components/MemoryTask";
import { DigitSpanTask } from "./components/DigitSpanTask";
import { VigilanceTask } from "./components/VigilanceTask";
import { SerialSevensTask } from "./components/SerialSevensTask";
import { LanguageTask } from "./components/LanguageTask";
import { AbstractionTask } from "./components/AbstractionTask";
import { DelayedRecallTask } from "./components/DelayedRecallTask";
import { OrientationTask } from "./components/OrientationTask";
import { EndScreen } from "./components/EndScreen";
import { ClinicianDashboardList } from "./components/ClinicianDashboardList";
import { ClinicianDashboardDetail } from "./components/ClinicianDashboardDetail";
import { ClinicianDashboardLayout } from "./components/ClinicianDashboardLayout";
import { LandingHub } from "./components/LandingHub";
import { PatientWelcome } from "./components/PatientWelcome";
import { SessionValidation } from "./components/SessionValidation";
import { SessionAccessCode } from "./components/SessionAccessCode";
import { ClinicianAuthPage } from "./components/auth/ClinicianAuthPage";
import { ClinicianProtectedRoute } from "./components/auth/ClinicianProtectedRoute";

export const router = createHashRouter([
  {
    path: "/",
    element: <LandingHub />,
  },
  {
    path: "/session/:token",
    element: <SessionValidation />,
  },
  {
    path: "/session/:token/code",
    element: <SessionAccessCode />,
  },
  {
    path: "/patient/welcome",
    element: <PatientWelcome />,
  },
  {
    path: "/patient",
    element: <AssessmentLayout />,
    children: [
      { index: true, element: <TrailMakingTask /> },
      { path: "trail-making", element: <TrailMakingTask /> },
      { path: "cube", element: <CubeTask /> },
      { path: "clock", element: <ClockTask /> },
      { path: "naming", element: <NamingTask /> },
      { path: "memory", element: <MemoryTask /> },
      { path: "digit-span", element: <DigitSpanTask /> },
      { path: "vigilance", element: <VigilanceTask /> },
      { path: "serial7", element: <SerialSevensTask /> },
      { path: "language", element: <LanguageTask /> },
      { path: "abstraction", element: <AbstractionTask /> },
      { path: "delayed-recall", element: <DelayedRecallTask /> },
      { path: "orientation", element: <OrientationTask /> },
      { path: "end", element: <EndScreen /> },
    ],
  },
  {
    path: "/dashboard",
    element: <ClinicianProtectedRoute />,
    children: [
      {
        element: <ClinicianDashboardLayout />,
        children: [
          { index: true, element: <ClinicianDashboardList /> },
          { path: ":patientId", element: <ClinicianDashboardDetail /> },
        ],
      },
    ],
  },
  {
    path: "/clinician/auth",
    element: <ClinicianAuthPage />,
  },
]);
