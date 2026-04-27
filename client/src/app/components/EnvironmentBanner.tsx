import { isPatientSurface, isStagingDeploy } from "../surface";

export function EnvironmentBanner() {
  if (!isPatientSurface || !isStagingDeploy) return null;

  return (
    <div
      dir="rtl"
      className="fixed left-3 top-3 z-50 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-950 shadow-sm"
      aria-label="מצב בדיקה"
    >
      מצב בדיקה
    </div>
  );
}
