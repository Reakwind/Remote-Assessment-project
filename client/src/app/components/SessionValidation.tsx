import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { useAssessmentStore } from "../store/useAssessmentStore";
import { useSession } from "../../hooks/useSession";

export function SessionValidation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { hasInProgressAssessment, startNewAssessment, state: assessmentState } = useAssessmentStore();
  const session = useSession(token);

  useEffect(() => {
    if (session.status === 'ready' && session.sessionId && session.linkToken && session.scoringContext) {
      const isSameDeviceResume =
        hasInProgressAssessment &&
        assessmentState.id === session.sessionId &&
        assessmentState.linkToken === session.linkToken;

      if (isSameDeviceResume) {
        navigate(assessmentState.lastPath || "/patient/welcome");
        return;
      }

      startNewAssessment(session.sessionId, session.linkToken, session.scoringContext);
      navigate("/patient/welcome");
    }
  }, [
    assessmentState.id,
    assessmentState.lastPath,
    assessmentState.linkToken,
    hasInProgressAssessment,
    navigate,
    session.linkToken,
    session.scoringContext,
    session.sessionId,
    session.status,
    startNewAssessment,
  ]);

  const getErrorMessage = () => {
    if (session.status === 'already_used') return "הקישור כבר שומש. אנא פנה למטפל לקישור חדש.";
    if (session.status === 'invalid') return "קוד המבחן אינו תקין. הקוד שהזנת אינו קיים במערכת.";
    if (session.status === 'error') return "אירעה שגיאה בתקשורת עם השרת. אנא נסה שוב מאוחר יותר.";
    return null;
  };

  const error = getErrorMessage();

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-['Heebo',sans-serif]"
    >
      <div className="max-w-lg w-full bg-white p-10 sm:p-12 rounded-[2rem] border border-gray-200 shadow-xl text-center">
        {error ? (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-extrabold text-black mb-4">
              קוד מבחן אינו תקין
            </h1>
            <p className="text-xl text-gray-600 mb-8">{error}</p>
            
            <Link
              to="/"
              className="w-full h-16 border-2 border-gray-300 text-black text-xl font-bold rounded-2xl hover:bg-gray-50 hover:border-black focus:ring-4 focus:ring-black/10 transition-all flex items-center justify-center gap-3"
            >
              חזרה לדף הבית
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
            <h1 className="text-2xl font-bold text-black mb-2">
              מאמת קוד מבחן...
            </h1>
            <p className="text-gray-500">אנא המתן, מכין את המערכת</p>
          </div>
        )}
      </div>
    </div>
  );
}
