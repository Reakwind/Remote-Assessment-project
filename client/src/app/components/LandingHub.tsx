import { Link, useNavigate } from "react-router";
import { User, Lock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { getAssessmentResumePath, useAssessmentStore } from "../store/AssessmentContext";

export function LandingHub() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const { hasInProgressAssessment, state } = useAssessmentStore();
  const normalizedToken = token.replace(/\D/g, "");
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
            הזן את מספר המבחן שקיבלת מהקלינאי
          </p>

          <form onSubmit={handleTokenSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col gap-6">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                placeholder="הזן מספר מבחן..."
                inputMode="numeric"
                maxLength={8}
                aria-describedby="test-number-help"
                className="w-full h-16 sm:h-20 text-center text-2xl sm:text-3xl font-bold border-2 border-gray-300 rounded-2xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                autoFocus
              />
              <p id="test-number-help" className="text-sm font-bold text-gray-500">
                יש להזין מספר מבחן בן 8 ספרות
              </p>
              
              <button
                type="submit"
                disabled={!isCompleteTestNumber}
                className="w-full h-16 sm:h-20 bg-black text-white text-xl sm:text-2xl font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-4 focus:ring-4 focus:ring-black/20 outline-none"
              >
                אישור
                <ArrowLeft className="w-8 h-8" />
              </button>
            </div>
          </form>

          {hasInProgressAssessment && (
            <div className="mt-10 pt-10 border-t border-gray-100">
              <p className="text-lg text-gray-500 mb-4">זוהה מבחן בתהליך</p>
              <button
                onClick={handleResume}
                className="w-full h-16 bg-blue-50 text-blue-700 text-xl font-bold rounded-xl hover:bg-blue-100 transition-colors"
              >
                המשך את המבחן מאיפה שהפסקת
              </button>
            </div>
          )}
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
