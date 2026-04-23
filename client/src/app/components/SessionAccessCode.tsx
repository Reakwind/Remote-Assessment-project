import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useAssessmentStore } from "../store/AssessmentContext";
import { edgeFn } from "../../lib/supabase";
import type { ScoringContext } from "../../types/scoring";

const AGE_BAND_MAP: Record<string, number> = {
  "60-64": 62,
  "65-69": 67,
  "70-74": 72,
  "75-79": 77,
  "80+": 85,
};

export function SessionAccessCode() {
  const navigate = useNavigate();
  const { token } = useParams();
  const { startNewAssessment } = useAssessmentStore();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(accessCode.trim())) {
      setError("יש להזין קוד חד-פעמי בן 6 ספרות.");
      return;
    }

    if (!token) {
      setError("קישור המבחן אינו תקין.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(edgeFn("start-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accessCode: accessCode.trim() }),
      });

      if (res.status === 401) {
        setError("הקוד שהוזן שגוי. נסו שוב.");
        return;
      }

      if (!res.ok) {
        setError("לא ניתן לאמת את הקוד כרגע. נסו שוב או פנו לקלינאי.");
        return;
      }

      const data = await res.json();
      const scoringContext: ScoringContext = {
        sessionId: data.sessionId,
        sessionDate: new Date(data.sessionDate),
        educationYears: data.educationYears || 12,
        patientAge: AGE_BAND_MAP[data.ageBand] ?? 70,
        sessionLocation: { place: "Home", city: "Israel" },
      };

      startNewAssessment(data.sessionId, token, scoringContext);
      navigate("/patient/welcome");
    } catch {
      setError("אירעה שגיאה בתקשורת עם השרת. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-['Heebo',sans-serif]"
    >
      <div className="max-w-lg w-full bg-white p-10 sm:p-12 rounded-[2rem] border border-gray-200 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-black text-white flex items-center justify-center">
            <LockKeyhole className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-black mb-3">הזנת קוד חד-פעמי</h1>
          <p className="text-lg text-gray-600">
            הזינו את הקוד שקיבלתם ב-SMS כדי להתחיל את המבדק.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full h-16 px-4 text-3xl tracking-[0.4em] text-center border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 font-bold text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-16 bg-black text-white text-xl font-bold rounded-xl hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "מאמת קוד..." : "המשך למבדק"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate(`/session/${token}`)}
          className="mt-6 w-full h-12 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-black transition-all inline-flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          חזרה
        </button>
      </div>
    </div>
  );
}
