import { useState } from "react";
import { X, Stethoscope, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface PatientSummary {
  id: string;
  case_id?: string | null;
  full_name?: string | null;
  phone?: string | null;
  language?: string | null;
  education_years?: number | null;
  date_of_birth?: string | null;
  gender?: "male" | "female" | null;
  dominant_hand?: "right" | "left" | "ambidextrous" | null;
}

export interface OrderAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  patient: PatientSummary;
  onOrdered?: () => void;
}

export function OrderAssessmentModal({ open, onClose, patient, onOrdered }: OrderAssessmentModalProps) {
  const [assessmentType, setAssessmentType] = useState("moca");
  const [language, setLanguage] = useState(patient.language ?? "he");
  const [mocaVersion, setMocaVersion] = useState("8.3");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    testNumber: string;
  } | null>(null);
  const [copied, setCopied] = useState<"testNumber" | null>(null);

  if (!open) return null;

  const missingClinicalFields = clinicalContextGaps(patient);
  const canCreateSession = missingClinicalFields.length === 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (missingClinicalFields.length > 0) {
      setError("יש להשלים את כל פרטי הרקע הקליניים לפני פתיחת מבחן.");
      return;
    }
    if (assessmentType !== "moca") {
      setError("בשלב זה נתמך MoCA בלבד.");
      return;
    }
    if (language !== "he") {
      setError("בשלב זה נתמכת עברית בלבד.");
      return;
    }
    if (!["8.1", "8.2", "8.3"].includes(mocaVersion)) {
      setError("יש לבחור גרסת MoCA תקינה.");
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    const session = authData.session;
    if (!session) {
      setError("יש להתחבר מחדש כקלינאי.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          patientId: patient.id,
          assessmentType,
          language,
          mocaVersion,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "פתיחת מבחן נכשלה.");
      }

      const testNumber = payload.testNumber ?? payload.accessCode;
      if (!/^\d{8}$/.test(testNumber)) {
        throw new Error("מספר מבחן לא התקבל מהשרת.");
      }

      setResult({ testNumber });
      onOrdered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "פתיחת מבחן נכשלה.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (text: string, kind: "testNumber") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-6 font-['Heebo',sans-serif]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200 p-5 sm:p-8 max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-extrabold text-black">
                {result ? "המבחן נוצר בהצלחה" : "פתיחת מבחן חדש"}
              </h2>
              <p className="text-gray-500 text-sm">
                {result ? "העתק את מספר המבחן ושלח אותו למטופל" : `עבור תיק ${patient.case_id ?? patient.full_name}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">מבדק</label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
                >
                  <option value="moca">MoCA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">שפה</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
                >
                  <option value="he">עברית</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">גרסה</label>
                <select
                  value={mocaVersion}
                  onChange={(e) => setMocaVersion(e.target.value)}
                  className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
                >
                  <option value="8.1">MoCA 8.1</option>
                  <option value="8.2">MoCA 8.2</option>
                  <option value="8.3">MoCA 8.3</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
              גיל, שנות לימוד ושאר נתוני הרקע יילקחו מפרטי התיק השמורים. ייווצר מספר מבחן להעתקה ושליחה למטופל.
            </div>

            {missingClinicalFields.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm font-bold">
                <div>יש להשלים פרטי רקע לפני פתיחת מבחן:</div>
                <div className="mt-1 font-medium">{missingClinicalFields.join(" · ")}</div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 font-bold">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-14 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={!canCreateSession}
                className="flex-1 h-14 rounded-xl bg-black text-white font-bold hover:bg-gray-800 disabled:opacity-60"
              >
                {submitting ? "יוצר..." : "צור מספר מבחן"}
              </button>
            </div>
          </form>
        )}

        {result && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 font-bold">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6" />
                <span>המבחן נוצר בהצלחה.</span>
              </div>
              <button
                type="button"
                onClick={() => copy(result.testNumber, "testNumber")}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-extrabold text-green-900 shadow-sm hover:bg-green-100"
              >
                <Copy className="w-4 h-4" />
                {copied === "testNumber" ? "הועתק" : "העתק מספר"}
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">מספר מבחן</div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <span dir="ltr" className="font-mono text-3xl sm:text-4xl tabular-nums tracking-[0.18em] sm:tracking-[0.25em] text-left">
                    {result.testNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(result.testNumber, "testNumber")}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    {copied === "testNumber" ? "הועתק" : "העתק"}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  המטופל נכנס לדף הבית, מזין את מספר המבחן ומתחיל את המבדק.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-14 rounded-xl bg-black text-white font-bold hover:bg-gray-800"
            >
              אישור
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function clinicalContextGaps(patient: PatientSummary): string[] {
  const gaps: string[] = [];
  if (!patient.case_id?.trim() && !patient.full_name?.trim()) gaps.push("מזהה תיק");
  if (!patient.phone?.trim()) gaps.push("טלפון");
  if (!patient.date_of_birth) gaps.push("תאריך לידה");
  if (patient.gender !== "male" && patient.gender !== "female") gaps.push("מין");
  if (patient.language !== "he") gaps.push("שפת המבדק");
  if (!["right", "left", "ambidextrous"].includes(patient.dominant_hand ?? "")) gaps.push("יד דומיננטית");
  const educationYears = patient.education_years;
  if (typeof educationYears !== "number" || !Number.isInteger(educationYears) || educationYears < 0 || educationYears > 40) {
    gaps.push("שנות לימוד");
  }
  return gaps;
}
