import { Link, useNavigate } from "react-router";
import { Lock, ArrowLeft, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { getAssessmentResumePath, useAssessmentStore } from "../store/AssessmentContext";
import { isPatientSurface, isStagingDeploy } from "../surface";

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function LandingHub() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [isStandalone, setIsStandalone] = useState(() => isPatientSurface && isStandalonePwa());
  const { hasInProgressAssessment, state } = useAssessmentStore();
  const normalizedToken = token.replace(/\D/g, "");
  const formattedToken = normalizedToken.length > 4
    ? `${normalizedToken.slice(0, 4)}-${normalizedToken.slice(4)}`
    : normalizedToken;
  const isCompleteTestNumber = normalizedToken.length === 8;
  const title = isPatientSurface ? "הערכה קוגניטיבית" : "Remote Check";
  const subtitle = isPatientSurface ? "מבדק מרחוק" : "הערכה נוירופסיכולוגית ממוחשבת";
  const shellSpacing = isPatientSurface && isStagingDeploy ? "pb-4 pt-10 sm:py-6" : "py-4";

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleteTestNumber) {
      navigate(`/session/${normalizedToken}`);
    }
  };

  const handleResume = () => {
    navigate(getAssessmentResumePath(state.lastPath));
  };

  useEffect(() => {
    if (!isPatientSurface) return;

    const displayModeQuery = window.matchMedia?.("(display-mode: standalone)");
    if (!displayModeQuery) return;

    const handleDisplayModeChange = () => setIsStandalone(isStandalonePwa());
    displayModeQuery.addEventListener("change", handleDisplayModeChange);
    return () => displayModeQuery.removeEventListener("change", handleDisplayModeChange);
  }, []);

  return (
    <div
      dir="rtl"
      className={`min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-4 ${shellSpacing} sm:px-6 font-['Heebo',sans-serif]`}
    >
      <div className="w-full max-w-xl">
        <div className="mb-3 flex items-center justify-center gap-3 text-right sm:mb-4">
          <div className="w-10 h-10 shrink-0 bg-black text-white rounded-xl flex items-center justify-center text-sm font-bold sm:h-11 sm:w-11 sm:text-base">
            RC
          </div>
          <div>
            <h1 className="text-[1.45rem] sm:text-3xl font-extrabold text-black leading-tight">
              {title}
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-lg text-center relative overflow-hidden">
          <h2 className="text-[1.35rem] sm:text-2xl font-extrabold text-black mb-1">
            כניסת מטופל
          </h2>
          <p className="text-sm text-gray-600 mb-4 sm:text-base">
            הזן את מספר המבדק שקיבלת מהקלינאי
          </p>

          <form onSubmit={handleTokenSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={formattedToken}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="0000-0000"
                inputMode="numeric"
                maxLength={9}
                aria-label="מספר מבדק בן 8 ספרות"
                aria-describedby="test-number-help"
                dir="ltr"
                className="w-full h-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-bold tabular-nums border-2 border-black rounded-xl shadow-sm focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all placeholder:text-gray-300 placeholder:font-bold"
              />
              <div className="space-y-1.5">
                <div className="flex justify-center gap-2" dir="ltr" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-2 w-2 rounded-full ${
                        index < normalizedToken.length ? "bg-black" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p id="test-number-help" className="text-sm font-bold text-gray-600">
                  יש להזין מספר מבדק בן 8 ספרות
                </p>
                <p className="text-sm font-bold text-gray-600" aria-live="polite">
                  {isCompleteTestNumber
                    ? "המספר מלא. אפשר להתחיל."
                    : `הוזנו ${normalizedToken.length} מתוך 8 ספרות`}
                </p>
              </div>
              
              <button
                type="submit"
                disabled={!isCompleteTestNumber}
                className="w-full h-14 sm:h-16 bg-black text-white text-lg sm:text-2xl font-bold rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 focus:ring-4 focus:ring-black/20 outline-none"
              >
                התחל מבדק
                <ArrowLeft className="w-7 h-7" />
              </button>
            </div>
          </form>

          {hasInProgressAssessment && (
            <div className="mx-auto mt-3 flex max-w-md flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-right sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-950">יש מבדק פתוח במכשיר הזה</p>
                <p className="text-xs font-medium leading-relaxed text-blue-900">
                  אפשר להמשיך מהמקום שבו הפסקת.
                </p>
              </div>
              <button
                onClick={handleResume}
                className="min-h-10 shrink-0 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
              >
                המשך מהמקום שעצרת
              </button>
            </div>
          )}

          {isPatientSurface && (
            <div className="mx-auto mt-3 max-w-md rounded-2xl border border-gray-200 bg-gray-50 p-3 text-right">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-900 ring-1 ring-gray-200">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-950">
                    {isStandalone ? "נפתח ממסך הבית" : "מומלץ לפתוח ממסך הבית"}
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-gray-700">
                    {isStandalone
                      ? "המשך את כל המבדק באותה אפליקציה מותקנת."
                      : "ב-iPad או בטלפון, הוסף את האפליקציה למסך הבית לפני התחלת המבדק."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!isPatientSurface && (
        <div className="mt-4 text-center">
          <Link
            to="/clinician/auth"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-black text-base font-medium transition-colors"
          >
            <Lock className="w-4 h-4" />
            כניסה לקלינאים
          </Link>
        </div>
        )}
      </div>
    </div>
  );
}
