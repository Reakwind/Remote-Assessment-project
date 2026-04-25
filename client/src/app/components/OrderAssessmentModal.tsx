import { useMemo, useState } from "react";
import { X, Stethoscope, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface PatientSummary {
  id: string;
  full_name: string;
  phone: string;
  date_of_birth: string | null;
}

export interface OrderAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  patient: PatientSummary;
  onOrdered?: () => void;
}

type AgeBand = "60-64" | "65-69" | "70-74" | "75-79" | "80+";

function inferAgeBand(dateOfBirth: string | null): AgeBand {
  if (!dateOfBirth) return "70-74";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "70-74";
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 65) return "60-64";
  if (age < 70) return "65-69";
  if (age < 75) return "70-74";
  if (age < 80) return "75-79";
  return "80+";
}

export function OrderAssessmentModal({ open, onClose, patient, onOrdered }: OrderAssessmentModalProps) {
  const defaultAgeBand = useMemo(() => inferAgeBand(patient.date_of_birth), [patient.date_of_birth]);
  const [ageBand, setAgeBand] = useState<AgeBand>(defaultAgeBand);
  const [educationYears, setEducationYears] = useState("12");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    testNumber: string;
  } | null>(null);
  const [copied, setCopied] = useState<"testNumber" | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const years = Number(educationYears);
    if (!Number.isFinite(years) || years < 0 || years > 40) {
      setError("שנות לימוד חייבות להיות בין 0 ל-40.");
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
          ageBand,
          educationYears: years,
          assessmentType: "moca",
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "פתיחת מבחן נכשלה.");
      }

      setResult({
        testNumber: payload.testNumber ?? payload.accessCode,
      });
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
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6 font-['Heebo',sans-serif]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-200 p-8 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-black">פתיחת מבחן חדש</h2>
              <p className="text-gray-500 text-sm">עבור {patient.full_name}</p>
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
            <div>
              <div className="text-sm font-bold text-gray-600 mb-2">בחירת סוללת הערכה</div>
              <div className="border-2 border-black rounded-2xl p-5 flex items-center justify-between bg-black/5">
                <div>
                  <div className="font-extrabold text-lg text-black">MoCA (Hebrew)</div>
                  <div className="text-sm text-gray-600">הערכה קוגניטיבית מקיפה — כ-25 דקות</div>
                </div>
                <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-bold">נבחר</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">סוללות נוספות יתווספו בעתיד.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">קבוצת גיל</label>
                <select
                  value={ageBand}
                  onChange={(e) => setAgeBand(e.target.value as AgeBand)}
                  className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
                >
                  <option value="60-64">60-64</option>
                  <option value="65-69">65-69</option>
                  <option value="70-74">70-74</option>
                  <option value="75-79">75-79</option>
                  <option value="80+">80+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">שנות לימוד</label>
                <input
                  value={educationYears}
                  onChange={(e) => setEducationYears(e.target.value)}
                  inputMode="numeric"
                  className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
              ייווצר מספר מבחן. העתיקו אותו ושלחו למטופל בכל ערוץ שמתאים לכם.
            </div>

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
                disabled={submitting}
                className="flex-1 h-14 rounded-xl bg-black text-white font-bold hover:bg-gray-800 disabled:opacity-60"
              >
                {submitting ? "יוצר..." : "צור מספר מבחן"}
              </button>
            </div>
          </form>
        )}

        {result && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 font-bold">
              <CheckCircle2 className="w-6 h-6" />
              המבחן נפתח בהצלחה.
            </div>

            <div className="space-y-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">מספר מבחן</div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-4xl tabular-nums tracking-[0.25em]">{result.testNumber}</span>
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
              סגור
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
