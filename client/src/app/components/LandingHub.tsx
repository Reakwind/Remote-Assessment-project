import { Link, useNavigate } from "react-router";
import { User, Lock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { getAssessmentResumePath, useAssessmentStore } from "../store/AssessmentContext";

export function LandingHub() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const { hasInProgressAssessment, state } = useAssessmentStore();
  const normalizedToken = token.replace(/\D/g, "");
  const formattedToken = normalizedToken.length > 4
    ? `${normalizedToken.slice(0, 4)}-${normalizedToken.slice(4)}`
    : normalizedToken;
  const isCompleteTestNumber = normalizedToken.length === 8;

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleteTestNumber) {
      navigate(`/session/${normalizedToken}`);
    }
  };

  const handleResume = () => {
    navigate(getAssessmentResumePath(state.lastPath));
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 font-['Heebo',sans-serif]"
    >
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-black text-white rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-6">
            RC
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-black mb-4">
            Remote Check
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 font-medium">
            הערכה נוירופסיכולוגית ממוחשבת
          </p>
        </div>

        <div className="bg-white p-6 sm:p-10 md:p-14 rounded-3xl border border-gray-200 shadow-lg text-center relative overflow-hidden">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <User className="w-12 h-12" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-black mb-4">
            כניסת מטופל
          </h2>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 sm:mb-10">
            הזן את מספר המבדק שקיבלת מהקלינאי
          </p>

          {hasInProgressAssessment && (
            <div className="mb-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-right">
              <p className="mb-3 text-xl font-bold text-blue-950">זוהה מבדק בתהליך במכשיר הזה</p>
              <p className="mb-5 text-base font-medium leading-relaxed text-blue-900">
                כדי להמשיך מהמקום שבו הפסקת, השתמש באותו מכשיר.
              </p>
              <button
                onClick={handleResume}
                className="w-full min-h-16 rounded-xl bg-blue-700 px-5 py-3 text-xl font-bold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
              >
                המשך מהמקום שעצרת
              </button>
            </div>
          )}

          {hasInProgressAssessment && (
            <div className="mb-8 flex items-center gap-3 text-sm font-bold text-gray-500">
              <div className="h-px flex-1 bg-gray-200" />
              <span>או הזן מספר מבדק חדש</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          )}

          <form onSubmit={handleTokenSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col gap-6">
              <input
                type="text"
                value={formattedToken}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="הזן מספר מבדק..."
                inputMode="numeric"
                maxLength={9}
                aria-label="מספר מבדק בן 8 ספרות"
                aria-describedby="test-number-help"
                dir="ltr"
                className="w-full h-16 sm:h-20 text-center text-2xl sm:text-3xl font-mono font-bold tabular-nums border-2 border-gray-300 rounded-2xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all placeholder:text-gray-500 placeholder:font-normal"
                autoFocus
              />
              <div className="space-y-3">
                <div className="flex justify-center gap-2" dir="ltr" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-2.5 rounded-full ${
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
                className="w-full h-16 sm:h-20 bg-black text-white text-xl sm:text-2xl font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-4 focus:ring-4 focus:ring-black/20 outline-none"
              >
                התחל מבדק
                <ArrowLeft className="w-8 h-8" />
              </button>
            </div>
          </form>

        </div>

        <div className="mt-12 text-center">
          <Link
            to="/clinician/auth"
            className="inline-flex items-center gap-3 text-gray-500 hover:text-black text-lg font-medium transition-colors"
          >
            <Lock className="w-5 h-5" />
            כניסה לקלינאים
          </Link>
        </div>
      </div>
    </div>
  );
}
