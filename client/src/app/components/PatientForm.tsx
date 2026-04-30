import { useState } from "react";
import { Hash, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface PatientFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: (patientId: string) => void;
}

export function PatientForm({ open, onClose, onCreated }: PatientFormProps) {
  const [caseId, setCaseId] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [language, setLanguage] = useState("he");
  const [dominantHand, setDominantHand] = useState<"" | "right" | "left" | "ambidextrous">("");
  const [educationYears, setEducationYears] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setCaseId("");
    setPhone("");
    setBirthDay("");
    setBirthMonth("");
    setBirthYear("");
    setGender("");
    setLanguage("he");
    setDominantHand("");
    setEducationYears("");
    setError(null);
  };

  const normalizedCaseId = caseId.trim().toUpperCase();

  const buildBirthDate = () => {
    const day = Number(birthDay);
    const month = Number(birthMonth);
    const year = Number(birthYear);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return null;
    }
    if (
      year < 1900 ||
      year > new Date().getFullYear() ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!normalizedCaseId) {
      setError("יש למלא מזהה תיק.");
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9_.-]{2,49}$/.test(normalizedCaseId)) {
      setError("מזהה תיק חייב להיות קוד באנגלית/מספרים בלבד, 3-50 תווים.");
      return;
    }

    const normalizedPhone = phone.replace(/[\s-]/g, "");
    if (!/^\+?[0-9]{7,15}$/.test(normalizedPhone)) {
      setError("יש להזין מספר טלפון תקין.");
      return;
    }

    const dateOfBirth = buildBirthDate();
    if (!dateOfBirth) {
      setError("יש להזין תאריך לידה תקין.");
      return;
    }

    if (!gender) {
      setError("יש לבחור מין.");
      return;
    }
    if (language !== "he") {
      setError("בשלב זה נתמכת עברית בלבד.");
      return;
    }
    if (!dominantHand) {
      setError("יש לבחור יד דומיננטית.");
      return;
    }

    const education = Number(educationYears);
    if (!Number.isInteger(education) || education < 0 || education > 40) {
      setError("שנות לימוד חייבות להיות בין 0 ל-40.");
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    const session = authData.session;
    if (!session) {
      setError("יש להתחבר מחדש.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: insertError } = await supabase
        .from("patients")
        .insert({
          clinician_id: session.user.id,
          case_id: normalizedCaseId,
          full_name: normalizedCaseId,
          phone: normalizedPhone,
          date_of_birth: dateOfBirth,
          gender,
          language,
          dominant_hand: dominantHand,
          education_years: education,
          id_number: null,
          notes: null,
        })
        .select("id")
        .single();

      if (insertError || !data) {
        throw new Error(insertError?.message ?? "פתיחת תיק נכשלה.");
      }

      reset();
      onCreated(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "פתיחת תיק נכשלה.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 font-['Heebo',sans-serif] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="my-3 flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:my-0 sm:max-h-[calc(100vh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
              <Hash className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-black">פתיחת תיק חדש</h2>
              <p className="text-gray-500 text-sm">פרטי רקע קליניים נשמרים לתיק ולפענוח המבדק</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div
            data-testid="case-form-scroll"
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4"
          >
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">מזהה תיק*</label>
              <input
                value={caseId}
                onChange={(e) => setCaseId(e.target.value.toUpperCase())}
                placeholder="למשל CASE-20260425-001"
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                קוד פסאודונימי בלבד: אותיות באנגלית, מספרים, נקודה, מקף או קו תחתון.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">טלפון*</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="למשל 0501234567"
                inputMode="tel"
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">תאריך לידה*</label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <input
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="יום"
                  inputMode="numeric"
                  className="h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
                />
                <input
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="חודש"
                  inputMode="numeric"
                  className="h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
                />
                <input
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="שנה"
                  inputMode="numeric"
                  className="h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">מין*</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as "" | "male" | "female")}
                  aria-label="מין*"
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
                >
                  <option value="">בחרו</option>
                  <option value="male">זכר</option>
                  <option value="female">נקבה</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">שפת המבדק*</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  aria-label="שפת המבדק*"
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
                >
                  <option value="he">עברית</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">יד דומיננטית*</label>
                <select
                  value={dominantHand}
                  onChange={(e) =>
                    setDominantHand(e.target.value as "" | "right" | "left" | "ambidextrous")
                  }
                  aria-label="יד דומיננטית*"
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
                >
                  <option value="">בחרו</option>
                  <option value="right">ימין</option>
                  <option value="left">שמאל</option>
                  <option value="ambidextrous">שתי הידיים</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">שנות לימוד*</label>
                <input
                  value={educationYears}
                  onChange={(e) => setEducationYears(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="למשל 12"
                  inputMode="numeric"
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm font-bold">
                {error}
              </div>
            )}
          </div>

          <div
            data-testid="case-form-footer"
            className="flex shrink-0 gap-3 border-t border-gray-100 bg-white p-5"
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-11 rounded-lg bg-black text-white font-bold hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? "שומר..." : "פתח תיק"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
