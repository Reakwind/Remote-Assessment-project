export type AppSurface = "combined" | "patient" | "clinician";
export type DeployEnvironment = "local" | "staging" | "production";

function normalizeSurface(value: unknown): AppSurface {
  return value === "patient" || value === "clinician" || value === "combined" ? value : "combined";
}

function normalizeDeployEnvironment(value: unknown): DeployEnvironment {
  return value === "staging" || value === "production" || value === "local" ? value : "local";
}

export const appSurface = normalizeSurface(import.meta.env.VITE_APP_SURFACE);
export const deployEnvironment = normalizeDeployEnvironment(import.meta.env.VITE_DEPLOY_ENV);
export const isPatientSurface = appSurface === "patient";
export const isClinicianSurface = appSurface === "clinician";
export const isCombinedSurface = appSurface === "combined";
export const isStagingDeploy = deployEnvironment === "staging";
export const patientPwaUrl = import.meta.env.VITE_PATIENT_PWA_URL || "patient.<domain>";

export function shouldRegisterPatientServiceWorker(): boolean {
  return isPatientSurface && import.meta.env.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator;
}
