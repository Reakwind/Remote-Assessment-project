import { useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { useSession } from "../../hooks/useSession";
import { hasCompletedPatientOnboarding, useAssessmentStore } from "../store/AssessmentContext";

function getPatientStartPath(sessionId?: string | null): string {
  return hasCompletedPatientOnboarding(sessionId) ? '/patient/trail-making' : '/patient/welcome';
}

export function SessionValidation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { state, hasInProgressAssessment, startNewAssessment } = useAssessmentStore();
  const startedTokenRef = useRef<string | null>(null);
  const canResumeCurrentToken = Boolean(
    token &&
      hasInProgressAssessment &&
      (state.linkToken === token || state.startToken === token) &&
      state.id &&
      state.scoringContext,
  );
  const session = useSession(token, { enabled: !canResumeCurrentToken });

  useEffect(() => {
    if (!token) return;

    if (canResumeCurrentToken) {
      if (startedTokenRef.current === token) {
        navigate(getPatientStartPath(state.id), { replace: true });
        return;
      }
      navigate('/', { replace: true });
      return;
    }

    if (
      session.status === 'ready' &&
      session.sessionId &&
      session.linkToken &&
      session.scoringContext
    ) {
      startedTokenRef.current = token;
      startNewAssessment(session.sessionId, session.linkToken, session.scoringContext, session.startToken);
      navigate(getPatientStartPath(session.sessionId), { replace: true });
    }
  }, [
    session.status,
    session.sessionId,
    session.linkToken,
    session.startToken,
    session.scoringContext,
    startNewAssessment,
    navigate,
    token,
    canResumeCurrentToken,
    state.id,
  ]);

  const getErrorMessage = () => {
    if (session.status === 'already_used' || session.status === 'invalid') {
      return "לא ניתן להתחיל את המבדק במספר שהוזן. בדוק את המספר או פנה לקלינאי.";
    }
    if (session.status === 'error') return "אירעה שגיאה בתקשורת עם השרת. פנה לקלינאי אם הבעיה נמשכת.";
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
              לא ניתן להתחיל את המבדק
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
              מאמת מספר מבדק...
            </h1>
            <p className="text-gray-500">אנא המתן, מכין את המערכת</p>
          </div>
        )}
      </div>
    </div>
  );
}
